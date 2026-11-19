//! Product identity. Derived from the repository folder name (`project-chira-launcher`); never invent
//! an unrelated name (HR-Q6). Keep in sync with `src-tauri/tauri.conf.json` and the root `package.json`.

/// Human-facing product name (window title, splash, documentation).
pub const PRODUCT_NAME: &str = "Chira Launcher";
/// Machine-friendly slug (package names, log file prefix).
pub const PRODUCT_SLUG: &str = "chira-launcher";
/// Reverse-DNS application identifier (Tauri bundle identifier).
pub const APP_IDENTIFIER: &str = "com.chira.launcher";
/// Directory under `%LOCALAPPDATA%` that holds all user data (plan §17).
pub const DATA_DIR_NAME: &str = "ChiraLauncher";
/// Environment variable that relocates the data directory (development and tests only).
pub const DATA_DIR_ENV: &str = "CHIRA_LAUNCHER_DATA_DIR";
/// Environment variable that overrides the log filter, e.g. `CHIRA_LOG=debug`.
pub const LOG_FILTER_ENV: &str = "CHIRA_LOG";
