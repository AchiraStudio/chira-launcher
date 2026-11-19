use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use desktop_core::{EngineError, EngineResult};
use serde::Serialize;
use serde::de::DeserializeOwned;
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

/// SQLite result codes that mean "this file is not (or no longer) a usable database".
const SQLITE_CORRUPT: &str = "11";
const SQLITE_NOTADB: &str = "26";

/// Handle to the application database. Cheap to clone (the pool is reference-counted).
#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
    quarantined_previous: Option<PathBuf>,
}

impl Database {
    /// Opens (creating if needed) the database at `path` and applies pending migrations.
    ///
    /// If the file exists but is **not a valid database** (corrupt or not SQLite at all) it is
    /// renamed to `<name>.corrupt-<unix-seconds>` — never deleted — and a fresh database is
    /// created. Every other failure, notably a database created by a *newer* build, is returned
    /// as an error and the file is left untouched.
    pub async fn open(path: &Path) -> EngineResult<Self> {
        match Self::connect_and_migrate(path).await {
            Ok(pool) => Ok(Self {
                pool,
                quarantined_previous: None,
            }),
            Err(OpenError::NotADatabase(reason)) => {
                tracing::error!(path = %path.display(), %reason, "database is corrupt; quarantining it");
                let quarantined = quarantine(path)?;
                let pool = Self::connect_and_migrate(path)
                    .await
                    .map_err(OpenError::into_engine_error)?;
                Ok(Self {
                    pool,
                    quarantined_previous: Some(quarantined),
                })
            }
            Err(other) => Err(other.into_engine_error()),
        }
    }

    /// File the previous (corrupt) database was moved to during [`Database::open`], if any.
    pub fn quarantined_previous(&self) -> Option<&Path> {
        self.quarantined_previous.as_deref()
    }

    /// Highest successfully applied migration version.
    pub async fn schema_version(&self) -> EngineResult<Option<u32>> {
        let version: Option<i64> =
            sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations WHERE success = 1")
                .fetch_one(&self.pool)
                .await
                .map_err(storage)?;
        Ok(version.and_then(|v| u32::try_from(v).ok()))
    }

    /// Reads a JSON document stored under `key`.
    pub async fn get_json<T: DeserializeOwned>(&self, key: &str) -> EngineResult<Option<T>> {
        let raw: Option<String> =
            sqlx::query_scalar("SELECT value FROM user_settings WHERE key = ?1")
                .bind(key)
                .fetch_optional(&self.pool)
                .await
                .map_err(storage)?;
        raw.map(|text| {
            serde_json::from_str(&text).map_err(|e| {
                EngineError::Storage(format!("stored value for `{key}` is not valid: {e}"))
            })
        })
        .transpose()
    }

    /// Stores (or replaces) a JSON document under `key`.
    pub async fn set_json<T: Serialize>(&self, key: &str, value: &T) -> EngineResult<()> {
        let text = serde_json::to_string(value)
            .map_err(|e| EngineError::Internal(format!("cannot serialize `{key}`: {e}")))?;
        sqlx::query(
            "INSERT INTO user_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(text)
        .bind(unix_seconds())
        .execute(&self.pool)
        .await
        .map_err(storage)?;
        Ok(())
    }

    /// Closes the pool and flushes the WAL. Call on shutdown and before moving the file in tests.
    pub async fn close(&self) {
        self.pool.close().await;
    }

    async fn connect_and_migrate(path: &Path) -> Result<SqlitePool, OpenError> {
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .foreign_keys(true)
            .busy_timeout(Duration::from_secs(5));

        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await
            .map_err(OpenError::from_sqlx)?;

        if let Err(err) = sqlx::migrate!("./migrations").run(&pool).await {
            pool.close().await;
            return Err(match err {
                sqlx::migrate::MigrateError::Execute(inner) => OpenError::from_sqlx(inner),
                other => {
                    OpenError::Other(EngineError::Storage(format!("migration failed: {other}")))
                }
            });
        }
        Ok(pool)
    }
}

enum OpenError {
    NotADatabase(String),
    Other(EngineError),
}

impl OpenError {
    fn from_sqlx(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db) = &err
            && matches!(db.code().as_deref(), Some(SQLITE_CORRUPT | SQLITE_NOTADB))
        {
            return Self::NotADatabase(db.message().to_owned());
        }
        Self::Other(storage(err))
    }

    fn into_engine_error(self) -> EngineError {
        match self {
            Self::NotADatabase(reason) => EngineError::Storage(format!(
                "database is unusable even after recreation: {reason}"
            )),
            Self::Other(err) => err,
        }
    }
}

/// Moves the database file and its WAL/SHM side files out of the way.
fn quarantine(path: &Path) -> EngineResult<PathBuf> {
    let stamp = unix_seconds();
    let mut target = path.as_os_str().to_owned();
    target.push(format!(".corrupt-{stamp}"));
    let target = PathBuf::from(target);

    std::fs::rename(path, &target).map_err(|e| EngineError::io(path, e))?;
    for suffix in ["-wal", "-shm"] {
        let mut side = path.as_os_str().to_owned();
        side.push(suffix);
        let side = PathBuf::from(side);
        if side.exists() {
            let mut side_target = target.as_os_str().to_owned();
            side_target.push(suffix);
            std::fs::rename(&side, PathBuf::from(side_target))
                .map_err(|e| EngineError::io(&side, e))?;
        }
    }
    Ok(target)
}

fn storage(err: sqlx::Error) -> EngineError {
    EngineError::Storage(err.to_string())
}

fn unix_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| i64::try_from(d.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct Doc {
        name: String,
        n: u32,
    }

    #[tokio::test]
    async fn opens_migrates_and_round_trips_json() {
        let tmp = tempfile::tempdir().unwrap();
        let db = Database::open(&tmp.path().join("desktop.db"))
            .await
            .unwrap();

        assert_eq!(db.schema_version().await.unwrap(), Some(1));
        assert!(db.quarantined_previous().is_none());
        assert_eq!(db.get_json::<Doc>("missing").await.unwrap(), None);

        let doc = Doc {
            name: "a".into(),
            n: 7,
        };
        db.set_json("doc", &doc).await.unwrap();
        assert_eq!(db.get_json::<Doc>("doc").await.unwrap(), Some(doc));

        let replacement = Doc {
            name: "b".into(),
            n: 8,
        };
        db.set_json("doc", &replacement).await.unwrap();
        assert_eq!(db.get_json::<Doc>("doc").await.unwrap(), Some(replacement));
    }

    #[tokio::test]
    async fn data_survives_reopening() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("desktop.db");
        let db = Database::open(&path).await.unwrap();
        db.set_json(
            "k",
            &Doc {
                name: "kept".into(),
                n: 1,
            },
        )
        .await
        .unwrap();
        db.close().await;

        let reopened = Database::open(&path).await.unwrap();
        assert_eq!(
            reopened.get_json::<Doc>("k").await.unwrap(),
            Some(Doc {
                name: "kept".into(),
                n: 1
            })
        );
    }

    #[tokio::test]
    async fn a_corrupt_file_is_quarantined_not_deleted() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("desktop.db");
        std::fs::write(
            &path,
            b"this is definitely not a sqlite database, just text padding ........",
        )
        .unwrap();

        let db = Database::open(&path).await.unwrap();
        let moved = db
            .quarantined_previous()
            .expect("corrupt file should be quarantined")
            .to_owned();
        assert!(moved.exists(), "quarantined file must be preserved");
        assert!(moved.to_string_lossy().contains(".corrupt-"));
        assert_eq!(db.schema_version().await.unwrap(), Some(1));
    }

    #[tokio::test]
    async fn invalid_stored_json_is_a_storage_error_not_a_panic() {
        let tmp = tempfile::tempdir().unwrap();
        let db = Database::open(&tmp.path().join("desktop.db"))
            .await
            .unwrap();
        db.set_json("doc", &"just a string").await.unwrap();
        let err = db.get_json::<Doc>("doc").await.unwrap_err();
        assert!(matches!(err, EngineError::Storage(_)), "{err:?}");
    }
}
