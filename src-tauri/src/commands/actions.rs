//! Action commands

use crate::commands::{error_response, CommandResult};
use crate::db::{self, Action, ActionCreate, ActionPattern};
use crate::validation::{
    validate_button_type, validate_display_name, validate_pattern, validate_priority,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::command;

#[command]
pub fn actions_list() -> CommandResult<Vec<Action>> {
    let conn = db::get_conn().map_err(error_response)?;
    db::list_actions(&conn).map_err(error_response)
}

#[command]
pub fn action_create(payload: ActionCreate) -> CommandResult<Action> {
    // Validate inputs
    validate_display_name(&payload.name).map_err(error_response)?;
    validate_button_type(&payload.button_type).map_err(error_response)?;

    let conn = db::get_conn().map_err(error_response)?;
    let id = db::create_action(&conn, &payload).map_err(error_response)?;

    Ok(Action {
        id,
        name: payload.name,
        button_type: payload.button_type,
        random_fallback_enabled: payload.random_fallback_enabled,
        is_two_step: payload.is_two_step,
    })
}

#[command]
pub fn action_delete(action_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    db::delete_action(&conn, action_id).map_err(error_response)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionUpdate {
    pub id: i64,
    pub name: String,
    pub button_type: String,
    pub random_fallback_enabled: bool,
    pub is_two_step: bool,
}

#[command]
pub fn action_update(payload: ActionUpdate) -> CommandResult<Action> {
    // Validate inputs
    validate_display_name(&payload.name).map_err(error_response)?;
    validate_button_type(&payload.button_type).map_err(error_response)?;

    let conn = db::get_conn().map_err(error_response)?;

    conn.execute(
        "UPDATE actions SET name = ?1, button_type = ?2, 
         random_fallback_enabled = ?3, is_two_step = ?4 WHERE id = ?5",
        params![
            payload.name,
            payload.button_type,
            payload.random_fallback_enabled as i32,
            payload.is_two_step as i32,
            payload.id,
        ],
    )
    .map_err(error_response)?;

    Ok(Action {
        id: payload.id,
        name: payload.name,
        button_type: payload.button_type,
        random_fallback_enabled: payload.random_fallback_enabled,
        is_two_step: payload.is_two_step,
    })
}

// Action Patterns
#[command]
pub fn action_patterns_list(action_id: i64) -> CommandResult<Vec<ActionPattern>> {
    let conn = db::get_conn().map_err(error_response)?;
    db::list_action_patterns(&conn, action_id).map_err(error_response)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionPatternCreate {
    pub action_id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
    pub step: i32,
}

#[command]
pub fn action_pattern_create(payload: ActionPatternCreate) -> CommandResult<ActionPattern> {
    // Validate inputs
    validate_pattern(&payload.pattern, payload.is_regex).map_err(error_response)?;
    validate_priority(payload.priority).map_err(error_response)?;

    let conn = db::get_conn().map_err(error_response)?;

    conn.execute(
        "INSERT INTO action_patterns (action_id, pattern, is_regex, enabled, priority, step)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            payload.action_id,
            payload.pattern,
            payload.is_regex as i32,
            payload.enabled as i32,
            payload.priority,
            payload.step,
        ],
    )
    .map_err(error_response)?;

    let id = conn.last_insert_rowid();

    Ok(ActionPattern {
        id,
        action_id: payload.action_id,
        pattern: payload.pattern,
        is_regex: payload.is_regex,
        enabled: payload.enabled,
        priority: payload.priority,
        step: payload.step,
    })
}

#[command]
pub fn action_pattern_delete(pattern_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    conn.execute(
        "DELETE FROM action_patterns WHERE id = ?1",
        params![pattern_id],
    )
    .map_err(error_response)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionPatternUpdate {
    pub id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
    pub step: i32,
}

#[command]
pub fn action_pattern_update(payload: ActionPatternUpdate) -> CommandResult<ActionPattern> {
    // Validate inputs
    validate_pattern(&payload.pattern, payload.is_regex).map_err(error_response)?;
    validate_priority(payload.priority).map_err(error_response)?;

    let conn = db::get_conn().map_err(error_response)?;

    // Get the action_id first
    let action_id: i64 = conn
        .query_row(
            "SELECT action_id FROM action_patterns WHERE id = ?1",
            params![payload.id],
            |row| row.get(0),
        )
        .map_err(error_response)?;

    conn.execute(
        "UPDATE action_patterns SET pattern = ?1, is_regex = ?2, enabled = ?3, priority = ?4, step = ?5
         WHERE id = ?6",
        params![
            payload.pattern,
            payload.is_regex as i32,
            payload.enabled as i32,
            payload.priority,
            payload.step,
            payload.id,
        ],
    ).map_err(error_response)?;

    Ok(ActionPattern {
        id: payload.id,
        action_id,
        pattern: payload.pattern,
        is_regex: payload.is_regex,
        enabled: payload.enabled,
        priority: payload.priority,
        step: payload.step,
    })
}
