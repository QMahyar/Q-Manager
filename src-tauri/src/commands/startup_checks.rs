//! Startup check commands for frontend integration

use crate::startup_checks::{self, DiagnosticsSnapshot, StartupCheckResult};
use tauri::command;

/// Check if Telethon worker is available (quick check)
#[command]
pub fn check_telethon_available() -> bool {
    startup_checks::is_telethon_available()
}

/// Check if Telethon worker can be used (thorough check)
#[command]
pub fn check_telethon() -> StartupCheckResult {
    startup_checks::check_telethon_available()
}

/// Pre-flight check before starting an account
#[command]
pub fn check_account_start(account_id: i64) -> StartupCheckResult {
    startup_checks::check_account_can_start(account_id)
}

/// Pre-flight check before starting login
#[command]
pub fn check_can_login(
    api_id_override: Option<i64>,
    api_hash_override: Option<String>,
) -> StartupCheckResult {
    startup_checks::check_can_login(api_id_override, api_hash_override.as_deref())
}

/// System health check (for app startup)
#[command]
pub fn check_system() -> StartupCheckResult {
    startup_checks::check_system()
}

#[command]
pub async fn diagnostics_snapshot() -> DiagnosticsSnapshot {
    startup_checks::diagnostics_snapshot().await
}
