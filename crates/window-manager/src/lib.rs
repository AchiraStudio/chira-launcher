//! `window-manager` owns native window operations (HR-A5).
//!
//! **Scope today (M01, first step): read-only discovery.** It lists the real application windows
//! on the desktop. It does not move, restyle, focus, hide or close anything — those operations
//! arrive with their own milestones and must save original state first (HR-W6) and validate window
//! *and* process identity before acting (HR-W5).
//!
//! TODO(M01): event-driven discovery with `SetWinEventHook` + periodic reconciliation (plan §5.2);
//! today the list is read on demand.

mod filter;
mod naming;

use std::sync::Arc;

use desktop_core::{EngineError, EngineResult};
use desktop_protocol::DesktopWindow;
use platform_windows::RawWindow;

pub use filter::is_application_window;
pub use naming::app_name;

/// Where raw window data comes from. Production asks Windows; tests script it.
pub trait WindowSource: Send + Sync + 'static {
    fn enumerate(&self) -> EngineResult<Vec<RawWindow>>;
}

/// The real thing: `EnumWindows` via `platform-windows`.
pub struct SystemWindowSource;

impl WindowSource for SystemWindowSource {
    fn enumerate(&self) -> EngineResult<Vec<RawWindow>> {
        platform_windows::enumerate_windows()
    }
}

pub struct WindowManager {
    source: Arc<dyn WindowSource>,
    own_pid: u32,
}

impl WindowManager {
    /// Manager over the real window list. The shell's own windows are excluded.
    pub fn new() -> Self {
        Self::with_source(
            Arc::new(SystemWindowSource),
            platform_windows::current_process_id(),
        )
    }

    pub fn with_source(source: Arc<dyn WindowSource>, own_pid: u32) -> Self {
        Self { source, own_pid }
    }

    /// Application windows, front to back. Runs the Win32 enumeration off the async executor.
    pub async fn list(&self) -> EngineResult<Vec<DesktopWindow>> {
        let source = Arc::clone(&self.source);
        let own_pid = self.own_pid;
        tokio::task::spawn_blocking(move || {
            source.enumerate().map(|raw| {
                raw.into_iter()
                    .filter(|w| is_application_window(w, own_pid))
                    .map(to_desktop_window)
                    .collect()
            })
        })
        .await
        .map_err(|e| EngineError::Internal(format!("window enumeration task failed: {e}")))?
    }
}

impl Default for WindowManager {
    fn default() -> Self {
        Self::new()
    }
}

fn to_desktop_window(w: RawWindow) -> DesktopWindow {
    let exe_name = w
        .exe_path
        .as_deref()
        .and_then(|p| p.rsplit(['\\', '/']).next())
        .filter(|name| !name.is_empty())
        .map(str::to_owned);

    DesktopWindow {
        id: format!("{:x}", w.handle),
        pid: w.pid,
        app_name: app_name(exe_name.as_deref(), &w.title),
        exe_name,
        bounds: desktop_protocol::Rect {
            x: w.rect.left,
            y: w.rect.top,
            width: u32::try_from(w.rect.right.saturating_sub(w.rect.left)).unwrap_or(0),
            height: u32::try_from(w.rect.bottom.saturating_sub(w.rect.top)).unwrap_or(0),
        },
        title: w.title,
        is_minimized: w.is_minimized,
        is_foreground: w.is_foreground,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use platform_windows::PixelRect;

    pub(crate) fn raw(handle: isize, pid: u32, title: &str, exe: Option<&str>) -> RawWindow {
        RawWindow {
            handle,
            pid,
            title: title.into(),
            class_name: "Chrome_WidgetWin_1".into(),
            exe_path: exe.map(str::to_owned),
            rect: PixelRect {
                left: 10,
                top: 20,
                right: 810,
                bottom: 620,
            },
            is_visible: true,
            is_minimized: false,
            is_cloaked: false,
            is_tool_window: false,
            has_owner: false,
            is_foreground: false,
        }
    }

    struct Scripted(Vec<RawWindow>);
    impl WindowSource for Scripted {
        fn enumerate(&self) -> EngineResult<Vec<RawWindow>> {
            Ok(self.0.clone())
        }
    }

    #[tokio::test]
    async fn lists_only_application_windows_in_z_order_and_hides_paths() {
        let mut tool = raw(3, 300, "Tooltip", Some(r"C:\x\tool.exe"));
        tool.is_tool_window = true;
        let mut fg = raw(
            1,
            100,
            "Doc - Notepad",
            Some(r"C:\Windows\System32\notepad.exe"),
        );
        fg.is_foreground = true;
        let own = raw(2, 999, "Chira Launcher", Some(r"C:\app\chira-launcher.exe"));

        let manager = WindowManager::with_source(
            Arc::new(Scripted(vec![
                fg,
                own,
                tool,
                raw(4, 400, "Inbox", Some(r"C:\Mail\mail.exe")),
            ])),
            999,
        );
        let windows = manager.list().await.unwrap();

        let titles: Vec<_> = windows.iter().map(|w| w.title.as_str()).collect();
        assert_eq!(titles, ["Doc - Notepad", "Inbox"]);
        assert!(windows[0].is_foreground);
        assert_eq!(windows[0].id, "1");
        assert_eq!(windows[0].exe_name.as_deref(), Some("notepad.exe"));
        assert_eq!(windows[0].app_name, "Notepad");
        assert_eq!(
            (windows[0].bounds.width, windows[0].bounds.height),
            (800, 600)
        );
        for w in &windows {
            assert!(
                !w.exe_name.as_deref().unwrap_or("").contains('\\'),
                "full paths must not leave the engine"
            );
        }
    }

    #[tokio::test]
    async fn enumeration_errors_are_returned_not_swallowed() {
        struct Failing;
        impl WindowSource for Failing {
            fn enumerate(&self) -> EngineResult<Vec<RawWindow>> {
                Err(EngineError::Platform("nope".into()))
            }
        }
        let manager = WindowManager::with_source(Arc::new(Failing), 1);
        assert!(manager.list().await.is_err());
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn the_real_desktop_can_be_listed() {
        // No assumption about which apps are open; only that the call works and our own process
        // (the test binary) is never reported.
        let windows = WindowManager::new().list().await.unwrap();
        assert!(windows.iter().all(|w| w.pid != std::process::id()));
        assert!(windows.iter().all(|w| !w.title.is_empty()));
    }
}
