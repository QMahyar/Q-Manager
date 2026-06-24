//! Settings commands

use crate::commands::{error_response, CommandResult};
use crate::db::{self, Settings, SettingsUpdate};
use crate::validation::{
    validate_api_hash, validate_api_id, validate_bot_user_id, validate_join_rules,
};

fn nullable_field_value<T: Copy>(field: Option<Option<T>>) -> Option<T> {
    field.flatten()
}

#[cfg_attr(feature = "desktop", tauri::command)]
pub fn settings_get() -> CommandResult<Settings> {
    let conn = db::get_conn().map_err(error_response)?;
    db::get_settings(&conn).map_err(error_response)
}

#[cfg_attr(feature = "desktop", tauri::command)]
pub fn settings_update(payload: SettingsUpdate) -> CommandResult<Settings> {
    // Validate API credentials if provided
    if let Some(api_id) = nullable_field_value(payload.api_id) {
        validate_api_id(api_id).map_err(error_response)?;
    }
    if let Some(api_hash) = payload.api_hash.as_ref().and_then(|value| value.as_ref()) {
        if !api_hash.is_empty() {
            validate_api_hash(api_hash).map_err(error_response)?;
        }
    }

    // Validate join rules if provided — validate each field independently to avoid
    // masking invalid values with hardcoded placeholders.
    if let (Some(max_attempts), Some(cooldown)) = (
        payload.join_max_attempts_default,
        payload.join_cooldown_seconds_default,
    ) {
        validate_join_rules(max_attempts, cooldown).map_err(error_response)?;
    } else if let Some(max_attempts) = payload.join_max_attempts_default {
        // Validate only max_attempts range (1..=100)
        if max_attempts < 1 {
            return Err(error_response("Maximum join attempts must be at least 1"));
        }
        if max_attempts > 100 {
            return Err(error_response("Maximum join attempts cannot exceed 100"));
        }
    } else if let Some(cooldown) = payload.join_cooldown_seconds_default {
        // Validate only cooldown range (0..=300)
        if cooldown < 0 {
            return Err(error_response("Cooldown cannot be negative"));
        }
        if cooldown > 300 {
            return Err(error_response("Cooldown cannot exceed 300 seconds"));
        }
    }

    // Validate bot user IDs if provided
    if let Some(main_bot_id) = nullable_field_value(payload.main_bot_user_id) {
        if main_bot_id != 0 {
            validate_bot_user_id(Some(main_bot_id)).map_err(error_response)?;
        }
    }
    if let Some(beta_bot_id) = nullable_field_value(payload.beta_bot_user_id) {
        if beta_bot_id != 0 {
            validate_bot_user_id(Some(beta_bot_id)).map_err(error_response)?;
        }
    }

    let conn = db::get_conn().map_err(error_response)?;
    db::update_settings(&conn, &payload).map_err(error_response)?;
    db::get_settings(&conn).map_err(error_response)
}
