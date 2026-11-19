//! The Desktop Engine: owns every engine subsystem and exposes the operations the shell may
//! request. It is deliberately independent of Tauri (HR-A4) so it can outlive a crashed or
//! reloaded UI, and later move into its own process (plan §4.2).
//!
//! The Tauri host (`src-tauri`) is only a thin adapter: commands → [`Engine`] methods, and
//! [`EngineEvent`]s → webview events.

mod diagnostics;
mod events;
mod report_limiter;

use std::sync::Arc;
use std::time::Instant;

use desktop_core::identity::{APP_IDENTIFIER, PRODUCT_NAME, PRODUCT_SLUG};
use desktop_core::{AppPaths, EngineResult};
use desktop_protocol::{
    AppInfo, DatabaseStatus, Diagnostics, Display, DpiAwareness, EngineEvent, FrontendErrorReport,
    PROTOCOL_VERSION, PathsInfo, Settings, SettingsPatch, SystemInfo,
};
use display_manager::DisplayManager;
use persistence::Database;
use settings_manager::SettingsManager;
use tokio::sync::broadcast;

pub use diagnostics::{LogGuard, init_logging};
pub use events::EventBus;

use report_limiter::ReportLimiter;

/// Maximum frontend error reports accepted per minute; the rest are counted and dropped.
const MAX_FRONTEND_REPORTS_PER_MINUTE: usize = 20;
const MAX_REPORT_MESSAGE_CHARS: usize = 2_000;
const MAX_REPORT_STACK_CHARS: usize = 8_000;

pub struct Engine {
    paths: AppPaths,
    db: Database,
    settings: SettingsManager,
    displays: DisplayManager,
    events: EventBus,
    started: Instant,
    reports: ReportLimiter,
}

impl Engine {
    /// Creates the data directories, opens the database, loads settings and takes a first
    /// monitor snapshot. Only failures that make the engine unusable are returned; a failed
    /// first display scan is logged and retried on demand.
    pub async fn start(paths: AppPaths) -> EngineResult<Arc<Self>> {
        paths.ensure_created()?;
        let db = Database::open(&paths.database_file()).await?;
        let settings = SettingsManager::load(db.clone(), &paths.recovery_dir()).await;
        let displays = DisplayManager::new();

        if let Err(err) = displays.refresh().await {
            tracing::warn!(%err, "initial display scan failed; will retry on demand");
        }

        tracing::info!(
            settings_source = ?settings.source(),
            data_dir = %paths.root().display(),
            "engine started"
        );

        let engine = Arc::new(Self {
            paths,
            db,
            settings,
            displays,
            events: EventBus::new(),
            started: Instant::now(),
            reports: ReportLimiter::new(MAX_FRONTEND_REPORTS_PER_MINUTE),
        });
        engine.log_system_info();
        Ok(engine)
    }

    /// Records the OS build and DPI awareness once at startup. Physical-pixel window placement is
    /// only correct on mixed-DPI setups when the host is per-monitor-v2 aware (plan §8.1), so a
    /// different value is a warning, not just trivia.
    fn log_system_info(&self) {
        let Some(system) = self.app_info().system else {
            return;
        };
        tracing::info!(
            os = %system.os_name,
            build = system.os_build,
            dpi_awareness = ?system.dpi_awareness,
            "system info"
        );
        if system.dpi_awareness != DpiAwareness::PerMonitorV2 {
            tracing::warn!(
                dpi_awareness = ?system.dpi_awareness,
                "host is not per-monitor-v2 DPI aware; monitor geometry may be virtualized"
            );
        }
    }

    /// Subscribes to engine events (used by the host's event bridge).
    pub fn subscribe(&self) -> broadcast::Receiver<EngineEvent> {
        self.events.subscribe()
    }

    pub fn app_info(&self) -> AppInfo {
        let system = match (
            platform_windows::os_version(),
            platform_windows::process_dpi_awareness(),
        ) {
            (Ok(v), awareness) => Some(SystemInfo {
                os_name: if v.is_windows_11() {
                    "Windows 11"
                } else {
                    "Windows"
                }
                .to_owned(),
                os_version: format!("{}.{}", v.major, v.minor),
                os_build: v.build,
                dpi_awareness: awareness.map_or(DpiAwareness::Unknown, map_awareness),
            }),
            (Err(err), _) => {
                tracing::warn!(%err, "could not read Windows version");
                None
            }
        };
        AppInfo {
            name: PRODUCT_NAME.to_owned(),
            slug: PRODUCT_SLUG.to_owned(),
            identifier: APP_IDENTIFIER.to_owned(),
            version: env!("CARGO_PKG_VERSION").to_owned(),
            protocol_version: PROTOCOL_VERSION,
            system,
        }
    }

    pub async fn settings(&self) -> Settings {
        self.settings.get().await
    }

    /// Validates and applies a settings patch, then announces the new settings to every window.
    pub async fn update_settings(&self, patch: SettingsPatch) -> EngineResult<Settings> {
        let updated = self.settings.update(patch).await?;
        self.events
            .publish(EngineEvent::SettingsChanged(updated.clone()));
        Ok(updated)
    }

    pub async fn displays(&self) -> EngineResult<Vec<Display>> {
        self.displays.current().await
    }

    /// Re-scans monitors; announces the new list only if it actually changed.
    pub async fn refresh_displays(&self) -> EngineResult<Vec<Display>> {
        let refresh = self.displays.refresh().await?;
        if refresh.changed {
            self.events
                .publish(EngineEvent::DisplaysChanged(refresh.displays.clone()));
        }
        Ok(refresh.displays)
    }

    pub async fn diagnostics(&self) -> EngineResult<Diagnostics> {
        let schema_version = match self.db.schema_version().await {
            Ok(v) => v,
            Err(err) => {
                tracing::warn!(%err, "could not read the database schema version");
                None
            }
        };
        Ok(Diagnostics {
            app: self.app_info(),
            paths: PathsInfo {
                data_dir: self.paths.root().display().to_string(),
                logs_dir: self.paths.logs_dir().display().to_string(),
                database_file: self.paths.database_file().display().to_string(),
                recovery_dir: self.paths.recovery_dir().display().to_string(),
            },
            database: DatabaseStatus {
                schema_version,
                quarantined_previous: self
                    .db
                    .quarantined_previous()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().into_owned()),
            },
            settings_source: self.settings.source(),
            uptime_seconds: u32::try_from(self.started.elapsed().as_secs()).unwrap_or(u32::MAX),
            frontend_reports_dropped: u32::try_from(self.reports.dropped()).unwrap_or(u32::MAX),
        })
    }

    /// Records a UI crash in the engine log. Size-capped and rate-limited (plan §20.2).
    pub fn report_frontend_error(&self, report: FrontendErrorReport) {
        if !self.reports.try_acquire() {
            return;
        }
        let message: String = report
            .message
            .chars()
            .take(MAX_REPORT_MESSAGE_CHARS)
            .collect();
        let stack: String = report
            .stack
            .unwrap_or_default()
            .chars()
            .take(MAX_REPORT_STACK_CHARS)
            .collect();
        tracing::error!(target: "frontend", source = ?report.source, %message, %stack, "shell UI reported an error");
    }

    /// Flushes and closes the database. Call when the host is exiting.
    pub async fn shutdown(&self) {
        tracing::info!("engine shutting down");
        self.db.close().await;
    }
}

fn map_awareness(a: platform_windows::RawDpiAwareness) -> DpiAwareness {
    use platform_windows::RawDpiAwareness as Raw;
    match a {
        Raw::Unaware => DpiAwareness::Unaware,
        Raw::System => DpiAwareness::System,
        Raw::PerMonitor => DpiAwareness::PerMonitor,
        Raw::PerMonitorV2 => DpiAwareness::PerMonitorV2,
        Raw::Unknown => DpiAwareness::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use desktop_protocol::{AppearancePatch, FrontendErrorSource, SettingsSource, ThemeMode};

    async fn engine() -> (tempfile::TempDir, Arc<Engine>) {
        let tmp = tempfile::tempdir().unwrap();
        let engine = Engine::start(AppPaths::at(tmp.path().join("data")))
            .await
            .unwrap();
        (tmp, engine)
    }

    #[tokio::test]
    async fn starts_on_a_fresh_data_directory() {
        let (tmp, engine) = engine().await;
        assert!(tmp.path().join("data/database/desktop.db").exists());
        let diag = engine.diagnostics().await.unwrap();
        assert_eq!(diag.database.schema_version, Some(1));
        assert_eq!(diag.settings_source, SettingsSource::Defaults);
        assert_eq!(diag.app.protocol_version, PROTOCOL_VERSION);
        assert_eq!(diag.app.slug, "chira-launcher");
    }

    #[tokio::test]
    async fn settings_updates_are_announced_to_subscribers() {
        let (_tmp, engine) = engine().await;
        let mut rx = engine.subscribe();

        let patch = SettingsPatch {
            appearance: Some(AppearancePatch {
                theme: Some(ThemeMode::Light),
                ..Default::default()
            }),
        };
        let updated = engine.update_settings(patch).await.unwrap();

        match rx.recv().await.unwrap() {
            EngineEvent::SettingsChanged(s) => assert_eq!(s, updated),
            other => panic!("unexpected event {other:?}"),
        }
        assert_eq!(engine.settings().await.appearance.theme, ThemeMode::Light);
    }

    #[tokio::test]
    async fn a_rejected_patch_emits_nothing() {
        let (_tmp, engine) = engine().await;
        let mut rx = engine.subscribe();
        let bad = SettingsPatch {
            appearance: Some(AppearancePatch {
                accent: Some("nope".into()),
                ..Default::default()
            }),
        };
        assert!(engine.update_settings(bad).await.is_err());
        assert!(rx.try_recv().is_err());
    }

    #[tokio::test]
    async fn frontend_error_reports_are_rate_limited_and_counted() {
        let (_tmp, engine) = engine().await;
        for _ in 0..(MAX_FRONTEND_REPORTS_PER_MINUTE + 5) {
            engine.report_frontend_error(FrontendErrorReport {
                source: FrontendErrorSource::WindowError,
                message: "boom".into(),
                stack: None,
            });
        }
        assert_eq!(
            engine.diagnostics().await.unwrap().frontend_reports_dropped,
            5
        );
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn lists_the_real_monitors() {
        let (_tmp, engine) = engine().await;
        let displays = engine.displays().await.unwrap();
        assert!(displays.iter().any(|d| d.is_primary));
        assert!(
            displays
                .iter()
                .all(|d| d.dpi_scale >= 1.0 && d.bounds.width > 0)
        );
    }
}
