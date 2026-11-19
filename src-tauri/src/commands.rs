//! The typed command surface (plan §20.2, HR-A6). Every command is a one-line adapter over an
//! [`Engine`] method; there is intentionally no generic "run anything" command.

use std::sync::Arc;

use desktop_engine::Engine;
use desktop_protocol::{
    AppInfo, Diagnostics, Display, FrontendErrorReport, ProtocolError, Settings, SettingsPatch,
};
use tauri::State;

type EngineState<'a> = State<'a, Arc<Engine>>;
type CommandResult<T> = Result<T, ProtocolError>;

/// Logs the full error (it may contain paths) and returns the frontend-safe form.
fn fail(command: &str, err: desktop_core::EngineError) -> ProtocolError {
    tracing::error!(command, %err, "command failed");
    ProtocolError::from(&err)
}

#[tauri::command]
pub fn get_app_info(engine: EngineState<'_>) -> AppInfo {
    engine.app_info()
}

#[tauri::command]
pub async fn get_settings(engine: EngineState<'_>) -> CommandResult<Settings> {
    Ok(engine.settings().await)
}

#[tauri::command]
pub async fn update_settings(
    engine: EngineState<'_>,
    patch: SettingsPatch,
) -> CommandResult<Settings> {
    engine
        .update_settings(patch)
        .await
        .map_err(|e| fail("update_settings", e))
}

#[tauri::command]
pub async fn list_displays(engine: EngineState<'_>) -> CommandResult<Vec<Display>> {
    engine
        .displays()
        .await
        .map_err(|e| fail("list_displays", e))
}

#[tauri::command]
pub async fn refresh_displays(engine: EngineState<'_>) -> CommandResult<Vec<Display>> {
    engine
        .refresh_displays()
        .await
        .map_err(|e| fail("refresh_displays", e))
}

#[tauri::command]
pub async fn get_diagnostics(engine: EngineState<'_>) -> CommandResult<Diagnostics> {
    engine
        .diagnostics()
        .await
        .map_err(|e| fail("get_diagnostics", e))
}

#[tauri::command]
pub fn report_frontend_error(engine: EngineState<'_>, report: FrontendErrorReport) {
    engine.report_frontend_error(report);
}
