//! Phase commands

use crate::db::{self, Phase, PhasePattern, PhasePatternCreate};
use crate::validation::{validate_pattern, validate_priority};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::command;
use crate::commands::{CommandResult, error_response};

/// Phase pattern update payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhasePatternUpdate {
    pub id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
}

#[command]
pub fn phases_list() -> CommandResult<Vec<Phase>> {
    let conn = db::get_conn().map_err(error_response)?;
    db::list_phases(&conn).map_err(error_response)
}

#[command]
pub fn phase_patterns_list(phase_id: i64) -> CommandResult<Vec<PhasePattern>> {
    let conn = db::get_conn().map_err(error_response)?;
    db::list_phase_patterns(&conn, phase_id).map_err(error_response)
}

#[command]
pub fn phase_pattern_create(payload: PhasePatternCreate) -> CommandResult<PhasePattern> {
    // Validate inputs
    validate_pattern(&payload.pattern, payload.is_regex).map_err(error_response)?;
    validate_priority(payload.priority).map_err(error_response)?;
    
    let conn = db::get_conn().map_err(error_response)?;
    let id = db::create_phase_pattern(&conn, &payload).map_err(error_response)?;
    
    Ok(PhasePattern {
        id,
        phase_id: payload.phase_id,
        pattern: payload.pattern,
        is_regex: payload.is_regex,
        enabled: payload.enabled,
        priority: payload.priority,
    })
}

#[command]
pub fn phase_pattern_delete(pattern_id: i64) -> CommandResult<()> {
    let conn = db::get_conn().map_err(error_response)?;
    db::delete_phase_pattern(&conn, pattern_id).map_err(error_response)
}

#[command]
pub fn phase_update_priority(phase_id: i64, priority: i32) -> CommandResult<Phase> {
    let conn = db::get_conn().map_err(error_response)?;
    db::update_phase_priority(&conn, phase_id, priority).map_err(error_response)?;
    
    // Return the updated phase
    let phases = db::list_phases(&conn).map_err(error_response)?;
    phases.into_iter()
        .find(|p| p.id == phase_id)
        .ok_or_else(|| error_response("Phase not found"))
}

#[command]
pub fn phase_pattern_update(payload: PhasePatternUpdate) -> CommandResult<PhasePattern> {
    // Validate inputs
    validate_pattern(&payload.pattern, payload.is_regex).map_err(error_response)?;
    validate_priority(payload.priority).map_err(error_response)?;
    
    let conn = db::get_conn().map_err(error_response)?;
    
    // Get the phase_id for the pattern
    let phase_id: i64 = conn.query_row(
        "SELECT phase_id FROM phase_patterns WHERE id = ?1",
        params![payload.id],
        |row| row.get(0)
    ).map_err(error_response)?;
    
    // Update the pattern
    conn.execute(
        "UPDATE phase_patterns SET pattern = ?1, is_regex = ?2, enabled = ?3, priority = ?4 WHERE id = ?5",
        params![
            payload.pattern,
            payload.is_regex as i32,
            payload.enabled as i32,
            payload.priority,
            payload.id
        ],
    ).map_err(error_response)?;
    
    Ok(PhasePattern {
        id: payload.id,
        phase_id,
        pattern: payload.pattern,
        is_regex: payload.is_regex,
        enabled: payload.enabled,
        priority: payload.priority,
    })
}

/// Reload detection patterns for all running workers
#[command]
pub async fn patterns_reload_all() -> CommandResult<()> {
    use crate::workers::WORKER_MANAGER;
    WORKER_MANAGER.reload_all_patterns().await.map_err(error_response)
}

/// Reload detection patterns for a specific running worker
#[command]
pub async fn patterns_reload(account_id: i64) -> CommandResult<()> {
    use crate::workers::WORKER_MANAGER;
    WORKER_MANAGER.reload_patterns(account_id).await.map_err(error_response)
}
