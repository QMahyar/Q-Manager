//! Startup check commands for frontend integration

use crate::startup_checks::{self, DiagnosticsSnapshot, StartupCheckResult};

/// Check if Telethon worker is available (quick check)
#[cfg_attr(feature = "desktop", tauri::command)]
pub fn check_telethon_available() -> bool {
    startup_checks::is_telethon_available()
}

/// Check if Telethon worker can be used (thorough check)
#[cfg_attr(feature = "desktop", tauri::command)]
pub fn check_telethon() -> StartupCheckResult {
    startup_checks::check_telethon_available()
}

/// Pre-flight check before starting an account
#[cfg_attr(feature = "desktop", tauri::command)]
pub fn check_account_start(account_id: i64) -> StartupCheckResult {
    startup_checks::check_account_can_start(account_id)
}

/// Pre-flight check before starting login
#[cfg_attr(feature = "desktop", tauri::command)]
pub fn check_can_login(
    api_id_override: Option<i64>,
    api_hash_override: Option<String>,
) -> StartupCheckResult {
    startup_checks::check_can_login(api_id_override, api_hash_override.as_deref())
}

/// System health check (for app startup)
#[cfg_attr(feature = "desktop", tauri::command)]
pub fn check_system() -> StartupCheckResult {
    startup_checks::check_system()
}

#[cfg_attr(feature = "desktop", tauri::command)]
pub async fn diagnostics_snapshot() -> DiagnosticsSnapshot {
    startup_checks::diagnostics_snapshot().await
}
