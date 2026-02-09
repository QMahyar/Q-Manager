//! Settings commands

use crate::db::{self, Settings, SettingsUpdate};
use crate::validation::{validate_api_id, validate_api_hash, validate_join_rules, validate_bot_user_id};
use tauri::command;
use crate::commands::{CommandResult, error_response};

#[command]
pub fn settings_get() -> CommandResult<Settings> {
    let conn = db::get_conn().map_err(error_response)?;
    db::get_settings(&conn).map_err(error_response)
}

#[command]
pub fn settings_update(payload: SettingsUpdate) -> CommandResult<Settings> {
    // Validate API credentials if provided
    if let Some(api_id) = payload.api_id {
        validate_api_id(api_id).map_err(error_response)?;
    }
    if let Some(ref api_hash) = payload.api_hash {
        if !api_hash.is_empty() {
            validate_api_hash(api_hash).map_err(error_response)?;
        }
    }
    
    // Validate join rules if provided
    if let (Some(max_attempts), Some(cooldown)) = (payload.join_max_attempts_default, payload.join_cooldown_seconds_default) {
        validate_join_rules(max_attempts, cooldown).map_err(error_response)?;
    } else if let Some(max_attempts) = payload.join_max_attempts_default {
        // Just validate max_attempts with a reasonable cooldown
        validate_join_rules(max_attempts, 5).map_err(error_response)?;
    } else if let Some(cooldown) = payload.join_cooldown_seconds_default {
        // Just validate cooldown with a reasonable max_attempts
        validate_join_rules(5, cooldown).map_err(error_response)?;
    }
    
    // Validate bot user IDs if provided
    if let Some(main_bot_id) = payload.main_bot_user_id {
        if main_bot_id != 0 {
            validate_bot_user_id(Some(main_bot_id)).map_err(error_response)?;
        }
    }
    if let Some(beta_bot_id) = payload.beta_bot_user_id {
        if beta_bot_id != 0 {
            validate_bot_user_id(Some(beta_bot_id)).map_err(error_response)?;
        }
    }
    
    let conn = db::get_conn().map_err(error_response)?;
    db::update_settings(&conn, &payload).map_err(error_response)?;
    db::get_settings(&conn).map_err(error_response)
}
