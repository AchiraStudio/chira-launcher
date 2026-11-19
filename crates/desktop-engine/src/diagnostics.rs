use desktop_core::identity::{LOG_FILTER_ENV, PRODUCT_SLUG};
use desktop_core::{AppPaths, EngineError, EngineResult};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{Builder, Rotation};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, fmt};

/// How many daily log files to keep.
const MAX_LOG_FILES: usize = 14;

/// Keeps the background log writer alive. Drop it only when the process exits, otherwise
/// buffered log lines can be lost.
pub struct LogGuard {
    _file: WorkerGuard,
}

/// Installs the global `tracing` subscriber (stderr + daily-rotated file in `logs/`) and a panic
/// hook that routes panics into the log. Call once, as early as possible.
///
/// Filter: `CHIRA_LOG` (e.g. `CHIRA_LOG=debug`), default `info` with chatty crates turned down.
pub fn init_logging(paths: &AppPaths) -> EngineResult<LogGuard> {
    let logs_dir = paths.logs_dir();
    std::fs::create_dir_all(&logs_dir).map_err(|e| EngineError::io(&logs_dir, e))?;

    let appender = Builder::new()
        .rotation(Rotation::DAILY)
        .filename_prefix(PRODUCT_SLUG)
        .filename_suffix("log")
        .max_log_files(MAX_LOG_FILES)
        .build(&logs_dir)
        .map_err(|e| EngineError::Internal(format!("cannot create the log file appender: {e}")))?;
    let (file_writer, guard) = tracing_appender::non_blocking(appender);

    let filter = EnvFilter::try_from_env(LOG_FILTER_ENV)
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,tao=warn,wry=warn"));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_writer(std::io::stderr))
        .with(fmt::layer().with_writer(file_writer).with_ansi(false))
        .try_init()
        .map_err(|e| EngineError::Internal(format!("logging is already initialised: {e}")))?;

    install_panic_hook();
    Ok(LogGuard { _file: guard })
}

fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".into());
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_owned())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "non-string panic payload".into());
        tracing::error!(%location, %payload, "panic");
        previous(info);
    }));
}
