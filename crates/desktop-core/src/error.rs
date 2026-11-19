use std::io;
use std::path::{Path, PathBuf};

/// Result alias used across engine crates.
pub type EngineResult<T> = Result<T, EngineError>;

/// The single error type shared by engine crates. It is mapped to a serializable
/// `ProtocolError` at the API boundary (see `desktop-protocol`).
#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    /// The caller supplied a value that failed validation.
    #[error("invalid input: {0}")]
    InvalidInput(String),

    /// The capability does not exist on this system. Never a fake success (HR-P6).
    #[error("{0} is not supported on this system")]
    Unsupported(String),

    /// Database or persistence failure.
    #[error("storage error: {0}")]
    Storage(String),

    /// A Windows platform call failed.
    #[error("platform error: {0}")]
    Platform(String),

    /// A filesystem operation failed.
    #[error("I/O error at {}: {source}", path.display())]
    Io {
        path: PathBuf,
        #[source]
        source: io::Error,
    },

    /// A bug or an unexpected state inside the engine.
    #[error("internal error: {0}")]
    Internal(String),
}

impl EngineError {
    /// Builds an [`EngineError::Io`] that remembers which path failed.
    pub fn io(path: impl AsRef<Path>, source: io::Error) -> Self {
        Self::Io {
            path: path.as_ref().to_path_buf(),
            source,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_error_message_names_the_path() {
        let err = EngineError::io(
            "C:/data/x.db",
            io::Error::new(io::ErrorKind::PermissionDenied, "denied"),
        );
        let text = err.to_string();
        assert!(text.contains("x.db"), "{text}");
        assert!(text.contains("denied"), "{text}");
    }
}
