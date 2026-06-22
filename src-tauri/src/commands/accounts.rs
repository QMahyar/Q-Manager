//! Account commands

use crate::commands::{error_response, CommandResult};
use crate::db::{self, Account, AccountCreate};
use crate::startup_checks::StartupCheckError;
use crate::validation::{validate_account_name, validate_api_hash, validate_api_id};
use crate::workers::WORKER_MANAGER;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;
use tokio::task::JoinSet;

/// Get the sessions directory path
fn get_sessions_dir() -> PathBuf {
    crate::utils::fs::get_sessions_dir()
}

#[command]
pub fn accounts_list() -> CommandResult<Vec<Account>> {
    let conn = db::get_conn().map_err(error_response)?;
    db::list_accounts(&conn).map_err(error_response)
}

#[command]
pub fn account_create(payload: AccountCreate) -> CommandResult<Account> {
    let conn = db::get_conn().map_err(error_response)?;
    let id = db::create_account(&conn, &payload).map_err(error_response)?;
    db::get_account(&conn, id)
        .map_err(error_response)?
        .ok_or_else(|| error_response("Failed to find created account"))
}

#[command]
pub async fn account_delete(account_id: i64) -> CommandResult<()> {
    // First stop the worker if running
    let _ = WORKER_MANAGER.stop_account(account_id).await;

    // Get the user_id before deleting the account (needed for session folder path)
    let user_id: Option<i64> = {
        let conn = db::get_conn().map_err(error_response)?;
        conn.query_row(
            "SELECT user_id FROM accounts WHERE id = ?1",
            params![account_id],
            |row| row.get(0),
        )
        .ok()
    };

    // Delete the account from database
    {
        let conn = db::get_conn().map_err(error_response)?;
        db::delete_account(&conn, account_id).map_err(error_response)?;
    }

    // Delete the session folder if it exists
    let sessions_dir = get_sessions_dir();

    // Try to delete by user_id first (preferred)
    if let Some(uid) = user_id {
        let session_dir = sessions_dir.join(format!("account_{}", uid));
        if session_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&session_dir) {
                log::warn!("Failed to delete session folder {:?}: {}", session_dir, e);
            } else {
                log::info!("Deleted session folder: {:?}", session_dir);
            }
        }
    }

    // Also try by account_id (fallback for older sessions)
    let session_dir_by_id = sessions_dir.join(format!("account_{}", account_id));
    if session_dir_by_id.exists() {
        if let Err(e) = std::fs::remove_dir_all(&session_dir_by_id) {
            log::warn!(
                "Failed to delete session folder {:?}: {}",
                session_dir_by_id,
                e
            );
        } else {
            log::info!("Deleted session folder: {:?}", session_dir_by_id);
        }
    }

    Ok(())
}

#[command]
pub async fn account_start(account_id: i64) -> CommandResult<()> {
    WORKER_MANAGER
        .start_account(account_id)
        .await
        .map_err(error_response)
}

#[command]
pub async fn account_stop(account_id: i64) -> CommandResult<()> {
    WORKER_MANAGER
        .stop_account(account_id)
        .await
        .map_err(error_response)
}

#[command]
pub async fn accounts_start_all() -> CommandResult<Vec<BulkStartReport>> {
    let accounts = {
        let conn = db::get_conn().map_err(error_response)?;
        db::list_accounts(&conn).map_err(error_response)?
    };

    // Start in parallel with a bounded concurrency limit to avoid Telethon spikes
    let concurrency_limit: usize = 5;
    let mut reports = Vec::new();
    let mut set: JoinSet<BulkStartReport> = JoinSet::new();
    let mut active: usize = 0;

    for account in accounts
        .into_iter()
        .filter(|a| a.status == "stopped" || a.status == "error")
    {
        // Spawn a task for this account
        let acc = account.clone();
        set.spawn(async move { start_account_with_checks(&acc).await });
        active += 1;

        if active >= concurrency_limit {
            if let Some(res) = set.join_next().await {
                if let Ok(report) = res {
                    reports.push(report);
                }
                active -= 1;
            }
        }
    }

    while let Some(res) = set.join_next().await {
        match res {
            Ok(report) => reports.push(report),
            Err(e) => log::error!("start_account_with_checks task panicked: {:?}", e),
        }
    }

    Ok(reports)
}

#[command]
pub async fn accounts_stop_all() -> CommandResult<()> {
    WORKER_MANAGER.stop_all().await.map_err(error_response)
}

#[command]
pub async fn accounts_start_selected(account_ids: Vec<i64>) -> CommandResult<Vec<BulkStartReport>> {
    let accounts = {
        let conn = db::get_conn().map_err(error_response)?;
        db::list_accounts(&conn).map_err(error_response)?
    };

    let concurrency_limit: usize = 5;
    let mut reports = Vec::new();
    let mut set: JoinSet<BulkStartReport> = JoinSet::new();
    let mut active: usize = 0;

    for id in account_ids {
        if let Some(account) = accounts.iter().find(|account| account.id == id).cloned() {
            set.spawn(async move { start_account_with_checks(&account).await });
            active += 1;
            if active >= concurrency_limit {
                if let Some(res) = set.join_next().await {
                    if let Ok(report) = res {
                        reports.push(report);
                    }
                    active -= 1;
                }
            }
        } else {
            reports.push(BulkStartReport {
                account_id: id,
                account_name: format!("Account {}", id),
                started: false,
                errors: vec![StartupCheckError::blocking(
                    "ACCOUNT_NOT_FOUND",
                    "Account not found",
                    Some("This account no longer exists in the database."),
                )],
            });
        }
    }

    while let Some(res) = set.join_next().await {
        match res {
            Ok(report) => reports.push(report),
            Err(e) => log::error!("start_account_with_checks task panicked: {:?}", e),
        }
    }

    Ok(reports)
}

#[command]
pub async fn accounts_stop_selected(account_ids: Vec<i64>) -> CommandResult<()> {
    for id in account_ids {
        if let Err(e) = WORKER_MANAGER.stop_account(id).await {
            log::error!("Failed to stop account {}: {}", id, e);
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkStartReport {
    pub account_id: i64,
    pub account_name: String,
    pub started: bool,
    pub errors: Vec<StartupCheckError>,
}

async fn start_account_with_checks(account: &Account) -> BulkStartReport {
    let check = crate::startup_checks::check_account_can_start(account.id);
    if !check.can_proceed {
        return BulkStartReport {
            account_id: account.id,
            account_name: account.account_name.clone(),
            started: false,
            errors: check.errors,
        };
    }

    match WORKER_MANAGER.start_account(account.id).await {
        Ok(_) => BulkStartReport {
            account_id: account.id,
            account_name: account.account_name.clone(),
            started: true,
            errors: check.errors,
        },
        Err(e) => {
            let mut errors = check.errors;
            errors.push(StartupCheckError::blocking(
                "START_FAILED",
                "Failed to start account",
                Some(&e),
            ));
            BulkStartReport {
                account_id: account.id,
                account_name: account.account_name.clone(),
                started: false,
                errors,
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountUpdate {
    pub id: i64,
    pub account_name: Option<String>,
    pub api_id_override: Option<Option<i64>>,
    pub api_hash_override: Option<Option<String>>,
    pub join_max_attempts_override: Option<Option<i32>>,
    pub join_cooldown_seconds_override: Option<Option<i32>>,
}

#[command]
pub fn account_update(payload: AccountUpdate) -> CommandResult<Account> {
    // Validate fields if provided
    if let Some(ref name) = payload.account_name {
        validate_account_name(name).map_err(error_response)?;
    }
    if let Some(api_id) = payload.api_id_override.flatten() {
        validate_api_id(api_id).map_err(error_response)?;
    }
    if let Some(api_hash) = payload.api_hash_override.as_ref().and_then(|value| value.as_ref()) {
        if !api_hash.is_empty() {
            validate_api_hash(api_hash).map_err(error_response)?;
        }
    }

    let conn = db::get_conn().map_err(error_response)?;

    conn.execute(
        "UPDATE accounts SET
            account_name = COALESCE(?1, account_name),
            api_id_override = CASE WHEN ?2 THEN ?3 ELSE api_id_override END,
            api_hash_override = CASE WHEN ?4 THEN ?5 ELSE api_hash_override END,
            join_max_attempts_override = CASE WHEN ?6 THEN ?7 ELSE join_max_attempts_override END,
            join_cooldown_seconds_override = CASE WHEN ?8 THEN ?9 ELSE join_cooldown_seconds_override END,
            updated_at = datetime('now')
         WHERE id = ?10",
        params![
            payload.account_name,
            payload.api_id_override.is_some(),
            payload.api_id_override.flatten(),
            payload.api_hash_override.is_some(),
            payload.api_hash_override.clone().flatten(),
            payload.join_max_attempts_override.is_some(),
            payload.join_max_attempts_override.flatten(),
            payload.join_cooldown_seconds_override.is_some(),
            payload.join_cooldown_seconds_override.flatten(),
            payload.id,
        ],
    )
    .map_err(error_response)?;

    db::get_account(&conn, payload.id)
        .map_err(error_response)?
        .ok_or_else(|| error_response("Failed to find updated account"))
}

#[command]
pub fn account_get(account_id: i64) -> CommandResult<Account> {
    let conn = db::get_conn().map_err(error_response)?;
    db::get_account(&conn, account_id)
        .map_err(error_response)?
        .ok_or_else(|| error_response("Account not found"))
}

/// Check if an account name already exists (case-insensitive)
#[command]
pub fn account_name_exists(name: String) -> CommandResult<bool> {
    let conn = db::get_conn().map_err(error_response)?;
    db::account_name_exists(&conn, &name).map_err(error_response)
}

/// Result of refreshing an account's session info from Telethon
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRefreshResult {
    pub account_id: i64,
    pub updated: bool,
    pub user_id: Option<i64>,
    pub phone: Option<String>,
    pub telegram_name: Option<String>,
    pub message: String,
}

/// Refresh an account's phone, user_id and telegram_name by querying the live Telethon session.
/// This is useful after importing accounts where validation was skipped (e.g. no API credentials
/// were configured at import time, or the Telethon worker was unavailable).
#[command]
pub fn account_refresh_session(account_id: i64) -> CommandResult<SessionRefreshResult> {
    use crate::telethon;

    // Refuse to refresh a running account — it could interfere with the active worker
    if crate::workers::WORKER_MANAGER.is_account_running(account_id) {
        return Err(error_response(
            "Cannot refresh session while account is running. Stop the account first.",
        ));
    }

    // Check Telethon worker is available
    if telethon::assert_worker_exists().is_err() {
        return Ok(SessionRefreshResult {
            account_id,
            updated: false,
            user_id: None,
            phone: None,
            telegram_name: None,
            message: "Telethon worker not available. Cannot refresh session.".to_string(),
        });
    }

    // Load settings to get API credentials
    let (api_id, api_hash, session_dir) = {
        let conn = db::get_conn().map_err(error_response)?;
        // First check account-level overrides, then fall back to global settings
        let account = db::get_account(&conn, account_id)
            .map_err(error_response)?
            .ok_or_else(|| error_response("Account not found"))?;
        let settings = db::get_settings(&conn).map_err(error_response)?;

        let api_id = account.api_id_override.or(settings.api_id);
        let api_hash = account.api_hash_override.or(settings.api_hash);
        let session_dir = if let Some(user_id) = account.user_id {
            let user_dir = get_sessions_dir().join(format!("account_{}", user_id));
            if user_dir.exists() {
                user_dir
            } else {
                get_sessions_dir().join(format!("account_{}", account_id))
            }
        } else {
            get_sessions_dir().join(format!("account_{}", account_id))
        };
        (api_id, api_hash, session_dir)
    };

    let api_id = match api_id {
        Some(id) => id,
        None => {
            return Ok(SessionRefreshResult {
                account_id,
                updated: false,
                user_id: None,
                phone: None,
                telegram_name: None,
                message: "API ID not configured. Configure it in Settings first.".to_string(),
            });
        }
    };
    let api_hash = match api_hash {
        Some(h) => h,
        None => {
            return Ok(SessionRefreshResult {
                account_id,
                updated: false,
                user_id: None,
                phone: None,
                telegram_name: None,
                message: "API Hash not configured. Configure it in Settings first.".to_string(),
            });
        }
    };

    let session_path = session_dir.join("telethon.session").to_string_lossy().to_string();

    if !std::path::Path::new(&session_path).exists() {
        return Ok(SessionRefreshResult {
            account_id,
            updated: false,
            user_id: None,
            phone: None,
            telegram_name: None,
            message: "Session file not found. The account may need to log in again.".to_string(),
        });
    }

    // Spawn Telethon and query the session state
    let client = telethon::TelethonClient::spawn(api_id, &api_hash, &session_path)
        .map_err(error_response)?;

    let response = client
        .request("state", serde_json::json!({}))
        .map_err(|e| {
            let _ = client.shutdown();
            error_response(e)
        })?;

    let _ = client.shutdown();

    if !response.ok {
        let msg = response
            .error
            .unwrap_or_else(|| "Telethon worker error".to_string());
        return Ok(SessionRefreshResult {
            account_id,
            updated: false,
            user_id: None,
            phone: None,
            telegram_name: None,
            message: format!("Session query failed: {}", msg),
        });
    }

    let payload = response.payload.unwrap_or(serde_json::json!({}));
    if payload.get("state").and_then(|s| s.as_str()) != Some("ready") {
        return Ok(SessionRefreshResult {
            account_id,
            updated: false,
            user_id: None,
            phone: None,
            telegram_name: None,
            message: "Session is not authorized. The account needs to log in again.".to_string(),
        });
    }

    let user_id = payload.get("user_id").and_then(|v| v.as_i64());
    let first_name = payload
        .get("first_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let last_name = payload
        .get("last_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let phone = payload
        .get("phone")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let telegram_name = if first_name.is_empty() {
        None
    } else if last_name.is_empty() {
        Some(first_name)
    } else {
        Some(format!("{} {}", first_name, last_name))
    };

    // Update the account in the database
    {
        let conn = db::get_conn().map_err(error_response)?;
        conn.execute(
            "UPDATE accounts SET user_id = ?1, telegram_name = ?2, phone = ?3, updated_at = datetime('now') WHERE id = ?4",
            rusqlite::params![user_id, telegram_name, phone, account_id],
        )
        .map_err(error_response)?;
    }

    log::info!(
        "Refreshed session for account {}: user_id={:?}, phone={:?}, name={:?}",
        account_id, user_id, phone, telegram_name
    );

    Ok(SessionRefreshResult {
        account_id,
        updated: true,
        user_id,
        phone: phone.clone(),
        telegram_name: telegram_name.clone(),
        message: format!(
            "Session refreshed successfully ({})",
            telegram_name.as_deref().unwrap_or("Unknown")
        ),
    })
}
