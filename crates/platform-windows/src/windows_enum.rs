use desktop_core::EngineResult;

use crate::monitors::PixelRect;

/// One top-level window exactly as Windows reports it. **Unfiltered**: `window-manager` decides
/// which of these are real application windows. Read-only — nothing here can modify a window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawWindow {
    /// The `HWND` value. Valid only right now: handles are reused and die (HR-W5).
    pub handle: isize,
    pub pid: u32,
    pub title: String,
    pub class_name: String,
    /// Full path of the owning executable; `None` when the process cannot be opened
    /// (for example an elevated process — UIPI — or one that just exited).
    pub exe_path: Option<String>,
    pub rect: PixelRect,
    pub is_visible: bool,
    pub is_minimized: bool,
    /// DWM "cloaked": hidden by the system, e.g. a suspended UWP window or one on another virtual desktop.
    pub is_cloaked: bool,
    pub is_tool_window: bool,
    pub has_owner: bool,
    pub is_foreground: bool,
}

/// Enumerates every top-level window, front to back (Z-order). Never blocks on other processes'
/// message loops: it only reads attributes.
pub fn enumerate_windows() -> EngineResult<Vec<RawWindow>> {
    imp::enumerate_windows()
}

/// Process id of this process, used to exclude the shell's own windows.
pub fn current_process_id() -> u32 {
    std::process::id()
}

#[cfg(windows)]
mod imp {
    use super::RawWindow;
    use crate::monitors::PixelRect;
    use desktop_core::{EngineError, EngineResult};
    use std::ffi::c_void;
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
    use windows::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute};
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
        QueryFullProcessImageNameW,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GW_OWNER, GWL_EXSTYLE, GetClassNameW, GetForegroundWindow, GetWindow,
        GetWindowLongW, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId, IsIconic, IsWindowVisible, WS_EX_TOOLWINDOW,
    };
    use windows::core::{BOOL, PWSTR};

    pub fn enumerate_windows() -> EngineResult<Vec<RawWindow>> {
        let mut handles: Vec<HWND> = Vec::new();

        // SAFETY: `collect_window` is a valid `WNDENUMPROC`. The LPARAM is a pointer to
        // `handles`, which outlives this synchronous call; only the callback dereferences it,
        // always as `*mut Vec<HWND>`.
        unsafe {
            EnumWindows(
                Some(collect_window),
                LPARAM(&mut handles as *mut Vec<HWND> as isize),
            )
        }
        .map_err(|e| EngineError::Platform(format!("EnumWindows failed: {e}")))?;

        // SAFETY: GetForegroundWindow takes no arguments and only returns a handle value.
        let foreground = unsafe { GetForegroundWindow() };

        Ok(handles
            .into_iter()
            .map(|hwnd| describe(hwnd, hwnd == foreground))
            .collect())
    }

    // SAFETY (contract): only ever passed to `EnumWindows` by `enumerate_windows`, which supplies a
    // pointer to a live `Vec<HWND>` as the callback's `LPARAM`.
    unsafe extern "system" fn collect_window(hwnd: HWND, data: LPARAM) -> BOOL {
        // SAFETY: `data` was created in `enumerate_windows` from `&mut Vec<HWND>` that is alive for
        // the whole enumeration, and the callback runs synchronously on the same thread.
        let handles = unsafe { &mut *(data.0 as *mut Vec<HWND>) };
        handles.push(hwnd);
        BOOL(1) // continue enumeration
    }

    fn describe(hwnd: HWND, is_foreground: bool) -> RawWindow {
        let mut pid = 0u32;
        // SAFETY: `hwnd` came from EnumWindows moments ago; a dead handle only makes the call
        // return 0, and `pid` is a live local.
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };

        // SAFETY: plain attribute reads on a window handle; all are safe to call with a stale handle
        // (they fail or return defaults rather than faulting).
        let (visible, minimized, ex_style, has_owner) = unsafe {
            (
                IsWindowVisible(hwnd).as_bool(),
                IsIconic(hwnd).as_bool(),
                GetWindowLongW(hwnd, GWL_EXSTYLE) as u32,
                GetWindow(hwnd, GW_OWNER).is_ok_and(|owner| !owner.0.is_null()),
            )
        };

        let mut rect = RECT::default();
        // SAFETY: `rect` is a live local of the type the API expects.
        let rect = unsafe { GetWindowRect(hwnd, &mut rect) }
            .map(|()| PixelRect {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            })
            .unwrap_or(PixelRect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            });

        RawWindow {
            handle: hwnd.0 as isize,
            pid,
            title: window_text(hwnd),
            class_name: class_name(hwnd),
            exe_path: exe_path(pid),
            rect,
            is_visible: visible,
            is_minimized: minimized,
            is_cloaked: is_cloaked(hwnd),
            is_tool_window: ex_style & WS_EX_TOOLWINDOW.0 != 0,
            has_owner,
            is_foreground,
        }
    }

    fn window_text(hwnd: HWND) -> String {
        // SAFETY: reads the title length of a window handle; stale handles yield 0.
        let len = unsafe { GetWindowTextLengthW(hwnd) };
        if len <= 0 {
            return String::new();
        }
        let mut buffer = vec![0u16; len as usize + 1];
        // SAFETY: `buffer` is a live, writable slice; the API writes at most `buffer.len()` units.
        let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        String::from_utf16_lossy(&buffer[..usize::try_from(copied).unwrap_or(0)])
    }

    fn class_name(hwnd: HWND) -> String {
        let mut buffer = [0u16; 256];
        // SAFETY: `buffer` is a live, writable slice; the API writes at most `buffer.len()` units.
        let copied = unsafe { GetClassNameW(hwnd, &mut buffer) };
        String::from_utf16_lossy(&buffer[..usize::try_from(copied).unwrap_or(0)])
    }

    fn is_cloaked(hwnd: HWND) -> bool {
        let mut cloaked = 0u32;
        // SAFETY: the out-pointer references a live u32 and the size passed matches it exactly.
        let result = unsafe {
            DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut u32 as *mut c_void,
                std::mem::size_of::<u32>() as u32,
            )
        };
        result.is_ok() && cloaked != 0
    }

    fn exe_path(pid: u32) -> Option<String> {
        if pid == 0 {
            return None;
        }
        // SAFETY: requests the least-privileged query right; failure (e.g. elevated target) is an
        // ordinary `Err`, handled by returning `None`.
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;

        let mut buffer = vec![0u16; 1024];
        let mut length = buffer.len() as u32;
        // SAFETY: `process` is a valid handle opened above; `buffer`/`length` describe a live,
        // writable buffer and the API updates `length` to the number of units written.
        let queried = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
        };
        // SAFETY: closes the handle opened above exactly once. A failed close leaves nothing to
        // recover, so the result is intentionally not acted on.
        let _ = unsafe { CloseHandle(process) };

        queried
            .ok()
            .map(|()| String::from_utf16_lossy(&buffer[..length as usize]))
    }
}

#[cfg(not(windows))]
mod imp {
    use super::RawWindow;
    use desktop_core::{EngineError, EngineResult};

    pub fn enumerate_windows() -> EngineResult<Vec<RawWindow>> {
        Err(EngineError::Unsupported("window enumeration".into()))
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn enumeration_succeeds_and_reports_sane_values() {
        let windows = enumerate_windows().expect("EnumWindows should succeed");
        // A desktop session always has the shell's own windows, even if headless CI has no apps.
        for w in &windows {
            assert!(w.pid > 0 || w.handle != 0, "{w:?}");
            assert!(w.rect.right >= w.rect.left || !w.is_visible, "{w:?}");
        }
        assert!(windows.iter().filter(|w| w.is_foreground).count() <= 1);
    }
}
