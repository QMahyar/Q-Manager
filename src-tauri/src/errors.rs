//! Custom error types for Q Manager
//! 
//! Provides structured error handling with proper context and categorization.

use thiserror::Error;
use serde::Serialize;

/// Main application error type
#[derive(Error, Debug)]
pub enum AppError {
    // Database errors
    #[error("Database error: {0}")]
    Database(#[from] DatabaseError),

    // Telethon errors
    #[error("Telegram error: {0}")]
    Telegram(#[from] TelegramError),

    // Validation errors
    #[error("Validation error: {0}")]
    Validation(#[from] ValidationError),

    // Worker errors
    #[error("Worker error: {0}")]
    Worker(#[from] WorkerError),

    // Configuration errors
    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),

    // JSON serialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    // Generic errors (for backward compatibility)
    #[error("{0}")]
    Generic(String),
}

/// Database-related errors
#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Query failed: {0}")]
    QueryFailed(String),

    #[error("Record not found: {entity} with id {id}")]
    NotFound { entity: String, id: i64 },

    #[error("Duplicate record: {entity} with {field}='{value}' already exists")]
    Duplicate { entity: String, field: String, value: String },

    #[error("Migration failed: {0}")]
    MigrationFailed(String),

    #[error("Pool error: {0}")]
    PoolError(String),
}

/// Telegram/Telethon-related errors
#[derive(Error, Debug)]
pub enum TelegramError {
    #[error("Telethon worker not available: {0}")]
    NotLoaded(String),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Session error: {0}")]
    SessionError(String),

    #[error("API error [{code}]: {message}")]
    ApiError { code: i32, message: String },

    #[error("Connection lost: {0}")]
    ConnectionLost(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),
}

/// Validation errors
#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Required field missing: {field}")]
    Required { field: String },

    #[error("Invalid format for {field}: {message}")]
    InvalidFormat { field: String, message: String },

    #[error("Value out of range for {field}: {message}")]
    OutOfRange { field: String, message: String },

    #[error("Invalid regex pattern: {0}")]
    InvalidRegex(String),

    #[error("Constraint violation: {0}")]
    Constraint(String),
}

/// Worker/automation errors
#[derive(Error, Debug)]
pub enum WorkerError {
    #[error("Worker not found for account {0}")]
    NotFound(i64),

    #[error("Worker already running for account {0}")]
    AlreadyRunning(i64),

    #[error("Worker start failed: {0}")]
    StartFailed(String),

    #[error("Worker stopped unexpectedly: {0}")]
    UnexpectedStop(String),

    #[error("Detection failed: {0}")]
    DetectionFailed(String),

    #[error("Action execution failed: {0}")]
    ActionFailed(String),

    #[error("Channel error: {0}")]
    ChannelError(String),
}

/// Configuration errors
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Missing required setting: {0}")]
    MissingSetting(String),

    #[error("Invalid setting value for {setting}: {message}")]
    InvalidValue { setting: String, message: String },

    #[error("Moderator bot not configured")]
    NoModeratorBot,

    #[error("No group slots configured for account {0}")]
    NoGroupSlots(i64),

    #[error("API credentials not configured")]
    NoApiCredentials,
}

// Implement conversion from r2d2 errors
impl From<r2d2::Error> for DatabaseError {
    fn from(err: r2d2::Error) -> Self {
        DatabaseError::PoolError(err.to_string())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(err: r2d2::Error) -> Self {
        AppError::Database(DatabaseError::from(err))
    }
}

// Implement conversion from rusqlite errors
impl From<rusqlite::Error> for DatabaseError {
    fn from(err: rusqlite::Error) -> Self {
        match err {
            rusqlite::Error::QueryReturnedNoRows => DatabaseError::NotFound {
                entity: "record".to_string(),
                id: 0,
            },
            _ => DatabaseError::QueryFailed(err.to_string()),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(DatabaseError::from(err))
    }
}

// Implement conversion from string for backward compatibility
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Generic(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Generic(s.to_string())
    }
}

impl From<crate::validation::ValidationError> for AppError {
    fn from(err: crate::validation::ValidationError) -> Self {
        AppError::Validation(ValidationError::InvalidFormat {
            field: err.field,
            message: err.message,
        })
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(err: zip::result::ZipError) -> Self {
        AppError::Generic(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Generic(err.to_string())
    }
}

/// Serializable error response for frontend
#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl From<&AppError> for ErrorResponse {
    fn from(err: &AppError) -> Self {
        let (code, details) = match err {
            AppError::Database(db_err) => ("DATABASE_ERROR", Some(format!("{:?}", db_err))),
            AppError::Telegram(tg_err) => ("TELEGRAM_ERROR", Some(format!("{:?}", tg_err))),
            AppError::Validation(val_err) => ("VALIDATION_ERROR", Some(format!("{:?}", val_err))),
            AppError::Worker(work_err) => ("WORKER_ERROR", Some(format!("{:?}", work_err))),
            AppError::Config(cfg_err) => ("CONFIG_ERROR", Some(format!("{:?}", cfg_err))),
            AppError::Json(json_err) => ("JSON_ERROR", Some(json_err.to_string())),
            AppError::Generic(_) => ("ERROR", None),
        };

        ErrorResponse {
            code: code.to_string(),
            message: err.to_string(),
            details,
        }
    }
}

/// Result type alias for app operations
pub type AppResult<T> = Result<T, AppError>;

/// Helper trait for adding context to errors
pub trait ResultExt<T> {
    fn with_context<F, S>(self, f: F) -> AppResult<T>
    where
        F: FnOnce() -> S,
        S: Into<String>;
}

impl<T, E: Into<AppError>> ResultExt<T> for Result<T, E> {
    fn with_context<F, S>(self, f: F) -> AppResult<T>
    where
        F: FnOnce() -> S,
        S: Into<String>,
    {
        self.map_err(|e| {
            let app_err = e.into();
            AppError::Generic(format!("{}: {}", f().into(), app_err))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_error_display() {
        let err = DatabaseError::NotFound {
            entity: "Account".to_string(),
            id: 42,
        };
        assert_eq!(err.to_string(), "Record not found: Account with id 42");
        
        let err = DatabaseError::Duplicate {
            entity: "Account".to_string(),
            field: "phone".to_string(),
            value: "+1234567890".to_string(),
        };
        assert!(err.to_string().contains("already exists"));
        
        let err = DatabaseError::ConnectionFailed("timeout".to_string());
        assert!(err.to_string().contains("Connection failed"));
    }

    #[test]
    fn test_telegram_error_display() {
        let err = TelegramError::ApiError {
            code: 400,
            message: "Bad Request".to_string(),
        };
        assert!(err.to_string().contains("400"));
        assert!(err.to_string().contains("Bad Request"));
        
        let err = TelegramError::AuthFailed("Invalid code".to_string());
        assert!(err.to_string().contains("Authentication failed"));
    }

    #[test]
    fn test_validation_error_display() {
        let err = ValidationError::Required {
            field: "phone".to_string(),
        };
        assert!(err.to_string().contains("phone"));
        
        let err = ValidationError::InvalidFormat {
            field: "email".to_string(),
            message: "missing @".to_string(),
        };
        assert!(err.to_string().contains("email"));
        assert!(err.to_string().contains("missing @"));
    }

    #[test]
    fn test_worker_error_display() {
        let err = WorkerError::NotFound(42);
        assert!(err.to_string().contains("42"));
        
        let err = WorkerError::AlreadyRunning(42);
        assert!(err.to_string().contains("already running"));
    }

    #[test]
    fn test_config_error_display() {
        let err = ConfigError::MissingSetting("api_id".to_string());
        assert!(err.to_string().contains("api_id"));
        
        let err = ConfigError::NoModeratorBot;
        assert!(err.to_string().contains("Moderator bot"));
    }

    #[test]
    fn test_error_response_codes() {
        let test_cases = vec![
            (AppError::Database(DatabaseError::ConnectionFailed("test".to_string())), "DATABASE_ERROR"),
            (AppError::Telegram(TelegramError::Timeout("test".to_string())), "TELEGRAM_ERROR"),
            (AppError::Validation(ValidationError::Required { field: "test".to_string() }), "VALIDATION_ERROR"),
            (AppError::Worker(WorkerError::NotFound(1)), "WORKER_ERROR"),
            (AppError::Config(ConfigError::NoApiCredentials), "CONFIG_ERROR"),
            (AppError::Generic("test".to_string()), "ERROR"),
        ];
        
        for (err, expected_code) in test_cases {
            let response = ErrorResponse::from(&err);
            assert_eq!(response.code, expected_code);
        }
    }

    #[test]
    fn test_error_conversions() {
        // From String
        let err: AppError = "test error".to_string().into();
        assert!(matches!(err, AppError::Generic(_)));
        
        // From &str
        let err: AppError = "test error".into();
        assert!(matches!(err, AppError::Generic(_)));
    }

    #[test]
    fn test_error_response_has_message() {
        let err = AppError::Database(DatabaseError::QueryFailed("SQL syntax error".to_string()));
        let response = ErrorResponse::from(&err);
        
        assert!(!response.message.is_empty());
        assert!(response.details.is_some());
    }
}
