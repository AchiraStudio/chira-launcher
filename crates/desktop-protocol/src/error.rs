use desktop_core::EngineError;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Stable, machine-readable failure category. The shell switches on this, never on message text.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum ErrorCode {
    InvalidInput,
    Unsupported,
    Storage,
    Platform,
    Io,
    Internal,
}

/// What a failed command returns to the frontend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProtocolError {
    pub code: ErrorCode,
    pub message: String,
}

impl From<&EngineError> for ProtocolError {
    fn from(err: &EngineError) -> Self {
        let code = match err {
            EngineError::InvalidInput(_) => ErrorCode::InvalidInput,
            EngineError::Unsupported(_) => ErrorCode::Unsupported,
            EngineError::Storage(_) => ErrorCode::Storage,
            EngineError::Platform(_) => ErrorCode::Platform,
            EngineError::Io { .. } => ErrorCode::Io,
            EngineError::Internal(_) => ErrorCode::Internal,
        };
        // I/O errors embed absolute paths; the frontend gets the category, the log gets the detail.
        let message = match err {
            EngineError::Io { .. } => {
                "A file operation failed. See the log for details.".to_owned()
            }
            other => other.to_string(),
        };
        Self { code, message }
    }
}

impl From<EngineError> for ProtocolError {
    fn from(err: EngineError) -> Self {
        Self::from(&err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_errors_keep_their_message() {
        let err = ProtocolError::from(EngineError::InvalidInput("bad accent".into()));
        assert_eq!(err.code, ErrorCode::InvalidInput);
        assert!(err.message.contains("bad accent"));
    }

    #[test]
    fn io_errors_do_not_leak_paths_to_the_frontend() {
        let io = std::io::Error::other("boom");
        let err = ProtocolError::from(EngineError::io("C:/Users/someone/secret.db", io));
        assert_eq!(err.code, ErrorCode::Io);
        assert!(!err.message.contains("someone"), "{}", err.message);
    }
}
