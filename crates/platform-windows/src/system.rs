use desktop_core::EngineResult;

/// Windows version as reported by `RtlGetVersion` (not subject to manifest-based version lies).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OsVersion {
    pub major: u32,
    pub minor: u32,
    pub build: u32,
}

impl OsVersion {
    /// Windows 11 reports major 10 with build >= 22000.
    pub fn is_windows_11(&self) -> bool {
        self.major >= 10 && self.build >= 22000
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RawDpiAwareness {
    Unaware,
    System,
    PerMonitor,
    PerMonitorV2,
    Unknown,
}

pub fn os_version() -> EngineResult<OsVersion> {
    imp::os_version()
}

/// DPI awareness of the calling thread (equal to the process default for the host).
pub fn process_dpi_awareness() -> EngineResult<RawDpiAwareness> {
    imp::process_dpi_awareness()
}

#[cfg(windows)]
mod imp {
    use super::{OsVersion, RawDpiAwareness};
    use desktop_core::{EngineError, EngineResult};
    use std::mem::size_of;
    use windows::Wdk::System::SystemServices::RtlGetVersion;
    use windows::Win32::System::SystemInformation::OSVERSIONINFOW;
    use windows::Win32::UI::HiDpi::{
        AreDpiAwarenessContextsEqual, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE,
        DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, DPI_AWARENESS_CONTEXT_SYSTEM_AWARE,
        DPI_AWARENESS_CONTEXT_UNAWARE, GetThreadDpiAwarenessContext,
    };

    pub fn os_version() -> EngineResult<OsVersion> {
        let mut info = OSVERSIONINFOW {
            dwOSVersionInfoSize: size_of::<OSVERSIONINFOW>() as u32,
            ..Default::default()
        };
        // SAFETY: `info` is initialised with `dwOSVersionInfoSize`, and RtlGetVersion only writes
        // within that structure.
        let status = unsafe { RtlGetVersion(&mut info) };
        if status.is_err() {
            return Err(EngineError::Platform(format!(
                "RtlGetVersion failed ({:#x})",
                status.0
            )));
        }
        Ok(OsVersion {
            major: info.dwMajorVersion,
            minor: info.dwMinorVersion,
            build: info.dwBuildNumber,
        })
    }

    pub fn process_dpi_awareness() -> EngineResult<RawDpiAwareness> {
        // SAFETY: both calls take/return plain handle values with no pointer arguments to uphold.
        let current = unsafe { GetThreadDpiAwarenessContext() };
        let is = |other| {
            // SAFETY: as above; the constants are valid pseudo-handles.
            unsafe { AreDpiAwarenessContextsEqual(current, other) }.as_bool()
        };
        Ok(if is(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) {
            RawDpiAwareness::PerMonitorV2
        } else if is(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE) {
            RawDpiAwareness::PerMonitor
        } else if is(DPI_AWARENESS_CONTEXT_SYSTEM_AWARE) {
            RawDpiAwareness::System
        } else if is(DPI_AWARENESS_CONTEXT_UNAWARE) {
            RawDpiAwareness::Unaware
        } else {
            RawDpiAwareness::Unknown
        })
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{OsVersion, RawDpiAwareness};
    use desktop_core::{EngineError, EngineResult};

    pub fn os_version() -> EngineResult<OsVersion> {
        Err(EngineError::Unsupported("Windows version query".into()))
    }

    pub fn process_dpi_awareness() -> EngineResult<RawDpiAwareness> {
        Err(EngineError::Unsupported("DPI awareness query".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::OsVersion;

    #[test]
    fn windows_11_is_detected_by_build_number() {
        assert!(
            OsVersion {
                major: 10,
                minor: 0,
                build: 22631
            }
            .is_windows_11()
        );
        assert!(
            !OsVersion {
                major: 10,
                minor: 0,
                build: 19045
            }
            .is_windows_11()
        );
    }

    #[cfg(windows)]
    #[test]
    fn reports_a_plausible_windows_version() {
        let v = super::os_version().unwrap();
        assert!(v.major >= 10, "{v:?}");
        assert!(v.build >= 10240, "{v:?}");
    }
}
