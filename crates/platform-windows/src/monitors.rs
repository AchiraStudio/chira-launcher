use desktop_core::EngineResult;

/// A rectangle in physical pixels, as Win32 reports it (edges, not size).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PixelRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

/// One monitor exactly as Windows reports it. `display-manager` turns this into the protocol model.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawMonitor {
    /// e.g. `\\.\DISPLAY1`.
    pub device_name: String,
    pub is_primary: bool,
    pub bounds: PixelRect,
    pub work_area: PixelRect,
    /// Effective DPI (96 = 100%). `None` if Windows could not report it.
    pub effective_dpi: Option<u32>,
    pub refresh_rate_hz: Option<u32>,
}

/// Lists the monitors attached to the desktop.
///
/// Values are only in true physical pixels when the process is per-monitor DPI aware; the Tauri
/// host is, and `process_dpi_awareness` lets diagnostics verify that.
pub fn enumerate_monitors() -> EngineResult<Vec<RawMonitor>> {
    imp::enumerate_monitors()
}

#[cfg(windows)]
mod imp {
    use super::{PixelRect, RawMonitor};
    use desktop_core::{EngineError, EngineResult};
    use std::mem::size_of;
    use windows::Win32::Foundation::{LPARAM, RECT};
    use windows::Win32::Graphics::Gdi::{
        DEVMODEW, ENUM_CURRENT_SETTINGS, EnumDisplayMonitors, EnumDisplaySettingsW,
        GetMonitorInfoW, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW,
    };
    use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
    use windows::core::BOOL;
    use windows::core::PCWSTR;

    const MONITORINFOF_PRIMARY: u32 = 1;

    pub fn enumerate_monitors() -> EngineResult<Vec<RawMonitor>> {
        let mut handles: Vec<HMONITOR> = Vec::new();

        // SAFETY: `collect_monitor` is a valid `MONITORENUMPROC`. The LPARAM is a pointer to
        // `handles`, which outlives this synchronous call, and the callback is the only code
        // that dereferences it, always as `*mut Vec<HMONITOR>`.
        let ok = unsafe {
            EnumDisplayMonitors(
                None,
                None,
                Some(collect_monitor),
                LPARAM(&mut handles as *mut Vec<HMONITOR> as isize),
            )
        };
        if !ok.as_bool() {
            return Err(EngineError::Platform("EnumDisplayMonitors failed".into()));
        }

        handles.into_iter().map(describe).collect()
    }

    // SAFETY (contract): only ever passed to `EnumDisplayMonitors` by `enumerate_monitors`, which
    // supplies a `data` pointer to a live `Vec<HMONITOR>` as the callback's `LPARAM`.
    unsafe extern "system" fn collect_monitor(
        monitor: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        data: LPARAM,
    ) -> BOOL {
        // SAFETY: `data` was created in `enumerate_monitors` from `&mut Vec<HMONITOR>` that is
        // alive for the whole enumeration, and Windows invokes this callback synchronously on the
        // same thread, so there is no aliasing.
        let handles = unsafe { &mut *(data.0 as *mut Vec<HMONITOR>) };
        handles.push(monitor);
        BOOL(1) // continue enumeration
    }

    fn describe(monitor: HMONITOR) -> EngineResult<RawMonitor> {
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;

        // SAFETY: `info` is a properly initialised MONITORINFOEXW with `cbSize` set to its size;
        // a pointer to the leading MONITORINFO is the documented way to pass the EX variant.
        let ok = unsafe {
            GetMonitorInfoW(
                monitor,
                &mut info as *mut MONITORINFOEXW as *mut MONITORINFO,
            )
        };
        if !ok.as_bool() {
            return Err(EngineError::Platform("GetMonitorInfoW failed".into()));
        }

        let name_len = info
            .szDevice
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(info.szDevice.len());
        let device_name = String::from_utf16_lossy(&info.szDevice[..name_len]);

        let (mut dpi_x, mut dpi_y) = (0u32, 0u32);
        // SAFETY: `monitor` is a handle just returned by EnumDisplayMonitors; the out-pointers
        // reference live locals.
        let effective_dpi =
            unsafe { GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y) }
                .ok()
                .map(|()| dpi_x)
                .filter(|&dpi| dpi > 0);

        Ok(RawMonitor {
            refresh_rate_hz: refresh_rate(&info.szDevice),
            device_name,
            is_primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
            bounds: rect(info.monitorInfo.rcMonitor),
            work_area: rect(info.monitorInfo.rcWork),
            effective_dpi,
        })
    }

    fn refresh_rate(device: &[u16; 32]) -> Option<u32> {
        let mut mode = DEVMODEW {
            dmSize: size_of::<DEVMODEW>() as u16,
            ..Default::default()
        };
        // SAFETY: `device` is a NUL-terminated UTF-16 device name filled in by GetMonitorInfoW and
        // `mode` is initialised with `dmSize`, as EnumDisplaySettingsW requires.
        let ok = unsafe {
            EnumDisplaySettingsW(PCWSTR(device.as_ptr()), ENUM_CURRENT_SETTINGS, &mut mode)
        };
        // 0 and 1 mean "hardware default" rather than a real rate.
        ok.as_bool()
            .then_some(mode.dmDisplayFrequency)
            .filter(|&hz| hz > 1)
    }

    fn rect(r: RECT) -> PixelRect {
        PixelRect {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::RawMonitor;
    use desktop_core::{EngineError, EngineResult};

    pub fn enumerate_monitors() -> EngineResult<Vec<RawMonitor>> {
        Err(EngineError::Unsupported("monitor enumeration".into()))
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn the_desktop_has_exactly_one_primary_monitor() {
        let monitors =
            enumerate_monitors().expect("enumeration should succeed on a Windows desktop");
        assert!(!monitors.is_empty(), "expected at least one monitor");
        assert_eq!(monitors.iter().filter(|m| m.is_primary).count(), 1);
        for m in &monitors {
            assert!(
                m.bounds.right > m.bounds.left && m.bounds.bottom > m.bounds.top,
                "{m:?}"
            );
            assert!(m.device_name.starts_with(r"\\.\"), "{m:?}");
        }
    }
}
