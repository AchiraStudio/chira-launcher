//! The typed command surface (plan §20.2, HR-A6). Every command is a one-line adapter over an
//! [`Engine`] method; there is intentionally no generic "run anything" command.

use std::sync::Arc;

use desktop_engine::Engine;
use desktop_protocol::{
    AppInfo, DesktopWindow, Diagnostics, Display, ErrorCode, FrontendErrorReport, ProtocolError,
    Settings, SettingsPatch, ShellWindowMode,
};
use tauri::{AppHandle, State, WebviewWindow};

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

#[tauri::command]
pub async fn list_windows(engine: EngineState<'_>) -> CommandResult<Vec<DesktopWindow>> {
    engine.windows().await.map_err(|e| fail("list_windows", e))
}

// --- The shell's own window -------------------------------------------------------------------
// Native window coordination belongs to the host layer (plan §4.1). These touch only the shell's
// own window; managing other applications' windows is the engine's `window-manager`.

fn window_failure(command: &str, err: tauri::Error) -> ProtocolError {
    tracing::error!(command, %err, "window operation failed");
    ProtocolError {
        code: ErrorCode::Platform,
        message: "The window could not be changed. See the log for details.".to_owned(),
    }
}

fn mode_of(window: &WebviewWindow) -> Result<ShellWindowMode, tauri::Error> {
    Ok(if window.is_fullscreen()? {
        ShellWindowMode::Fullscreen
    } else {
        ShellWindowMode::Windowed
    })
}

#[tauri::command]
pub fn get_window_mode(window: WebviewWindow) -> CommandResult<ShellWindowMode> {
    mode_of(&window).map_err(|e| window_failure("get_window_mode", e))
}

/// Switches the shell between borderless fullscreen and a normal window. The shell always
/// *launches* fullscreen; windowed mode exists so the user can never be locked into it.
#[tauri::command]
pub fn set_window_mode(
    window: WebviewWindow,
    mode: ShellWindowMode,
) -> CommandResult<ShellWindowMode> {
    window
        .set_fullscreen(mode == ShellWindowMode::Fullscreen)
        .map_err(|e| window_failure("set_window_mode", e))?;
    mode_of(&window).map_err(|e| window_failure("set_window_mode", e))
}

/// Quits the shell. The engine shuts down cleanly via the host's exit handler.
#[tauri::command]
pub fn exit_app(app: AppHandle) {
    tracing::info!("exit requested by the user");
    app.exit(0);
}
