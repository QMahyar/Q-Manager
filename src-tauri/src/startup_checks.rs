//! Startup and pre-flight validation checks for Q Manager
//!
//! These are system-level checks performed before starting accounts or
//! performing critical operations, distinct from input validation.

use std::path::PathBuf;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use crate::db::{self};
use crate::telethon;
use crate::workers::WORKER_MANAGER;

/// Startup check error with code for frontend handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupCheckError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
    pub is_blocking: bool, // If true, operation cannot proceed
}

impl StartupCheckError {
    pub fn blocking(code: &str, message: &str, details: Option<&str>) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: details.map(String::from),
            is_blocking: true,
        }
    }

    pub fn warning(code: &str, message: &str, details: Option<&str>) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: details.map(String::from),
            is_blocking: false,
        }
    }
}

/// Result of startup checks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupCheckResult {
    pub can_proceed: bool,
    pub errors: Vec<StartupCheckError>,
}

impl StartupCheckResult {
    pub fn success() -> Self {
        Self {
            can_proceed: true,
            errors: Vec::new(),
        }
    }

    pub fn add_error(&mut self, error: StartupCheckError) {
        if error.is_blocking {
            self.can_proceed = false;
        }
        self.errors.push(error);
    }

    pub fn merge(&mut self, other: StartupCheckResult) {
        if !other.can_proceed {
            self.can_proceed = false;
        }
        self.errors.extend(other.errors);
    }

    pub fn has_blocking_errors(&self) -> bool {
        self.errors.iter().any(|e| e.is_blocking)
    }

    pub fn has_warnings(&self) -> bool {
        self.errors.iter().any(|e| !e.is_blocking)
    }
}

static APP_START: Lazy<Instant> = Lazy::new(Instant::now);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsSnapshot {
    pub timestamp_ms: i64,
    pub uptime_ms: i64,
    pub total_workers: i64,
    pub running_workers: i64,
}

pub async fn diagnostics_snapshot() -> DiagnosticsSnapshot {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let (total, running) = WORKER_MANAGER.get_worker_counts().await;
    DiagnosticsSnapshot {
        timestamp_ms: now.as_millis() as i64,
        uptime_ms: APP_START.elapsed().as_millis() as i64,
        total_workers: total as i64,
        running_workers: running as i64,
    }
}

// ============================================================================
// Telethon Checks
// ============================================================================

/// Check if Telethon worker exists
pub fn check_telethon_available() -> StartupCheckResult {
    let mut result = StartupCheckResult::success();

    if let Err(e) = telethon::assert_worker_exists() {
        result.add_error(StartupCheckError::blocking(
            "TELETHON_NOT_FOUND",
            "Telethon worker executable not found",
            Some(&format!("{}\n\nEnsure the telethon-worker binary is placed next to the app executable.", e.message)),
        ));
    }

    result
}

/// Quick check if Telethon is available (non-blocking)
pub fn is_telethon_available() -> bool {
    telethon::assert_worker_exists().is_ok()
}

// ============================================================================
// Account Start Checks
// ============================================================================

/// Pre-flight checks before starting an account
pub fn check_account_can_start(account_id: i64) -> StartupCheckResult {
    let mut result = StartupCheckResult::success();
    
    // 1. Check Telethon worker
    let telethon_check = check_telethon_available();
    if !telethon_check.can_proceed {
        return telethon_check;
    }
    result.merge(telethon_check);
    
    // 2. Get account and settings
    let (account, settings) = match get_account_and_settings(account_id) {
        Ok(data) => data,
        Err(e) => {
            result.add_error(StartupCheckError::blocking(
                "ACCOUNT_NOT_FOUND",
                "Account not found",
                Some(&e),
            ));
            return result;
        }
    };
    
    // 3. Check API credentials
    let api_id = account.api_id_override.or(settings.api_id);
    let api_hash = account.api_hash_override.clone().or(settings.api_hash.clone());
    
    if api_id.is_none() {
        result.add_error(StartupCheckError::blocking(
            "API_ID_MISSING",
            "API ID not configured",
            Some("Configure API ID in Settings, or set an override in the account's edit page."),
        ));
    }
    
    if api_hash.is_none() {
        result.add_error(StartupCheckError::blocking(
            "API_HASH_MISSING",
            "API Hash not configured",
            Some("Configure API Hash in Settings, or set an override in the account's edit page."),
        ));
    }
    
    // 4. Check session directory
    let sessions_dir = get_sessions_dir();
    let user_dir = account
        .user_id
        .map(|user_id| sessions_dir.join(format!("account_{}", user_id)));
    let account_dir = sessions_dir.join(format!("account_{}", account_id));
    let session_dir = if let Some(ref dir) = user_dir {
        if dir.exists() {
            dir.clone()
        } else if account_dir.exists() {
            account_dir.clone()
        } else {
            dir.clone()
        }
    } else {
        account_dir.clone()
    };
    
    if !session_dir.exists() {
        let checked_locations = if let Some(ref dir) = user_dir {
            format!("{:?}\n{:?}", dir, account_dir)
        } else {
            format!("{:?}", account_dir)
        };
        result.add_error(StartupCheckError::blocking(
            "SESSION_NOT_FOUND",
            "Session not found",
            Some(&format!(
                "No session found for this account.\n\n\
                Checked locations:\n{}\n\n\
                Please log in first using the Login button on the Accounts page.",
                checked_locations
            )),
        ));
    } else {
        // Check if session directory is readable
        if let Err(e) = std::fs::read_dir(&session_dir) {
            result.add_error(StartupCheckError::blocking(
                "SESSION_NOT_READABLE",
                "Cannot read session directory",
                Some(&format!("Error: {}\n\nTry restarting the application or re-logging into the account.", e)),
            ));
        }
        
        // Check for Telethon session file
        let session_file = session_dir.join("telethon.session");
        if !session_file.exists() {
            result.add_error(StartupCheckError::blocking(
                "SESSION_CORRUPT",
                "Session appears to be corrupted",
                Some("The session directory exists but is missing the Telethon session file (telethon.session).\n\nTry deleting the account and logging in again."),
            ));
        }
    }
    
    // 5. Check group slots (warning only)
    match get_enabled_group_slots(account_id) {
        Ok(slots) if slots.is_empty() => {
            result.add_error(StartupCheckError::warning(
                "NO_GROUP_SLOTS",
                "No game groups configured",
                Some("This account will start but won't monitor any groups.\n\nConfigure group slots in the account's edit page to enable game monitoring."),
            ));
        }
        Err(e) => {
            result.add_error(StartupCheckError::warning(
                "GROUP_SLOTS_CHECK_FAILED",
                "Could not check group slots",
                Some(&format!("Error: {}", e)),
            ));
        }
        _ => {}
    }
    
    // 6. Check moderator bot IDs (warning only)
    if settings.main_bot_user_id.is_none() && settings.beta_bot_user_id.is_none() {
        result.add_error(StartupCheckError::warning(
            "NO_MODERATOR_BOTS",
            "No moderator bot IDs configured",
            Some("Game phase detection won't work without moderator bot IDs.\n\nConfigure them in Settings."),
        ));
    }
    
    result
}

// ============================================================================
// Login Checks
// ============================================================================

/// Pre-flight checks before starting login flow
pub fn check_can_login(api_id_override: Option<i64>, api_hash_override: Option<&str>) -> StartupCheckResult {
    let mut result = StartupCheckResult::success();
    
    // 1. Check Telethon worker
    let telethon_check = check_telethon_available();
    result.merge(telethon_check);
    
    if !result.can_proceed {
        return result;
    }
    
    // 2. Check API credentials
    let settings = db::get_conn()
        .ok()
        .and_then(|conn| db::get_settings(&conn).ok());
    
    let effective_api_id = api_id_override.or_else(|| settings.as_ref().and_then(|s| s.api_id));
    let effective_api_hash = api_hash_override
        .map(String::from)
        .or_else(|| settings.as_ref().and_then(|s| s.api_hash.clone()));
    
    if effective_api_id.is_none() {
        result.add_error(StartupCheckError::blocking(
            "API_ID_REQUIRED",
            "API ID is required for login",
            Some("Configure API ID in Settings first, or provide it during login."),
        ));
    } else if let Some(id) = effective_api_id {
        if id <= 0 {
            result.add_error(StartupCheckError::blocking(
                "API_ID_INVALID",
                "API ID must be a positive number",
                None,
            ));
        }
    }
    
    if effective_api_hash.is_none() {
        result.add_error(StartupCheckError::blocking(
            "API_HASH_REQUIRED",
            "API Hash is required for login",
            Some("Configure API Hash in Settings first, or provide it during login."),
        ));
    } else if let Some(hash) = &effective_api_hash {
        if hash.len() != 32 {
            result.add_error(StartupCheckError::blocking(
                "API_HASH_INVALID",
                &format!("API Hash must be exactly 32 characters (got {})", hash.len()),
                None,
            ));
        } else if !hash.chars().all(|c| c.is_ascii_hexdigit()) {
            result.add_error(StartupCheckError::blocking(
                "API_HASH_INVALID",
                "API Hash must contain only hexadecimal characters (0-9, a-f)",
                None,
            ));
        }
    }
    
    // 3. Check sessions directory is writable
    let sessions_dir = get_sessions_dir();
    if !sessions_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&sessions_dir) {
            result.add_error(StartupCheckError::blocking(
                "SESSIONS_DIR_CREATE_FAILED",
                "Cannot create sessions directory",
                Some(&format!("Error: {}\n\nPath: {:?}", e, sessions_dir)),
            ));
        }
    } else if let Err(e) = std::fs::metadata(&sessions_dir) {
        result.add_error(StartupCheckError::blocking(
            "SESSIONS_DIR_NOT_ACCESSIBLE",
            "Cannot access sessions directory",
            Some(&format!("Error: {}", e)),
        ));
    }
    
    result
}

// ============================================================================
// System Checks (App Startup)
// ============================================================================

/// Comprehensive system check for app startup
pub fn check_system() -> StartupCheckResult {
    let mut result = StartupCheckResult::success();
    
    // 1. Check database
    if let Err(e) = db::get_conn() {
        result.add_error(StartupCheckError::blocking(
            "DB_LOCK_FAILED",
            "Cannot access database",
            Some(&format!("Error: {}", e)),
        ));
        return result;
    }
    
    // 2. Check Telethon worker (warning if not found - user can still configure)
    let telethon_check = check_telethon_available();
    if !telethon_check.can_proceed {
        for error in telethon_check.errors {
            result.add_error(StartupCheckError::warning(
                &error.code,
                &error.message,
                error.details.as_deref(),
            ));
        }
    }
    
    // 3. Check settings (warnings for missing config)
    if let Ok(conn) = db::get_conn() {
        if let Ok(settings) = db::get_settings(&conn) {
            if settings.api_id.is_none() || settings.api_hash.is_none() {
                result.add_error(StartupCheckError::warning(
                    "API_CREDENTIALS_NOT_SET",
                    "API credentials not configured",
                    Some("Configure API ID and API Hash in Settings before logging into accounts."),
                ));
            }
            
            if settings.main_bot_user_id.is_none() && settings.beta_bot_user_id.is_none() {
                result.add_error(StartupCheckError::warning(
                    "MODERATOR_BOTS_NOT_SET",
                    "Moderator bot IDs not configured",
                    Some("Configure moderator bot IDs in Settings for game phase detection."),
                ));
            }
        }
    }
    
    result
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_sessions_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    exe_dir.join("sessions")
}

fn get_account_and_settings(account_id: i64) -> Result<(db::Account, db::Settings), String> {
    let conn = db::get_conn().map_err(|e| e.to_string())?;
    
    let accounts = db::list_accounts(&conn).map_err(|e| e.to_string())?;
    let account = accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| format!("Account {} not found", account_id))?;
    
    let settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    
    Ok((account, settings))
}

fn get_enabled_group_slots(account_id: i64) -> Result<Vec<i64>, String> {
    let conn = db::get_conn().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare(
            "SELECT group_id FROM account_group_slots 
             WHERE account_id = ?1 AND enabled = 1 AND group_id IS NOT NULL",
        )
        .map_err(|e| e.to_string())?;

    let slots: Vec<i64> = stmt
        .query_map([account_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(slots)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_startup_check_result_merge() {
        let mut result1 = StartupCheckResult::success();
        result1.add_error(StartupCheckError::warning("WARN1", "Warning 1", None));

        let mut result2 = StartupCheckResult::success();
        result2.add_error(StartupCheckError::blocking("ERR1", "Error 1", None));

        result1.merge(result2);

        assert!(!result1.can_proceed);
        assert_eq!(result1.errors.len(), 2);
        assert!(result1.has_blocking_errors());
        assert!(result1.has_warnings());
    }

    #[test]
    fn test_startup_check_error_creation() {
        let blocking = StartupCheckError::blocking("CODE", "Message", Some("Details"));
        assert!(blocking.is_blocking);
        assert!(blocking.details.is_some());

        let warning = StartupCheckError::warning("CODE", "Message", None);
        assert!(!warning.is_blocking);
        assert!(warning.details.is_none());
    }
}
