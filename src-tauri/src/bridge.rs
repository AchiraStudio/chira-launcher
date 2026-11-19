use desktop_protocol::{ENGINE_EVENT_CHANNEL, EngineEvent};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast::{self, error::RecvError};

/// Forwards every [`EngineEvent`] to all webviews on [`ENGINE_EVENT_CHANNEL`].
///
/// A subscriber that lags loses old events, which is safe: every event carries complete state.
pub fn spawn_event_bridge(app: AppHandle, mut events: broadcast::Receiver<EngineEvent>) {
    tauri::async_runtime::spawn(async move {
        loop {
            match events.recv().await {
                Ok(event) => {
                    if let Err(err) = app.emit(ENGINE_EVENT_CHANNEL, &event) {
                        tracing::warn!(%err, "failed to deliver an engine event to the webview");
                    }
                }
                Err(RecvError::Lagged(missed)) => {
                    tracing::warn!(missed, "event bridge lagged; some events were skipped");
                }
                Err(RecvError::Closed) => break,
            }
        }
    });
}
