//! Account commands

use crate::commands::{error_response, CommandResult};
use crate::db::{self, Account, AccountCreate};
use crate::startup_checks::StartupCheckError;
use crate::workers::WORKER_MANAGER;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;
use tokio::task::JoinSet;

/// Get the sessions directory path
fn get_sessions_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    exe_dir.join("sessions")
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

    // Return the created account
    let accounts = db::list_accounts(&conn).map_err(error_response)?;
    accounts
        .into_iter()
        .find(|a| a.id == id)
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
        if let Ok(report) = res {
            reports.push(report);
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
        if let Ok(report) = res {
            reports.push(report);
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
    pub api_id_override: Option<i64>,
    pub api_hash_override: Option<String>,
    pub join_max_attempts_override: Option<i32>,
    pub join_cooldown_seconds_override: Option<i32>,
}

#[command]
pub fn account_update(payload: AccountUpdate) -> CommandResult<Account> {
    let conn = db::get_conn().map_err(error_response)?;

    if let Some(ref name) = payload.account_name {
        if name.trim().is_empty() {
            return Err(error_response("Account name cannot be empty"));
        }
    }

    conn.execute(
        "UPDATE accounts SET 
            account_name = COALESCE(?1, account_name),
            api_id_override = COALESCE(?2, api_id_override),
            api_hash_override = COALESCE(?3, api_hash_override),
            join_max_attempts_override = COALESCE(?4, join_max_attempts_override),
            join_cooldown_seconds_override = COALESCE(?5, join_cooldown_seconds_override),
            updated_at = datetime('now')
         WHERE id = ?6",
        params![
            payload.account_name,
            payload.api_id_override,
            payload.api_hash_override,
            payload.join_max_attempts_override,
            payload.join_cooldown_seconds_override,
            payload.id,
        ],
    )
    .map_err(error_response)?;

    // Return the updated account
    let accounts = db::list_accounts(&conn).map_err(error_response)?;
    accounts
        .into_iter()
        .find(|a| a.id == payload.id)
        .ok_or_else(|| error_response("Failed to find updated account"))
}

#[command]
pub fn account_get(account_id: i64) -> CommandResult<Account> {
    let conn = db::get_conn().map_err(error_response)?;
    let accounts = db::list_accounts(&conn).map_err(error_response)?;
    accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| error_response("Account not found"))
}

/// Check if an account name already exists (case-insensitive)
#[command]
pub fn account_name_exists(name: String) -> CommandResult<bool> {
    let conn = db::get_conn().map_err(error_response)?;
    db::account_name_exists(&conn, &name).map_err(error_response)
}
