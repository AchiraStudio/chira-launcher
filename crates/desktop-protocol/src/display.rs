use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A rectangle in **physical pixels** on the virtual desktop (plan §7.3: Win32 placement is physical).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// One monitor (plan §8). Owned by `display-manager`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct Display {
    /// Stable within a session; derived from the Windows device name (`\\.\DISPLAY1`).
    pub id: String,
    /// Human label, e.g. "Display 2" (matches Windows' numbering).
    pub label: String,
    pub device_name: String,
    pub is_primary: bool,
    /// Full monitor rectangle in physical pixels.
    pub bounds: Rect,
    /// Rectangle minus the taskbar and other reserved areas.
    pub work_area: Rect,
    /// Effective DPI / 96 (1.0 = 100%, 1.5 = 150%).
    pub dpi_scale: f32,
    /// Current refresh rate when Windows reports one.
    pub refresh_rate_hz: Option<u32>,
}
