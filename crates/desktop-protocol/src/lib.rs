//! The versioned contract between the Rust engine and the React shell (plan §4.1).
//!
//! * Every type that crosses the boundary lives here and derives [`ts_rs::TS`]; the TypeScript
//!   bindings in `apps/shell-ui/src/services/bindings/` are **generated** from these types
//!   (`pnpm bindings`) and must never be edited by hand (HR-A8).
//! * Wire format is `camelCase` JSON. Avoid `u64`/`i64` in DTOs: they map to `bigint` in TypeScript.
//! * Changing a shape in a breaking way requires bumping [`PROTOCOL_VERSION`] and the frontend's
//!   `EXPECTED_PROTOCOL_VERSION`; a test keeps the two in sync.

pub mod app;
pub mod display;
pub mod error;
pub mod event;
pub mod settings;

pub use app::{
    AppInfo, DatabaseStatus, Diagnostics, DpiAwareness, FrontendErrorReport, FrontendErrorSource,
    PathsInfo, SystemInfo,
};
pub use display::{Display, Rect};
pub use error::{ErrorCode, ProtocolError};
pub use event::{ENGINE_EVENT_CHANNEL, EngineEvent};
pub use settings::{
    AppearancePatch, AppearanceSettings, DEFAULT_ACCENT, MotionPreference, QualityProfile,
    SETTINGS_SCHEMA_VERSION, Settings, SettingsPatch, SettingsSource, ThemeMode,
};

/// Version of the engine ⇄ shell contract. Bump on breaking changes to commands, events or DTOs.
pub const PROTOCOL_VERSION: u32 = 1;

#[cfg(test)]
mod tests {
    use super::PROTOCOL_VERSION;
    use std::path::Path;

    /// The frontend hard-codes the protocol version it was written against. If the two drift,
    /// the shell would talk to an engine it does not understand (HR-A8).
    #[test]
    fn frontend_expects_the_same_protocol_version() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../apps/shell-ui/src/services/protocol.ts");
        let source = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()));
        let needle = format!("EXPECTED_PROTOCOL_VERSION = {PROTOCOL_VERSION}");
        assert!(
            source.contains(&needle),
            "{} must contain `{needle}` (Rust PROTOCOL_VERSION and TS EXPECTED_PROTOCOL_VERSION must match)",
            path.display()
        );
    }
}
