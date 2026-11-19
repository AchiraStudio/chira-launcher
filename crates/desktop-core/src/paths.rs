use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{EngineError, EngineResult};
use crate::identity::{DATA_DIR_ENV, DATA_DIR_NAME};

/// Name of the SQLite database file inside `database/` (plan §17).
const DATABASE_FILE: &str = "desktop.db";

/// The on-disk layout from plan §17:
///
/// ```text
/// %LOCALAPPDATA%/ChiraLauncher/
/// ├── database/desktop.db
/// ├── logs/
/// └── recovery/      # independent of the DB; readable if the DB is corrupt
/// ```
///
/// `cache/`, `themes/`, `plugins/` and `config/` from the plan are created when the feature that
/// needs them lands — empty directories are not part of the foundation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    root: PathBuf,
}

impl AppPaths {
    /// Resolves the data root: `CHIRA_LAUNCHER_DATA_DIR` if set (dev/tests), otherwise
    /// `%LOCALAPPDATA%/ChiraLauncher`.
    pub fn resolve() -> EngineResult<Self> {
        if let Some(custom) = std::env::var_os(DATA_DIR_ENV).filter(|v| !v.is_empty()) {
            return Ok(Self::at(custom));
        }
        let base = dirs::data_local_dir().ok_or_else(|| {
            EngineError::Internal("could not determine the local application data directory".into())
        })?;
        Ok(Self::at(base.join(DATA_DIR_NAME)))
    }

    /// Uses an explicit root directory.
    pub fn at(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn database_dir(&self) -> PathBuf {
        self.root.join("database")
    }

    pub fn database_file(&self) -> PathBuf {
        self.database_dir().join(DATABASE_FILE)
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.root.join("logs")
    }

    /// Recovery data must stay readable even when the main database is corrupt (plan §4.6, §17).
    pub fn recovery_dir(&self) -> PathBuf {
        self.root.join("recovery")
    }

    /// Creates every directory the engine writes to. Idempotent.
    pub fn ensure_created(&self) -> EngineResult<()> {
        for dir in [self.database_dir(), self.logs_dir(), self.recovery_dir()] {
            fs::create_dir_all(&dir).map_err(|e| EngineError::io(&dir, e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_matches_the_plan() {
        let paths = AppPaths::at("C:/data/ChiraLauncher");
        assert!(paths.database_file().ends_with("database/desktop.db"));
        assert!(paths.logs_dir().ends_with("logs"));
        assert!(paths.recovery_dir().ends_with("recovery"));
    }

    #[test]
    fn ensure_created_is_idempotent() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = AppPaths::at(tmp.path().join("root"));
        paths.ensure_created().unwrap();
        paths.ensure_created().unwrap();
        assert!(paths.database_dir().is_dir());
        assert!(paths.logs_dir().is_dir());
        assert!(paths.recovery_dir().is_dir());
    }
}
