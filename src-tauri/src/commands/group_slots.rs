//! Group slot commands
//!
//! Manage account group slots (up to 2 per account)

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::command;

use crate::commands::{error_response, CommandResult};
use crate::db;
use crate::telethon;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupSlot {
    pub id: i64,
    pub account_id: i64,
    pub slot: i32,
    pub enabled: bool,
    pub group_id: Option<i64>,
    pub group_title: Option<String>,
    pub moderator_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupSlotUpdate {
    pub account_id: i64,
    pub slot: i32,
    pub enabled: bool,
    pub group_id: Option<i64>,
    pub group_title: Option<String>,
    pub moderator_kind: String,
}

/// Get group slots for an account
#[command]
pub fn group_slots_get(account_id: i64) -> CommandResult<Vec<GroupSlot>> {
    let conn = db::get_conn().map_err(error_response)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, account_id, slot, enabled, group_id, group_title, moderator_kind
         FROM account_group_slots WHERE account_id = ?1 ORDER BY slot",
        )
        .map_err(error_response)?;

    let slots = stmt
        .query_map(params![account_id], |row| {
            Ok(GroupSlot {
                id: row.get(0)?,
                account_id: row.get(1)?,
                slot: row.get(2)?,
                enabled: row.get::<_, i32>(3)? != 0,
                group_id: row.get(4)?,
                group_title: row.get(5)?,
                moderator_kind: row.get(6)?,
            })
        })
        .map_err(error_response)?;

    let result: Result<Vec<_>, _> = slots.collect();
    result.map_err(error_response)
}

/// Update or create a group slot
#[command]
pub fn group_slot_update(payload: GroupSlotUpdate) -> CommandResult<GroupSlot> {
    let conn = db::get_conn().map_err(error_response)?;

    // Check if slot exists
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM account_group_slots WHERE account_id = ?1 AND slot = ?2",
            params![payload.account_id, payload.slot],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        // Update existing slot
        conn.execute(
            "UPDATE account_group_slots SET enabled = ?1, group_id = ?2, group_title = ?3, moderator_kind = ?4
             WHERE id = ?5",
            params![
                payload.enabled as i32,
                payload.group_id,
                payload.group_title,
                payload.moderator_kind,
                id
            ]
        ).map_err(error_response)?;

        Ok(GroupSlot {
            id,
            account_id: payload.account_id,
            slot: payload.slot,
            enabled: payload.enabled,
            group_id: payload.group_id,
            group_title: payload.group_title,
            moderator_kind: payload.moderator_kind,
        })
    } else {
        // Create new slot
        conn.execute(
            "INSERT INTO account_group_slots (account_id, slot, enabled, group_id, group_title, moderator_kind)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                payload.account_id,
                payload.slot,
                payload.enabled as i32,
                payload.group_id,
                payload.group_title,
                payload.moderator_kind
            ]
        ).map_err(error_response)?;

        let id = conn.last_insert_rowid();

        Ok(GroupSlot {
            id,
            account_id: payload.account_id,
            slot: payload.slot,
            enabled: payload.enabled,
            group_id: payload.group_id,
            group_title: payload.group_title,
            moderator_kind: payload.moderator_kind,
        })
    }
}

/// Initialize default group slots for a new account
#[command]
pub fn group_slots_init(account_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;

    // Create slot 0 and 1 if they don't exist (0-indexed to match import_export.rs)
    for slot in 0..=1 {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM account_group_slots WHERE account_id = ?1 AND slot = ?2",
                params![account_id, slot],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !exists {
            conn.execute(
                "INSERT INTO account_group_slots (account_id, slot, enabled, moderator_kind)
                 VALUES (?1, ?2, 0, 'main')",
                params![account_id, slot],
            )
            .map_err(error_response)?;
        }
    }

    Ok(())
}

/// Telegram group/chat info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramGroup {
    pub id: i64,
    pub title: String,
    pub group_type: String, // "group", "supergroup", "channel"
    pub member_count: Option<i32>,
}

/// Fetch groups for an account (requires account to be connected)
/// This creates a temporary Telethon worker session to fetch the chat list
#[command]
pub async fn account_fetch_groups(account_id: i64) -> CommandResult<Vec<TelegramGroup>> {
    use crate::db;
    use std::path::PathBuf;

    log::info!("Fetching groups for account {}", account_id);

    // Get account and settings
    let (account, settings) = {
        let conn = db::get_conn().map_err(error_response)?;
        let account = db::get_account(&conn, account_id)
            .map_err(error_response)?
            .ok_or_else(|| error_response(format!("Account {} not found", account_id)))?;
        let settings = db::get_settings(&conn).map_err(error_response)?;
        (account, settings)
    };

    // Get API credentials
    let api_id = account
        .api_id_override
        .or(settings.api_id)
        .ok_or_else(|| error_response("API ID not configured"))?;
    let api_hash = account
        .api_hash_override
        .clone()
        .or(settings.api_hash.clone())
        .ok_or_else(|| error_response("API Hash not configured"))?;

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    let sessions_dir = exe_dir.join("sessions");
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
        return Err(error_response(format!(
            "Session directory not found: {:?}",
            session_dir
        )));
    }

    telethon::assert_worker_exists()?;

    let session_path = session_dir
        .join("telethon.session")
        .to_string_lossy()
        .to_string();
    let client = telethon::TelethonClient::spawn(api_id, &api_hash, &session_path)
        .map_err(error_response)?;

    let response = client
        .request("list_groups", serde_json::json!({}))
        .map_err(error_response)?;
    if !response.ok {
        return Err(error_response(
            response
                .error
                .unwrap_or_else(|| "Telethon worker error".to_string()),
        ));
    }

    let payload = response.payload.unwrap_or(serde_json::json!({}));
    let groups: Vec<TelegramGroup> = serde_json::from_value(
        payload
            .get("groups")
            .cloned()
            .unwrap_or_else(|| serde_json::json!([])),
    )
    .map_err(error_response)?;

    log::info!("Found {} groups for account {}", groups.len(), account_id);
    Ok(groups)
}
