use desktop_core::EngineResult;
use platform_windows::RawMonitor;

/// Where monitor data comes from. The production implementation asks Windows; tests substitute a
/// scripted source so topology changes can be simulated without touching real hardware.
pub trait MonitorSource: Send + Sync + 'static {
    fn enumerate(&self) -> EngineResult<Vec<RawMonitor>>;
}

/// The real thing: `EnumDisplayMonitors` via `platform-windows`.
pub struct SystemMonitorSource;

impl MonitorSource for SystemMonitorSource {
    fn enumerate(&self) -> EngineResult<Vec<RawMonitor>> {
        platform_windows::enumerate_monitors()
    }
}
