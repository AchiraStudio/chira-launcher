//! `settings-manager` owns user settings (plan §12.3, §17).
//!
//! Persistence strategy:
//! 1. The source of truth is the `user_settings` table in SQLite.
//! 2. Every successful save also writes `recovery/settings.last-known-good.json` atomically. That
//!    file is independent of the database, so settings survive a corrupt or quarantined DB.
//! 3. Load order is database → recovery snapshot → defaults, and the chosen
//!    [`SettingsSource`] is exposed so a fallback is never silent.

mod validate;

use std::path::{Path, PathBuf};

use desktop_core::EngineResult;
use desktop_protocol::{
    AppearancePatch, SETTINGS_SCHEMA_VERSION, Settings, SettingsPatch, SettingsSource,
};
use persistence::{Database, write_atomic};
use tokio::sync::Mutex;

pub use validate::normalize_accent;

const SETTINGS_KEY: &str = "settings";
const SNAPSHOT_FILE: &str = "settings.last-known-good.json";

pub struct SettingsManager {
    db: Database,
    snapshot_path: PathBuf,
    source: SettingsSource,
    /// Serialises updates so concurrent patches cannot interleave their read-modify-write.
    current: Mutex<Settings>,
}

impl SettingsManager {
    /// Loads settings using the fallback chain and persists the result if it came from anywhere
    /// but the database, so the next start is clean.
    pub async fn load(db: Database, recovery_dir: &Path) -> Self {
        let snapshot_path = recovery_dir.join(SNAPSHOT_FILE);

        let (settings, source) = match db.get_json::<Settings>(SETTINGS_KEY).await {
            Ok(Some(stored)) => (stored, SettingsSource::Database),
            Ok(None) => from_snapshot_or_defaults(&snapshot_path),
            Err(err) => {
                tracing::error!(%err, "stored settings are unreadable; falling back");
                from_snapshot_or_defaults(&snapshot_path)
            }
        };
        let settings = sanitize(settings);

        let manager = Self {
            db,
            snapshot_path,
            source,
            current: Mutex::new(settings.clone()),
        };
        if source != SettingsSource::Database
            && let Err(err) = manager.persist(&settings).await
        {
            tracing::error!(%err, "could not persist recovered settings");
        }
        manager
    }

    pub fn source(&self) -> SettingsSource {
        self.source
    }

    pub async fn get(&self) -> Settings {
        self.current.lock().await.clone()
    }

    /// Applies a partial update. Validates first, persists second, and only then swaps the
    /// in-memory value, so a failed save leaves the previous settings in force.
    pub async fn update(&self, patch: SettingsPatch) -> EngineResult<Settings> {
        let mut current = self.current.lock().await;
        let next = apply(&current, patch)?;
        if next == *current {
            return Ok(next);
        }
        self.persist(&next).await?;
        *current = next.clone();
        Ok(next)
    }

    async fn persist(&self, settings: &Settings) -> EngineResult<()> {
        self.db.set_json(SETTINGS_KEY, settings).await?;
        // The snapshot is a safety net; failing to write it must not fail the user's change,
        // but it must be visible.
        match serde_json::to_vec_pretty(settings) {
            Ok(bytes) => {
                if let Err(err) = write_atomic(&self.snapshot_path, &bytes) {
                    tracing::error!(%err, "could not write the last-known-good settings snapshot");
                }
            }
            Err(err) => tracing::error!(%err, "could not serialize the settings snapshot"),
        }
        Ok(())
    }
}

fn from_snapshot_or_defaults(path: &Path) -> (Settings, SettingsSource) {
    match std::fs::read(path) {
        Ok(bytes) => match serde_json::from_slice::<Settings>(&bytes) {
            Ok(settings) => {
                tracing::warn!("restored settings from the last-known-good snapshot");
                return (settings, SettingsSource::RecoverySnapshot);
            }
            Err(err) => tracing::error!(%err, "recovery snapshot is unreadable"),
        },
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => {
            tracing::error!(%err, path = %path.display(), "cannot read the recovery snapshot")
        }
    }
    (Settings::default(), SettingsSource::Defaults)
}

/// Repairs values loaded from disk that this build would not accept (e.g. hand-edited files).
fn sanitize(mut settings: Settings) -> Settings {
    settings.schema_version = SETTINGS_SCHEMA_VERSION;
    match normalize_accent(&settings.appearance.accent) {
        Ok(accent) => settings.appearance.accent = accent,
        Err(_) => {
            tracing::warn!("stored accent colour is invalid; resetting to the default");
            settings.appearance.accent = Settings::default().appearance.accent;
        }
    }
    settings
}

fn apply(current: &Settings, patch: SettingsPatch) -> EngineResult<Settings> {
    let mut next = current.clone();
    if let Some(AppearancePatch {
        theme,
        accent,
        quality_profile,
        motion,
    }) = patch.appearance
    {
        if let Some(theme) = theme {
            next.appearance.theme = theme;
        }
        if let Some(accent) = accent {
            next.appearance.accent = normalize_accent(&accent)?;
        }
        if let Some(profile) = quality_profile {
            next.appearance.quality_profile = profile;
        }
        if let Some(motion) = motion {
            next.appearance.motion = motion;
        }
    }
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use desktop_core::EngineError;
    use desktop_protocol::{DEFAULT_ACCENT, MotionPreference, QualityProfile, ThemeMode};

    async fn fixture() -> (tempfile::TempDir, Database, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let recovery = tmp.path().join("recovery");
        std::fs::create_dir_all(&recovery).unwrap();
        let db = Database::open(&tmp.path().join("desktop.db"))
            .await
            .unwrap();
        (tmp, db, recovery)
    }

    fn theme_patch(theme: ThemeMode) -> SettingsPatch {
        SettingsPatch {
            appearance: Some(AppearancePatch {
                theme: Some(theme),
                ..Default::default()
            }),
        }
    }

    #[tokio::test]
    async fn fresh_install_uses_defaults_and_persists_them() {
        let (_tmp, db, recovery) = fixture().await;
        let m = SettingsManager::load(db.clone(), &recovery).await;
        assert_eq!(m.source(), SettingsSource::Defaults);
        assert_eq!(m.get().await, Settings::default());
        assert!(recovery.join(SNAPSHOT_FILE).exists());
        assert!(
            db.get_json::<Settings>(SETTINGS_KEY)
                .await
                .unwrap()
                .is_some()
        );
    }

    #[tokio::test]
    async fn updates_are_partial_persisted_and_survive_a_restart() {
        let (_tmp, db, recovery) = fixture().await;
        let m = SettingsManager::load(db.clone(), &recovery).await;

        let updated = m
            .update(SettingsPatch {
                appearance: Some(AppearancePatch {
                    theme: Some(ThemeMode::Light),
                    quality_profile: Some(QualityProfile::Performance),
                    ..Default::default()
                }),
            })
            .await
            .unwrap();
        assert_eq!(updated.appearance.theme, ThemeMode::Light);
        assert_eq!(
            updated.appearance.quality_profile,
            QualityProfile::Performance
        );
        assert_eq!(
            updated.appearance.accent, DEFAULT_ACCENT,
            "untouched fields stay as they were"
        );
        assert_eq!(updated.appearance.motion, MotionPreference::System);

        let restarted = SettingsManager::load(db, &recovery).await;
        assert_eq!(restarted.source(), SettingsSource::Database);
        assert_eq!(restarted.get().await, updated);
    }

    #[tokio::test]
    async fn an_invalid_accent_is_rejected_and_changes_nothing() {
        let (_tmp, db, recovery) = fixture().await;
        let m = SettingsManager::load(db, &recovery).await;
        let err = m
            .update(SettingsPatch {
                appearance: Some(AppearancePatch {
                    theme: Some(ThemeMode::Light),
                    accent: Some("javascript:alert(1)".into()),
                    ..Default::default()
                }),
            })
            .await
            .unwrap_err();
        assert!(matches!(err, EngineError::InvalidInput(_)), "{err:?}");
        assert_eq!(
            m.get().await,
            Settings::default(),
            "a rejected patch must apply nothing"
        );
    }

    #[tokio::test]
    async fn accents_are_stored_normalised() {
        let (_tmp, db, recovery) = fixture().await;
        let m = SettingsManager::load(db, &recovery).await;
        let s = m
            .update(SettingsPatch {
                appearance: Some(AppearancePatch {
                    accent: Some("#ff8800".into()),
                    ..Default::default()
                }),
            })
            .await
            .unwrap();
        assert_eq!(s.appearance.accent, "#FF8800");
    }

    #[tokio::test]
    async fn unreadable_database_value_falls_back_to_the_snapshot() {
        let (_tmp, db, recovery) = fixture().await;
        let m = SettingsManager::load(db.clone(), &recovery).await;
        m.update(theme_patch(ThemeMode::Light)).await.unwrap();

        // Corrupt the stored value behind the manager's back.
        db.set_json(SETTINGS_KEY, &"garbage").await.unwrap();

        let recovered = SettingsManager::load(db.clone(), &recovery).await;
        assert_eq!(recovered.source(), SettingsSource::RecoverySnapshot);
        assert_eq!(recovered.get().await.appearance.theme, ThemeMode::Light);
        // …and the database was repaired.
        assert!(db.get_json::<Settings>(SETTINGS_KEY).await.is_ok());
    }

    #[tokio::test]
    async fn a_corrupt_snapshot_and_database_still_yield_defaults() {
        let (_tmp, db, recovery) = fixture().await;
        std::fs::write(recovery.join(SNAPSHOT_FILE), b"{ not json").unwrap();
        let m = SettingsManager::load(db, &recovery).await;
        assert_eq!(m.source(), SettingsSource::Defaults);
        assert_eq!(m.get().await, Settings::default());
    }

    #[tokio::test]
    async fn a_hand_edited_invalid_accent_is_repaired_on_load() {
        let (_tmp, db, recovery) = fixture().await;
        let mut bad = Settings::default();
        bad.appearance.accent = "not-a-colour".into();
        db.set_json(SETTINGS_KEY, &bad).await.unwrap();
        let m = SettingsManager::load(db, &recovery).await;
        assert_eq!(m.get().await.appearance.accent, DEFAULT_ACCENT);
    }
}
