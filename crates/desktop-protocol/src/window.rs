use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::display::Rect;

/// How the shell's own window is presented. The shell always launches `Fullscreen` (borderless);
/// `Windowed` exists as an escape hatch so the user can never be locked into it (plan pillar 6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum ShellWindowMode {
    Fullscreen,
    Windowed,
}

/// A top-level window of **another** application, as discovered by `window-manager` (plan §5).
///
/// Read-only for now: this describes what exists, it is not a handle to act on. Before any
/// future destructive operation the engine must re-validate the window and its process (HR-W5),
/// because `id` and `pid` can be reused.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct DesktopWindow {
    /// Hex window handle. Only meaningful during this session; never persisted.
    pub id: String,
    pub pid: u32,
    pub title: String,
    /// Friendly application name derived from the executable (or the title for packaged apps).
    pub app_name: String,
    /// Executable file name only — full paths stay inside the engine.
    pub exe_name: Option<String>,
    pub bounds: Rect,
    pub is_minimized: bool,
    pub is_foreground: bool,
}
