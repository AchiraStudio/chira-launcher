//! `display-manager` owns monitor discovery (HR-A5). It turns what Windows reports into the
//! protocol's [`Display`] model and tells callers whether anything changed.
//!
//! Detection is pull-based for now (`refresh`). Event-driven topology change handling with
//! debouncing (`WM_DISPLAYCHANGE`) belongs to M03; this crate is where it will plug in.

mod mapping;
mod source;

use std::sync::{Arc, Mutex, MutexGuard};

use desktop_core::{EngineError, EngineResult};
use desktop_protocol::Display;

pub use mapping::map_monitors;
pub use source::{MonitorSource, SystemMonitorSource};

/// Result of a [`DisplayManager::refresh`].
#[derive(Debug, Clone, PartialEq)]
pub struct DisplayRefresh {
    pub displays: Vec<Display>,
    /// `true` when the list differs from the previous snapshot (or there was none).
    pub changed: bool,
}

#[derive(Default)]
struct State {
    /// `None` until the first successful refresh.
    snapshot: Option<Vec<Display>>,
}

pub struct DisplayManager {
    source: Arc<dyn MonitorSource>,
    state: Mutex<State>,
}

impl DisplayManager {
    /// Manager backed by the real Windows monitor list.
    pub fn new() -> Self {
        Self::with_source(Arc::new(SystemMonitorSource))
    }

    /// Manager backed by any [`MonitorSource`] (used by tests).
    pub fn with_source(source: Arc<dyn MonitorSource>) -> Self {
        Self {
            source,
            state: Mutex::new(State::default()),
        }
    }

    /// Re-enumerates monitors off the async executor and updates the snapshot.
    pub async fn refresh(&self) -> EngineResult<DisplayRefresh> {
        let source = Arc::clone(&self.source);
        let raw = tokio::task::spawn_blocking(move || source.enumerate())
            .await
            .map_err(|e| {
                EngineError::Internal(format!("monitor enumeration task failed: {e}"))
            })??;

        let displays = map_monitors(raw);
        let mut state = self.lock();
        let changed = state.snapshot.as_ref() != Some(&displays);
        if changed {
            tracing::info!(count = displays.len(), "display topology updated");
        }
        state.snapshot = Some(displays.clone());
        Ok(DisplayRefresh { displays, changed })
    }

    /// The last known list, enumerating first if no refresh has succeeded yet.
    pub async fn current(&self) -> EngineResult<Vec<Display>> {
        if let Some(snapshot) = self.lock().snapshot.clone() {
            return Ok(snapshot);
        }
        Ok(self.refresh().await?.displays)
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        // A poisoned lock only means another thread panicked mid-update; the snapshot is still a
        // complete value, so recover it rather than propagating the panic.
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl Default for DisplayManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use platform_windows::{PixelRect, RawMonitor};
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A scripted source: each call returns the next prepared monitor list.
    struct Scripted {
        steps: Vec<EngineResult<Vec<RawMonitor>>>,
        calls: AtomicUsize,
    }

    impl MonitorSource for Scripted {
        fn enumerate(&self) -> EngineResult<Vec<RawMonitor>> {
            let i = self
                .calls
                .fetch_add(1, Ordering::SeqCst)
                .min(self.steps.len() - 1);
            match &self.steps[i] {
                Ok(v) => Ok(v.clone()),
                Err(_) => Err(EngineError::Platform("scripted failure".into())),
            }
        }
    }

    fn monitor(name: &str, primary: bool, width: i32) -> RawMonitor {
        let rect = PixelRect {
            left: 0,
            top: 0,
            right: width,
            bottom: 1080,
        };
        RawMonitor {
            device_name: name.into(),
            is_primary: primary,
            bounds: rect,
            work_area: rect,
            effective_dpi: Some(96),
            refresh_rate_hz: Some(60),
        }
    }

    fn manager(steps: Vec<EngineResult<Vec<RawMonitor>>>) -> DisplayManager {
        DisplayManager::with_source(Arc::new(Scripted {
            steps,
            calls: AtomicUsize::new(0),
        }))
    }

    #[tokio::test]
    async fn first_refresh_is_a_change_and_an_identical_one_is_not() {
        let m = manager(vec![Ok(vec![monitor(r"\\.\DISPLAY1", true, 1920)])]);
        assert!(m.refresh().await.unwrap().changed);
        assert!(!m.refresh().await.unwrap().changed);
    }

    #[tokio::test]
    async fn a_resolution_change_is_detected() {
        let m = manager(vec![
            Ok(vec![monitor(r"\\.\DISPLAY1", true, 1920)]),
            Ok(vec![monitor(r"\\.\DISPLAY1", true, 2560)]),
        ]);
        m.refresh().await.unwrap();
        let second = m.refresh().await.unwrap();
        assert!(second.changed);
        assert_eq!(second.displays[0].bounds.width, 2560);
    }

    #[tokio::test]
    async fn current_enumerates_once_then_serves_the_snapshot() {
        let source = Arc::new(Scripted {
            steps: vec![Ok(vec![monitor(r"\\.\DISPLAY1", true, 1920)])],
            calls: AtomicUsize::new(0),
        });
        let m = DisplayManager::with_source(source.clone());
        m.current().await.unwrap();
        m.current().await.unwrap();
        assert_eq!(source.calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn enumeration_failure_is_returned_and_keeps_the_old_snapshot() {
        let m = manager(vec![
            Ok(vec![monitor(r"\\.\DISPLAY1", true, 1920)]),
            Err(EngineError::Platform("x".into())),
        ]);
        m.refresh().await.unwrap();
        assert!(m.refresh().await.is_err());
        assert_eq!(m.current().await.unwrap().len(), 1);
    }
}
