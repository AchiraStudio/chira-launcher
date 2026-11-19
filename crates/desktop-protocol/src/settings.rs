use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Persisted settings schema version. Bump together with a migration in `settings-manager`.
pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

/// Azure from the plan's starting tokens (§16.2).
pub const DEFAULT_ACCENT: &str = "#3979B9";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum ThemeMode {
    #[default]
    Dark,
    Light,
    System,
}

/// Visual quality profile, independent of game graphics settings (plan §16.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum QualityProfile {
    /// Minimal effects, no live blur over large areas.
    Performance,
    /// Normal glass and animation.
    #[default]
    Balanced,
    /// Advanced reflections, distortion, animated backgrounds.
    Ultra,
}

/// How motion is applied (plan §16.5: every animation respects reduced motion).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum MotionPreference {
    /// Follow the Windows "show animations" / reduced-motion preference.
    #[default]
    System,
    Reduced,
    Full,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct AppearanceSettings {
    pub theme: ThemeMode,
    /// `#RRGGBB`, upper-case. Validated by the engine.
    pub accent: String,
    pub quality_profile: QualityProfile,
    pub motion: MotionPreference,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: ThemeMode::default(),
            accent: DEFAULT_ACCENT.to_owned(),
            quality_profile: QualityProfile::default(),
            motion: MotionPreference::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct Settings {
    pub schema_version: u32,
    pub appearance: AppearanceSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: SETTINGS_SCHEMA_VERSION,
            appearance: AppearanceSettings::default(),
        }
    }
}

/// A partial update: only the fields that are present are changed.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct SettingsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub appearance: Option<AppearancePatch>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct AppearancePatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<ThemeMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality_profile: Option<QualityProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motion: Option<MotionPreference>,
}

/// Where the settings in memory were loaded from at startup. Surfaced in diagnostics so a
/// silent fallback to defaults is never invisible.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum SettingsSource {
    Database,
    RecoverySnapshot,
    Defaults,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_format_is_camel_case_and_kebab_enums() {
        let json = serde_json::to_value(Settings::default()).unwrap();
        assert_eq!(json["schemaVersion"], 1);
        assert_eq!(json["appearance"]["qualityProfile"], "balanced");
        assert_eq!(json["appearance"]["theme"], "dark");
        assert_eq!(json["appearance"]["accent"], DEFAULT_ACCENT);
    }

    #[test]
    fn older_snapshots_with_missing_fields_fill_in_defaults() {
        let parsed: Settings = serde_json::from_str(r#"{"appearance":{"theme":"light"}}"#).unwrap();
        assert_eq!(parsed.appearance.theme, ThemeMode::Light);
        assert_eq!(parsed.appearance.accent, DEFAULT_ACCENT);
        assert_eq!(parsed.schema_version, SETTINGS_SCHEMA_VERSION);
    }

    #[test]
    fn patch_omits_unset_fields() {
        let patch = SettingsPatch {
            appearance: Some(AppearancePatch {
                theme: Some(ThemeMode::Light),
                ..Default::default()
            }),
        };
        let json = serde_json::to_value(patch).unwrap();
        assert_eq!(json, serde_json::json!({"appearance": {"theme": "light"}}));
    }
}
