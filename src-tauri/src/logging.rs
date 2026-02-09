//! Structured logging configuration for Q Manager
//!
//! Provides consistent logging with context, filtering, and optional file output.

#![allow(dead_code)]

use log::{Level, LevelFilter, Metadata, Record};
use std::sync::atomic::{AtomicBool, Ordering};

/// Flag to enable verbose logging (set via command line or settings)
static VERBOSE_MODE: AtomicBool = AtomicBool::new(false);

/// Custom logger that adds context and formatting
pub struct QManagerLogger;

impl log::Log for QManagerLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        // In verbose mode, show debug logs; otherwise only info and above
        if VERBOSE_MODE.load(Ordering::Relaxed) {
            metadata.level() <= Level::Debug
        } else {
            metadata.level() <= Level::Info
        }
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        let level_str = match record.level() {
            Level::Error => "ERROR",
            Level::Warn => "WARN ",
            Level::Info => "INFO ",
            Level::Debug => "DEBUG",
            Level::Trace => "TRACE",
        };

        let target = record.target();
        let module = if target.starts_with("q_manager") {
            // Shorten internal module paths
            target.strip_prefix("q_manager::").unwrap_or(target)
        } else {
            target
        };

        // Format: [LEVEL] [module] message
        eprintln!("[{}] [{}] {}", level_str, module, record.args());
    }

    fn flush(&self) {}
}

static LOGGER: QManagerLogger = QManagerLogger;

/// Initialize the logging system
pub fn init() -> Result<(), log::SetLoggerError> {
    log::set_logger(&LOGGER)?;
    log::set_max_level(LevelFilter::Debug);
    Ok(())
}

/// Enable or disable verbose mode
pub fn set_verbose(enabled: bool) {
    VERBOSE_MODE.store(enabled, Ordering::Relaxed);
    if enabled {
        log::info!("Verbose logging enabled");
    }
}

/// Check if verbose mode is enabled
pub fn is_verbose() -> bool {
    VERBOSE_MODE.load(Ordering::Relaxed)
}

/// Log macros with context support
#[macro_export]
macro_rules! log_with_context {
    ($level:expr, $ctx:expr, $($arg:tt)*) => {
        log::log!($level, "[{}] {}", $ctx, format!($($arg)*))
    };
}

/// Log an account-related event
#[macro_export]
macro_rules! log_account {
    ($level:expr, $account_id:expr, $($arg:tt)*) => {
        log::log!($level, "[account:{}] {}", $account_id, format!($($arg)*))
    };
}

/// Log a worker-related event
#[macro_export]
macro_rules! log_worker {
    ($level:expr, $account_id:expr, $($arg:tt)*) => {
        log::log!($level, "[worker:{}] {}", $account_id, format!($($arg)*))
    };
}

/// Log a database operation
#[macro_export]
macro_rules! log_db {
    ($level:expr, $op:expr, $($arg:tt)*) => {
        log::log!($level, "[db:{}] {}", $op, format!($($arg)*))
    };
}

/// Log a Telethon operation
#[macro_export]
macro_rules! log_telethon {
    ($level:expr, $account_id:expr, $($arg:tt)*) => {
        log::log!($level, "[telethon:{}] {}", $account_id, format!($($arg)*))
    };
}

/// Structured log context for complex operations
pub struct LogContext {
    pub module: &'static str,
    pub account_id: Option<i64>,
    pub operation: Option<&'static str>,
}

impl LogContext {
    pub fn new(module: &'static str) -> Self {
        LogContext {
            module,
            account_id: None,
            operation: None,
        }
    }

    pub fn with_account(mut self, account_id: i64) -> Self {
        self.account_id = Some(account_id);
        self
    }

    pub fn with_operation(mut self, operation: &'static str) -> Self {
        self.operation = Some(operation);
        self
    }

    pub fn format_prefix(&self) -> String {
        let mut parts = vec![self.module.to_string()];

        if let Some(id) = self.account_id {
            parts.push(format!("account:{}", id));
        }

        if let Some(op) = self.operation {
            parts.push(op.to_string());
        }

        parts.join("][")
    }

    pub fn debug(&self, message: &str) {
        log::debug!("[{}] {}", self.format_prefix(), message);
    }

    pub fn info(&self, message: &str) {
        log::info!("[{}] {}", self.format_prefix(), message);
    }

    pub fn warn(&self, message: &str) {
        log::warn!("[{}] {}", self.format_prefix(), message);
    }

    pub fn error(&self, message: &str) {
        log::error!("[{}] {}", self.format_prefix(), message);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verbose_mode() {
        set_verbose(false);
        assert!(!is_verbose());

        set_verbose(true);
        assert!(is_verbose());

        set_verbose(false);
        assert!(!is_verbose());
    }

    #[test]
    fn test_log_context_format() {
        let ctx = LogContext::new("worker")
            .with_account(42)
            .with_operation("start");

        assert!(ctx.format_prefix().contains("worker"));
        assert!(ctx.format_prefix().contains("42"));
        assert!(ctx.format_prefix().contains("start"));
    }

    #[test]
    fn test_log_context_minimal() {
        let ctx = LogContext::new("db");
        assert_eq!(ctx.format_prefix(), "db");
    }
}
