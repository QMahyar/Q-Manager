//! Target configuration commands
//! 
//! Manage target rules, blacklists, delays, and two-step pairs

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::command;

use crate::db;
use crate::validation::{validate_delay, validate_target_rule_json};
use crate::commands::{CommandResult, error_response};

// ============================================================================
// Target Defaults (global per action)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetDefault {
    pub id: i64,
    pub action_id: i64,
    pub rule_json: String,
}

#[command]
pub fn target_defaults_get(action_id: i64) -> CommandResult<Option<TargetDefault>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.query_row(
        "SELECT id, action_id, rule_json FROM target_defaults WHERE action_id = ?1",
        params![action_id],
        |row| Ok(TargetDefault {
            id: row.get(0)?,
            action_id: row.get(1)?,
            rule_json: row.get(2)?,
        })
    ).map(Some).or_else(|_| Ok(None))
}

#[command]
pub fn target_default_set(action_id: i64, rule_json: String) -> CommandResult<TargetDefault> {
    // Validate rule JSON
    validate_target_rule_json(&rule_json).map_err(error_response)?;
    
    let conn = db::get_conn().map_err(error_response)?;
    
    // Upsert
    conn.execute(
        "INSERT INTO target_defaults (action_id, rule_json) VALUES (?1, ?2)
         ON CONFLICT(action_id) DO UPDATE SET rule_json = ?2",
        params![action_id, rule_json],
    ).map_err(error_response)?;
    
    let id: i64 = conn.query_row(
        "SELECT id FROM target_defaults WHERE action_id = ?1",
        params![action_id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    Ok(TargetDefault { id, action_id, rule_json })
}

// ============================================================================
// Target Overrides (per account per action)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetOverride {
    pub id: i64,
    pub account_id: i64,
    pub action_id: i64,
    pub rule_json: String,
}

#[command]
pub fn target_override_get(account_id: i64, action_id: i64) -> CommandResult<Option<TargetOverride>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.query_row(
        "SELECT id, account_id, action_id, rule_json FROM target_overrides 
         WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
        |row| Ok(TargetOverride {
            id: row.get(0)?,
            account_id: row.get(1)?,
            action_id: row.get(2)?,
            rule_json: row.get(3)?,
        })
    ).map(Some).or_else(|_| Ok(None))
}

#[command]
pub fn target_override_set(account_id: i64, action_id: i64, rule_json: String) -> CommandResult<TargetOverride> {
    // Validate rule JSON
    validate_target_rule_json(&rule_json).map_err(error_response)?;
    
    let conn = db::get_conn().map_err(error_response)?;
    
    // Upsert
    conn.execute(
        "INSERT INTO target_overrides (account_id, action_id, rule_json) VALUES (?1, ?2, ?3)
         ON CONFLICT(account_id, action_id) DO UPDATE SET rule_json = ?3",
        params![account_id, action_id, rule_json],
    ).map_err(error_response)?;
    
    let id: i64 = conn.query_row(
        "SELECT id FROM target_overrides WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    Ok(TargetOverride { id, account_id, action_id, rule_json })
}

#[command]
pub fn target_override_delete(account_id: i64, action_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    conn.execute(
        "DELETE FROM target_overrides WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
    ).map_err(error_response)?;
    Ok(())
}

#[command]
pub fn target_overrides_list(account_id: i64) -> CommandResult<Vec<TargetOverride>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    let mut stmt = conn.prepare(
        "SELECT id, account_id, action_id, rule_json FROM target_overrides WHERE account_id = ?1"
    ).map_err(error_response)?;
    
    let overrides = stmt.query_map(params![account_id], |row| {
        Ok(TargetOverride {
            id: row.get(0)?,
            account_id: row.get(1)?,
            action_id: row.get(2)?,
            rule_json: row.get(3)?,
        })
    }).map_err(error_response)?;
    
    overrides.collect::<Result<Vec<_>, _>>().map_err(error_response)
}

// ============================================================================
// Target Blacklist
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlacklistEntry {
    pub id: i64,
    pub account_id: i64,
    pub action_id: i64,
    pub button_text: String,
}

#[command]
pub fn blacklist_list(account_id: i64, action_id: i64) -> CommandResult<Vec<BlacklistEntry>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    let mut stmt = conn.prepare(
        "SELECT id, account_id, action_id, button_text FROM target_blacklist 
         WHERE account_id = ?1 AND action_id = ?2"
    ).map_err(error_response)?;
    
    let entries = stmt.query_map(params![account_id, action_id], |row| {
        Ok(BlacklistEntry {
            id: row.get(0)?,
            account_id: row.get(1)?,
            action_id: row.get(2)?,
            button_text: row.get(3)?,
        })
    }).map_err(error_response)?;
    
    entries.collect::<Result<Vec<_>, _>>().map_err(error_response)
}

#[command]
pub fn blacklist_add(account_id: i64, action_id: i64, button_text: String) -> CommandResult<BlacklistEntry> {
    // Validate button text is not empty
    if button_text.trim().is_empty() {
        return Err(error_response("Button text cannot be empty"));
    }
    if button_text.len() > 200 {
        return Err(error_response("Button text exceeds maximum length of 200 characters"));
    }
    
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.execute(
        "INSERT INTO target_blacklist (account_id, action_id, button_text) VALUES (?1, ?2, ?3)",
        params![account_id, action_id, button_text],
    ).map_err(error_response)?;
    
    let id = conn.last_insert_rowid();
    
    Ok(BlacklistEntry { id, account_id, action_id, button_text })
}

#[command]
pub fn blacklist_remove(entry_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    conn.execute("DELETE FROM target_blacklist WHERE id = ?1", params![entry_id])
        .map_err(error_response)?;
    Ok(())
}

// ============================================================================
// Delay Defaults (global per action)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelayDefault {
    pub id: i64,
    pub action_id: i64,
    pub min_seconds: i32,
    pub max_seconds: i32,
}

#[command]
pub fn delay_default_get(action_id: i64) -> CommandResult<Option<DelayDefault>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.query_row(
        "SELECT id, action_id, min_seconds, max_seconds FROM delay_defaults WHERE action_id = ?1",
        params![action_id],
        |row| Ok(DelayDefault {
            id: row.get(0)?,
            action_id: row.get(1)?,
            min_seconds: row.get(2)?,
            max_seconds: row.get(3)?,
        })
    ).map(Some).or_else(|_| Ok(None))
}

#[command]
pub fn delay_default_set(action_id: i64, min_seconds: i32, max_seconds: i32) -> CommandResult<DelayDefault> {
    // Validate delay values
    validate_delay(min_seconds, max_seconds).map_err(error_response)?;
    
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.execute(
        "INSERT INTO delay_defaults (action_id, min_seconds, max_seconds) VALUES (?1, ?2, ?3)
         ON CONFLICT(action_id) DO UPDATE SET min_seconds = ?2, max_seconds = ?3",
        params![action_id, min_seconds, max_seconds],
    ).map_err(error_response)?;
    
    let id: i64 = conn.query_row(
        "SELECT id FROM delay_defaults WHERE action_id = ?1",
        params![action_id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    Ok(DelayDefault { id, action_id, min_seconds, max_seconds })
}

// ============================================================================
// Delay Overrides (per account per action)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelayOverride {
    pub id: i64,
    pub account_id: i64,
    pub action_id: i64,
    pub min_seconds: i32,
    pub max_seconds: i32,
}

#[command]
pub fn delay_override_get(account_id: i64, action_id: i64) -> CommandResult<Option<DelayOverride>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.query_row(
        "SELECT id, account_id, action_id, min_seconds, max_seconds FROM delay_overrides 
         WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
        |row| Ok(DelayOverride {
            id: row.get(0)?,
            account_id: row.get(1)?,
            action_id: row.get(2)?,
            min_seconds: row.get(3)?,
            max_seconds: row.get(4)?,
        })
    ).map(Some).or_else(|_| Ok(None))
}

#[command]
pub fn delay_override_set(account_id: i64, action_id: i64, min_seconds: i32, max_seconds: i32) -> CommandResult<DelayOverride> {
    // Validate delay values
    validate_delay(min_seconds, max_seconds).map_err(error_response)?;
    
    let conn = db::get_conn().map_err(error_response)?;
    
    conn.execute(
        "INSERT INTO delay_overrides (account_id, action_id, min_seconds, max_seconds) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(account_id, action_id) DO UPDATE SET min_seconds = ?3, max_seconds = ?4",
        params![account_id, action_id, min_seconds, max_seconds],
    ).map_err(error_response)?;
    
    let id: i64 = conn.query_row(
        "SELECT id FROM delay_overrides WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    Ok(DelayOverride { id, account_id, action_id, min_seconds, max_seconds })
}

#[command]
pub fn delay_override_delete(account_id: i64, action_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    conn.execute(
        "DELETE FROM delay_overrides WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
    ).map_err(error_response)?;
    Ok(())
}

// ============================================================================
// Target Pairs (for two-step actions like Cupid)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetPair {
    pub id: i64,
    pub account_id: i64,
    pub action_id: i64,
    pub order_index: i32,
    pub target_a: String,
    pub target_b: String,
}

#[command]
pub fn target_pairs_list(account_id: i64, action_id: i64) -> CommandResult<Vec<TargetPair>> {
    let conn = db::get_conn().map_err(error_response)?;
    
    let mut stmt = conn.prepare(
        "SELECT id, account_id, action_id, order_index, target_a, target_b 
         FROM target_pairs WHERE account_id = ?1 AND action_id = ?2 ORDER BY order_index"
    ).map_err(error_response)?;
    
    let pairs = stmt.query_map(params![account_id, action_id], |row| {
        Ok(TargetPair {
            id: row.get(0)?,
            account_id: row.get(1)?,
            action_id: row.get(2)?,
            order_index: row.get(3)?,
            target_a: row.get(4)?,
            target_b: row.get(5)?,
        })
    }).map_err(error_response)?;
    
    pairs.collect::<Result<Vec<_>, _>>().map_err(error_response)
}

#[command]
pub fn target_pair_add(account_id: i64, action_id: i64, target_a: String, target_b: String) -> CommandResult<TargetPair> {
    // Validate target names
    if target_a.trim().is_empty() {
        return Err(error_response("Target A cannot be empty"));
    }
    if target_b.trim().is_empty() {
        return Err(error_response("Target B cannot be empty"));
    }
    if target_a.len() > 200 {
        return Err(error_response("Target A exceeds maximum length of 200 characters"));
    }
    if target_b.len() > 200 {
        return Err(error_response("Target B exceeds maximum length of 200 characters"));
    }
    
    let conn = db::get_conn().map_err(error_response)?;
    
    // Check max pairs limit
    let current_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM target_pairs WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    if current_count >= 50 {
        return Err(error_response("Maximum number of target pairs (50) reached"));
    }
    
    // Get next order index
    let next_index: i32 = conn.query_row(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM target_pairs WHERE account_id = ?1 AND action_id = ?2",
        params![account_id, action_id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    conn.execute(
        "INSERT INTO target_pairs (account_id, action_id, order_index, target_a, target_b) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![account_id, action_id, next_index, target_a, target_b],
    ).map_err(error_response)?;
    
    let id = conn.last_insert_rowid();
    
    Ok(TargetPair { id, account_id, action_id, order_index: next_index, target_a, target_b })
}

#[command]
pub fn target_pair_remove(pair_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    conn.execute("DELETE FROM target_pairs WHERE id = ?1", params![pair_id])
        .map_err(error_response)?;
    Ok(())
}

// ============================================================================
// Copy/Paste Targets
// ============================================================================

#[command]
pub fn targets_copy(from_account_id: i64, to_account_ids: Vec<i64>, action_ids: Vec<i64>) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    
    for action_id in &action_ids {
        // Get source override
        let source_override: Option<String> = conn.query_row(
            "SELECT rule_json FROM target_overrides WHERE account_id = ?1 AND action_id = ?2",
            params![from_account_id, action_id],
            |row| row.get(0)
        ).ok();
        
        // Get source delay
        let source_delay: Option<(i32, i32)> = conn.query_row(
            "SELECT min_seconds, max_seconds FROM delay_overrides WHERE account_id = ?1 AND action_id = ?2",
            params![from_account_id, action_id],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).ok();
        
        // Get source blacklist
        let mut stmt = conn.prepare(
            "SELECT button_text FROM target_blacklist WHERE account_id = ?1 AND action_id = ?2"
        ).map_err(error_response)?;
        let blacklist: Vec<String> = stmt.query_map(params![from_account_id, action_id], |row| row.get(0))
            .map_err(error_response)?
            .filter_map(|r| r.ok())
            .collect();
        
        // Get source target pairs (for two-step actions like Cupid)
        let mut pairs_stmt = conn.prepare(
            "SELECT order_index, target_a, target_b FROM target_pairs 
             WHERE account_id = ?1 AND action_id = ?2 ORDER BY order_index"
        ).map_err(error_response)?;
        let pairs: Vec<(i32, String, String)> = pairs_stmt.query_map(params![from_account_id, action_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(error_response)?
        .filter_map(|r| r.ok())
        .collect();
        
        // Copy to each target account
        for to_account_id in &to_account_ids {
            if *to_account_id == from_account_id {
                continue;
            }
            
            // Copy override
            if let Some(ref rule_json) = source_override {
                conn.execute(
                    "INSERT INTO target_overrides (account_id, action_id, rule_json) VALUES (?1, ?2, ?3)
                     ON CONFLICT(account_id, action_id) DO UPDATE SET rule_json = ?3",
                    params![to_account_id, action_id, rule_json],
                ).map_err(error_response)?;
            } else {
                conn.execute(
                    "DELETE FROM target_overrides WHERE account_id = ?1 AND action_id = ?2",
                    params![to_account_id, action_id],
                ).map_err(error_response)?;
            }
            
            // Copy delay
            if let Some((min, max)) = source_delay {
                conn.execute(
                    "INSERT INTO delay_overrides (account_id, action_id, min_seconds, max_seconds) VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(account_id, action_id) DO UPDATE SET min_seconds = ?3, max_seconds = ?4",
                    params![to_account_id, action_id, min, max],
                ).map_err(error_response)?;
            } else {
                conn.execute(
                    "DELETE FROM delay_overrides WHERE account_id = ?1 AND action_id = ?2",
                    params![to_account_id, action_id],
                ).map_err(error_response)?;
            }
            
            // Copy blacklist (delete existing first)
            conn.execute(
                "DELETE FROM target_blacklist WHERE account_id = ?1 AND action_id = ?2",
                params![to_account_id, action_id],
            ).map_err(error_response)?;
            
            for button_text in &blacklist {
                conn.execute(
                    "INSERT INTO target_blacklist (account_id, action_id, button_text) VALUES (?1, ?2, ?3)",
                    params![to_account_id, action_id, button_text],
                ).map_err(error_response)?;
            }
            
            // Copy target pairs (delete existing first)
            conn.execute(
                "DELETE FROM target_pairs WHERE account_id = ?1 AND action_id = ?2",
                params![to_account_id, action_id],
            ).map_err(error_response)?;
            
            for (order_index, target_a, target_b) in &pairs {
                conn.execute(
                    "INSERT INTO target_pairs (account_id, action_id, order_index, target_a, target_b) 
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![to_account_id, action_id, order_index, target_a, target_b],
                ).map_err(error_response)?;
            }
        }
    }
    
    Ok(())
}
