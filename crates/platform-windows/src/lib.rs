//! Safe wrappers over Win32. **All `unsafe` in the workspace lives in this crate** (HR-A2); every
//! `unsafe` block carries a `// SAFETY:` justification.
//!
//! On non-Windows targets every function returns [`EngineError::Unsupported`] — the product is
//! Windows-only (plan §1.8) and we never fake success.
//!
//! [`EngineError::Unsupported`]: desktop_core::EngineError::Unsupported

mod dialog;
mod monitors;
mod system;

pub use dialog::show_fatal_error;
pub use monitors::{PixelRect, RawMonitor, enumerate_monitors};
pub use system::{OsVersion, RawDpiAwareness, os_version, process_dpi_awareness};
