//! Shared foundations for every engine crate: product identity, the engine error type, and the
//! on-disk layout. Deliberately free of Win32, Tauri and serialization concerns.

pub mod error;
pub mod identity;
pub mod paths;

pub use error::{EngineError, EngineResult};
pub use paths::AppPaths;
