//! Tauri application host — a **thin adapter** (HR-A3). It owns no business logic: commands call
//! [`desktop_engine::Engine`], and engine events are forwarded to the webview.

mod bridge;
mod commands;

use std::sync::Arc;

use desktop_core::AppPaths;
use desktop_core::identity::PRODUCT_NAME;
use desktop_engine::Engine;
use tauri::{Manager, RunEvent};

/// Starts logging, the engine and the Tauri event loop. Never returns on success.
pub fn run() {
    if let Err(message) = try_run() {
        // Release builds have no console; make sure a startup failure is visible.
        eprintln!("{PRODUCT_NAME} failed to start: {message}");
        platform_windows::show_fatal_error(&format!("{PRODUCT_NAME} could not start"), &message);
        std::process::exit(1);
    }
}

fn try_run() -> Result<(), String> {
    let paths = AppPaths::resolve().map_err(|e| e.to_string())?;
    paths.ensure_created().map_err(|e| e.to_string())?;
    // Keep the guard alive for the whole process so buffered log lines are flushed on exit.
    let _log_guard = desktop_engine::init_logging(&paths).map_err(|e| e.to_string())?;

    let engine = tauri::async_runtime::block_on(Engine::start(paths)).map_err(|e| {
        tracing::error!(%e, "engine failed to start");
        format!("{e}\n\nDetails were written to the log file.")
    })?;

    let app = tauri::Builder::default()
        .manage(Arc::clone(&engine))
        .setup(|app| {
            let engine = Arc::clone(app.state::<Arc<Engine>>().inner());
            bridge::spawn_event_bridge(app.handle().clone(), engine.subscribe());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_settings,
            commands::update_settings,
            commands::list_displays,
            commands::refresh_displays,
            commands::get_diagnostics,
            commands::report_frontend_error,
        ])
        .build(tauri::generate_context!())
        .map_err(|e| {
            tracing::error!(%e, "tauri failed to build the application");
            format!("{e}\n\nDetails were written to the log file.")
        })?;

    app.run(move |_handle, event| {
        if let RunEvent::Exit = event {
            tauri::async_runtime::block_on(engine.shutdown());
        }
    });
    Ok(())
}
