use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::settings::SettingsSource;

/// Per-monitor DPI awareness of the host process. Per-monitor v2 is required for correct
/// physical-pixel placement on mixed-DPI setups (plan §8.1, risk "Multi-monitor DPI").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum DpiAwareness {
    Unaware,
    System,
    PerMonitor,
    PerMonitorV2,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SystemInfo {
    /// e.g. "Windows 11".
    pub os_name: String,
    pub os_version: String,
    pub os_build: u32,
    pub dpi_awareness: DpiAwareness,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct AppInfo {
    pub name: String,
    pub slug: String,
    pub identifier: String,
    pub version: String,
    pub protocol_version: u32,
    /// Absent when the platform query is unsupported or failed (see the log).
    pub system: Option<SystemInfo>,
}

/// Locations shown in the System settings page. Strings because these are display-only.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PathsInfo {
    pub data_dir: String,
    pub logs_dir: String,
    pub database_file: String,
    pub recovery_dir: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct DatabaseStatus {
    /// Highest applied migration.
    pub schema_version: Option<u32>,
    /// File name of a corrupt database that was set aside at startup, if any.
    pub quarantined_previous: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Diagnostics {
    pub app: AppInfo,
    pub paths: PathsInfo,
    pub database: DatabaseStatus,
    pub settings_source: SettingsSource,
    pub uptime_seconds: u32,
    /// Frontend error reports discarded by the rate limiter since startup.
    pub frontend_reports_dropped: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum FrontendErrorSource {
    ErrorBoundary,
    WindowError,
    UnhandledRejection,
}

/// A crash report from the shell UI, written to the engine log so UI failures are diagnosable
/// without a debugger. Size-capped and rate-limited by the engine (plan §20.2).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct FrontendErrorReport {
    pub source: FrontendErrorSource,
    pub message: String,
    pub stack: Option<String>,
}
