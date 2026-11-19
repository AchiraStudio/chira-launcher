use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use desktop_core::{EngineError, EngineResult};

/// Writes `bytes` to `path` atomically: the data goes to a sibling temp file, is flushed to disk,
/// and is then renamed over the destination. A crash leaves either the old or the new file,
/// never a torn one (plan §17).
pub fn write_atomic(path: &Path, bytes: &[u8]) -> EngineResult<()> {
    let parent = path.parent().ok_or_else(|| {
        EngineError::Internal(format!("{} has no parent directory", path.display()))
    })?;
    let file_name = path
        .file_name()
        .ok_or_else(|| EngineError::Internal(format!("{} has no file name", path.display())))?;

    let mut tmp_name = std::ffi::OsString::from(".");
    tmp_name.push(file_name);
    tmp_name.push(".tmp");
    let tmp_path = parent.join(tmp_name);

    let result = (|| {
        let mut file = File::create(&tmp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        // On Windows `rename` replaces an existing destination (MOVEFILE_REPLACE_EXISTING).
        fs::rename(&tmp_path, path)
    })();

    if let Err(source) = result {
        // Best effort: do not leave the temp file behind; the original error is what matters.
        let _ = fs::remove_file(&tmp_path);
        return Err(EngineError::io(path, source));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_and_replaces_files_without_leaving_temp_files() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("settings.json");

        write_atomic(&target, b"first").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"first");

        write_atomic(&target, b"second, longer").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"second, longer");

        let leftovers: Vec<_> = fs::read_dir(tmp.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(leftovers, vec![std::ffi::OsString::from("settings.json")]);
    }

    #[test]
    fn missing_parent_directory_is_a_reported_error() {
        let tmp = tempfile::tempdir().unwrap();
        let err = write_atomic(&tmp.path().join("nope").join("x.json"), b"x").unwrap_err();
        assert!(matches!(err, EngineError::Io { .. }), "{err:?}");
    }
}
