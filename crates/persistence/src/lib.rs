//! Persistent state (plan §17): SQLite through SQLx, versioned migrations, and atomic writes.
//!
//! Only *persistent* state belongs here (settings, layouts, profiles). Runtime state — processes,
//! HWNDs, focus — is reconstructed from Windows and never stored as truth (HR-A7).

mod database;
mod fs_atomic;

pub use database::Database;
pub use fs_atomic::write_atomic;
