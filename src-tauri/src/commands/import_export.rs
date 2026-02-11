//! Account Import/Export commands
//!
//! Import: Load a Telethon session from a file/folder
//! Export: Save account session to a ZIP file or raw folder

use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::command;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::commands::{error_response, CommandResult};
use crate::db::{self, ActionPatternCreate};
use crate::telethon;
use crate::validation::{validate_pattern, validate_priority};
use crate::workers::WORKER_MANAGER;

/// Get the sessions directory path
fn get_sessions_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    exe_dir.join("sessions")
}

/// Get session directory for a specific account
/// Note: Session directories are named by the database account ID, NOT the Telegram user_id.
/// This ensures consistency for imported accounts that may not have a user_id initially.
fn get_account_session_dir(account_id: i64) -> PathBuf {
    get_sessions_dir().join(format!("account_{}", account_id))
}

const PATTERN_EXPORT_VERSION: i32 = 1;

// ============================================================================
// Import
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub account_id: Option<i64>,
    pub account_name: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportCandidate {
    pub source_path: String,
    pub account_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConflict {
    pub source_path: String,
    pub account_name: String,
    pub existing_account_id: i64,
    pub existing_account_name: String,
    pub existing_user_id: Option<i64>,
    pub existing_phone: Option<String>,
    pub existing_last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreflight {
    pub conflicts: Vec<ImportConflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResolution {
    pub source_path: String,
    pub account_name: String,
    pub action: String,
    pub new_name: Option<String>,
    pub existing_account_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternExport {
    pub version: i32,
    pub phase_patterns: Vec<PatternPhaseRow>,
    pub action_patterns: Vec<PatternActionRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternPhaseRow {
    pub phase_id: Option<i64>,
    pub phase_name: Option<String>,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternActionRow {
    pub action_id: Option<i64>,
    pub action_name: Option<String>,
    pub step: i32,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternImportResult {
    pub imported: usize,
    pub updated: usize,
    pub skipped: usize,
    pub skipped_items: Vec<String>,
}

/// Preflight import to detect duplicate account names.
#[command]
pub fn account_import_preflight(
    candidates: Vec<ImportCandidate>,
) -> CommandResult<ImportPreflight> {
    let conn = db::get_conn().map_err(error_response)?;
    let mut conflicts = Vec::new();

    for candidate in candidates {
        let mut stmt = conn
            .prepare(
                "SELECT id, account_name, user_id, phone, last_seen_at \
                 FROM accounts WHERE account_name = ?1 COLLATE NOCASE",
            )
            .map_err(error_response)?;
        let mut rows = stmt
            .query(params![candidate.account_name.trim()])
            .map_err(error_response)?;
        if let Some(row) = rows.next().map_err(error_response)? {
            conflicts.push(ImportConflict {
                source_path: candidate.source_path,
                account_name: candidate.account_name,
                existing_account_id: row.get(0).map_err(error_response)?,
                existing_account_name: row.get(1).map_err(error_response)?,
                existing_user_id: row.get(2).map_err(error_response)?,
                existing_phone: row.get(3).map_err(error_response)?,
                existing_last_seen_at: row.get(4).map_err(error_response)?,
            });
        }
    }

    Ok(ImportPreflight { conflicts })
}

/// Import Telethon sessions from a directory or ZIP file with duplicate resolution.
#[command]
pub fn account_import_resolve(
    resolutions: Vec<ImportResolution>,
) -> CommandResult<Vec<ImportResult>> {
    let mut results = Vec::new();

    for resolution in resolutions {
        let action = resolution.action.to_lowercase();
        if action == "cancel" || action == "skip" {
            results.push(ImportResult {
                success: false,
                account_id: None,
                account_name: resolution.account_name,
                message: if action == "cancel" {
                    "Import canceled".to_string()
                } else {
                    "Import skipped".to_string()
                },
            });
            if action == "cancel" {
                break;
            }
            continue;
        }

        let chosen_name = if action == "rename" {
            resolution
                .new_name
                .clone()
                .unwrap_or_else(|| resolution.account_name.clone())
        } else {
            resolution.account_name.clone()
        };

        if action == "replace" {
            if let Some(existing_id) = resolution.existing_account_id {
                replace_existing_account(existing_id)?;
            }
        }

        let result = import_single_account(&resolution.source_path, &chosen_name);
        match result {
            Ok(item) => results.push(item),
            Err(err) => {
                results.push(ImportResult {
                    success: false,
                    account_id: None,
                    account_name: chosen_name,
                    message: format!("Import failed: {:?}", err),
                });
            }
        }
    }

    Ok(results)
}

fn replace_existing_account(account_id: i64) -> CommandResult<()> {
    // First stop the worker if running
    let _ = tauri::async_runtime::block_on(WORKER_MANAGER.stop_account(account_id));

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

    if let Some(uid) = user_id {
        let session_dir = sessions_dir.join(format!("account_{}", uid));
        if session_dir.exists() {
            let _ = std::fs::remove_dir_all(&session_dir);
        }
    }

    let session_dir_by_id = sessions_dir.join(format!("account_{}", account_id));
    if session_dir_by_id.exists() {
        let _ = std::fs::remove_dir_all(&session_dir_by_id);
    }

    Ok(())
}

fn import_single_account(source_path: &str, account_name: &str) -> CommandResult<ImportResult> {
    let source = PathBuf::from(source_path);

    if !source.exists() {
        return Ok(ImportResult {
            success: false,
            account_id: None,
            account_name: account_name.to_string(),
            message: "Source path does not exist".to_string(),
        });
    }

    // Create account in database first
    let conn = db::get_conn().map_err(error_response)?;

    conn.execute(
        "INSERT INTO accounts (account_name, status, created_at, updated_at) \
         VALUES (?1, 'stopped', datetime('now'), datetime('now'))",
        params![account_name],
    )
    .map_err(error_response)?;

    let account_id = conn.last_insert_rowid();

    // Create session directory
    let session_dir = get_account_session_dir(account_id);
    let copy_result: CommandResult<()> = (|| {
        fs::create_dir_all(&session_dir).map_err(error_response)?;

        // Check if source is a ZIP file or directory
        if source.is_file() && source.extension().map(|e| e == "zip").unwrap_or(false) {
            // Extract ZIP
            let file = fs::File::open(&source).map_err(error_response)?;
            let mut archive = zip::ZipArchive::new(file).map_err(error_response)?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(error_response)?;
                let outpath = match file.enclosed_name() {
                    Some(path) => session_dir.join(path),
                    None => continue,
                };

                if file.name().ends_with('/') {
                    fs::create_dir_all(&outpath).map_err(error_response)?;
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p).map_err(error_response)?;
                        }
                    }
                    let mut outfile = fs::File::create(&outpath).map_err(error_response)?;
                    std::io::copy(&mut file, &mut outfile).map_err(error_response)?;
                }
            }

            // Normalize session file name if needed
            let alt_session = session_dir.join("telethon.session");
            if !alt_session.exists() {
                if let Ok(entries) = fs::read_dir(&session_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().map(|e| e == "session").unwrap_or(false) {
                            let _ = fs::rename(&path, &alt_session);
                            break;
                        }
                    }
                }
            }
        } else if source.is_dir() {
            // Copy directory contents
            copy_dir_recursive(&source, &session_dir).map_err(error_response)?;

            // Normalize session file name if needed
            let alt_session = session_dir.join("telethon.session");
            if !alt_session.exists() {
                if let Ok(entries) = fs::read_dir(&session_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().map(|e| e == "session").unwrap_or(false) {
                            let _ = fs::rename(&path, &alt_session);
                            break;
                        }
                    }
                }
            }
        } else {
            // Single file - might be a .session file from Telethon
            let dest = if source.extension().map(|e| e == "session").unwrap_or(false) {
                session_dir.join("telethon.session")
            } else {
                session_dir.join(source.file_name().unwrap_or_default())
            };
            fs::copy(&source, &dest).map_err(error_response)?;
        }

        Ok(())
    })();

    if let Err(e) = copy_result {
        let _ = fs::remove_dir_all(&session_dir);
        if let Ok(conn) = db::get_conn() {
            let _ = conn.execute("DELETE FROM accounts WHERE id = ?1", params![account_id]);
        }
        return Err(e);
    }

    // Initialize group slots for the new account
    conn.execute(
        "INSERT INTO account_group_slots (account_id, slot, enabled, moderator_kind) VALUES (?1, 0, 0, 'main')",
        params![account_id],
    )
    .map_err(error_response)?;
    conn.execute(
        "INSERT INTO account_group_slots (account_id, slot, enabled, moderator_kind) VALUES (?1, 1, 0, 'main')",
        params![account_id],
    )
    .map_err(error_response)?;

    // Release database lock before Telethon validation
    drop(conn);

    // Validate the session with Telethon if available
    let validation_result = validate_imported_session(&session_dir, account_id);

    match validation_result {
        Ok(Some((user_id, telegram_name, phone))) => {
            let conn = db::get_conn().map_err(error_response)?;
            conn.execute(
                "UPDATE accounts SET user_id = ?1, telegram_name = ?2, phone = ?3, updated_at = datetime('now') WHERE id = ?4",
                params![user_id, telegram_name, phone, account_id],
            )
            .map_err(error_response)?;

            Ok(ImportResult {
                success: true,
                account_id: Some(account_id),
                account_name: account_name.to_string(),
                message: format!(
                    "Account imported and validated successfully (User: {})",
                    telegram_name.unwrap_or_default()
                ),
            })
        }
        Ok(None) => Ok(ImportResult {
            success: true,
            account_id: Some(account_id),
            account_name: account_name.to_string(),
            message: "Account imported successfully. Session validation skipped (Telethon worker not available or session requires re-login).".to_string(),
        }),
        Err(e) => {
            log::warn!("Session validation failed: {:?}", e);
            let conn = db::get_conn().map_err(error_response)?;
            let _ = conn.execute("DELETE FROM accounts WHERE id = ?1", params![account_id]);
            let _ = fs::remove_dir_all(&session_dir);

            Ok(ImportResult {
                success: false,
                account_id: None,
                account_name: account_name.to_string(),
                message: format!("Import failed: Session validation error - {:?}", e),
            })
        }
    }
}

/// Validate an imported session by connecting with Telethon
/// Returns Ok(Some((user_id, telegram_name, phone))) if valid
/// Returns Ok(None) if Telethon worker not available or session needs re-login
/// Returns Err if validation definitively failed
type SessionInfo = (i64, Option<String>, Option<String>);

fn validate_imported_session(
    session_dir: &std::path::Path,
    _account_id: i64,
) -> CommandResult<Option<SessionInfo>> {
    if telethon::assert_worker_exists().is_err() {
        log::info!("Telethon worker not available, skipping session validation");
        return Ok(None);
    }

    let conn = db::get_conn().map_err(error_response)?;
    let settings = db::get_settings(&conn).map_err(error_response)?;
    drop(conn);

    let api_id = match settings.api_id {
        Some(id) => id,
        None => {
            log::info!("API ID not configured, skipping session validation");
            return Ok(None);
        }
    };

    let api_hash = match settings.api_hash {
        Some(hash) => hash,
        None => {
            log::info!("API Hash not configured, skipping session validation");
            return Ok(None);
        }
    };

    let session_path = session_dir
        .join("telethon.session")
        .to_string_lossy()
        .to_string();
    let client = telethon::TelethonClient::spawn(api_id, &api_hash, &session_path)
        .map_err(error_response)?;
    let response = client
        .request("state", serde_json::json!({}))
        .map_err(error_response)?;
    if !response.ok {
        return Err(error_response(
            response
                .error
                .unwrap_or_else(|| "Telethon worker error".to_string()),
        ));
    }

    let payload = response.payload.unwrap_or(serde_json::json!({}));
    if payload.get("state").and_then(|s| s.as_str()) != Some("ready") {
        return Ok(None);
    }

    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).unwrap_or(0);
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
    let telegram_name = if last_name.is_empty() {
        first_name.clone()
    } else {
        format!("{} {}", first_name, last_name)
    };

    let _ = client.shutdown();

    if user_id <= 0 {
        return Err(error_response("Telethon session is not authorized"));
    }

    Ok(Some((user_id, Some(telegram_name), phone)))
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path)?;
        }
    }

    Ok(())
}

// ============================================================================
// Export
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub path: String,
    pub message: String,
}

/// Export format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    #[serde(rename = "zip")]
    Zip,
    #[serde(rename = "folder")]
    Folder,
}

/// Export an account's session
#[command]
pub fn account_export(
    account_id: i64,
    dest_path: String,
    format: ExportFormat,
) -> CommandResult<ExportResult> {
    // Get account info
    let conn = db::get_conn().map_err(error_response)?;

    let (account_name, user_id): (String, Option<i64>) = conn
        .query_row(
            "SELECT account_name, user_id FROM accounts WHERE id = ?1",
            params![account_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(error_response)?;

    drop(conn); // Release lock

    // Get session directory - try by user_id first (login flow), then by account_id (import flow)
    let sessions_dir = get_sessions_dir();
    let session_dir = if let Some(uid) = user_id {
        let dir_by_uid = sessions_dir.join(format!("account_{}", uid));
        if dir_by_uid.exists() {
            dir_by_uid
        } else {
            get_account_session_dir(account_id)
        }
    } else {
        get_account_session_dir(account_id)
    };

    if !session_dir.exists() {
        return Ok(ExportResult {
            success: false,
            path: String::new(),
            message: "Session directory not found. Account may not have been logged in."
                .to_string(),
        });
    }

    let dest = PathBuf::from(&dest_path);

    match format {
        ExportFormat::Zip => {
            // Create ZIP file
            let zip_path = if dest.extension().map(|e| e == "zip").unwrap_or(false) {
                dest
            } else {
                dest.join(format!("{}_session.zip", account_name))
            };

            if let Some(parent) = zip_path.parent() {
                fs::create_dir_all(parent).map_err(error_response)?;
            }

            let file = fs::File::create(&zip_path).map_err(error_response)?;
            let mut zip = ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

            // Add all files from session directory
            add_dir_to_zip(&mut zip, &session_dir, &session_dir, options)
                .map_err(error_response)?;

            zip.finish().map_err(error_response)?;

            Ok(ExportResult {
                success: true,
                path: zip_path.to_string_lossy().to_string(),
                message: format!("Session exported to {}", zip_path.display()),
            })
        }
        ExportFormat::Folder => {
            // Copy to destination folder
            let folder_path = dest.join(format!("{}_session", account_name));

            copy_dir_recursive(&session_dir, &folder_path).map_err(error_response)?;

            Ok(ExportResult {
                success: true,
                path: folder_path.to_string_lossy().to_string(),
                message: format!("Session exported to {}", folder_path.display()),
            })
        }
    }
}

/// Add a directory recursively to a ZIP archive
fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    base_path: &std::path::Path,
    current_path: &std::path::Path,
    options: SimpleFileOptions,
) -> Result<(), std::io::Error> {
    for entry in fs::read_dir(current_path)? {
        let entry = entry?;
        let path = entry.path();
        let name = path
            .strip_prefix(base_path)
            .map_err(|e| std::io::Error::other(e.to_string()))?
            .to_string_lossy()
            .to_string();

        if path.is_dir() {
            zip.add_directory(&name, options)
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            add_dir_to_zip(zip, base_path, &path, options)?;
        } else {
            zip.start_file(&name, options)
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            let mut file = fs::File::open(&path)?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)?;
            zip.write_all(&buffer)
                .map_err(|e| std::io::Error::other(e.to_string()))?;
        }
    }

    Ok(())
}

// ============================================================================
// Pattern Export/Import
// ============================================================================

fn phase_id_by_name(conn: &rusqlite::Connection, name: &str) -> CommandResult<Option<i64>> {
    let mut stmt = conn
        .prepare("SELECT id FROM phases WHERE name = ?1")
        .map_err(error_response)?;
    let mut rows = stmt.query(params![name]).map_err(error_response)?;
    if let Some(row) = rows.next().map_err(error_response)? {
        Ok(Some(row.get(0).map_err(error_response)?))
    } else {
        Ok(None)
    }
}

fn phase_exists(conn: &rusqlite::Connection, phase_id: i64) -> CommandResult<bool> {
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM phases WHERE id = ?1",
            params![phase_id],
            |row| row.get(0),
        )
        .map_err(error_response)?;
    Ok(exists > 0)
}

fn action_id_by_name(conn: &rusqlite::Connection, name: &str) -> CommandResult<Option<i64>> {
    let mut stmt = conn
        .prepare("SELECT id FROM actions WHERE name = ?1")
        .map_err(error_response)?;
    let mut rows = stmt.query(params![name]).map_err(error_response)?;
    if let Some(row) = rows.next().map_err(error_response)? {
        Ok(Some(row.get(0).map_err(error_response)?))
    } else {
        Ok(None)
    }
}

fn action_exists(conn: &rusqlite::Connection, action_id: i64) -> CommandResult<bool> {
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM actions WHERE id = ?1",
            params![action_id],
            |row| row.get(0),
        )
        .map_err(error_response)?;
    Ok(exists > 0)
}

#[command]
pub fn phase_patterns_export(path: String) -> CommandResult<PatternExport> {
    let conn = db::get_conn().map_err(error_response)?;
    let phase_patterns = db::list_all_phase_patterns(&conn).map_err(error_response)?;
    let phases = db::list_phases(&conn).map_err(error_response)?;
    let phase_names: std::collections::HashMap<i64, String> = phases
        .into_iter()
        .map(|phase| (phase.id, phase.name))
        .collect();

    let export = PatternExport {
        version: PATTERN_EXPORT_VERSION,
        phase_patterns: phase_patterns
            .into_iter()
            .map(|pattern| PatternPhaseRow {
                phase_id: Some(pattern.phase_id),
                phase_name: phase_names.get(&pattern.phase_id).cloned(),
                pattern: pattern.pattern,
                is_regex: pattern.is_regex,
                enabled: pattern.enabled,
                priority: pattern.priority,
            })
            .collect(),
        action_patterns: Vec::new(),
    };

    let json = serde_json::to_string_pretty(&export).map_err(error_response)?;
    fs::write(&path, json).map_err(error_response)?;

    Ok(export)
}

#[command]
pub fn action_patterns_export(path: String) -> CommandResult<PatternExport> {
    let conn = db::get_conn().map_err(error_response)?;
    let action_patterns = db::list_all_action_patterns(&conn).map_err(error_response)?;
    let actions = db::list_actions(&conn).map_err(error_response)?;
    let action_names: std::collections::HashMap<i64, String> = actions
        .into_iter()
        .map(|action| (action.id, action.name))
        .collect();

    let export = PatternExport {
        version: PATTERN_EXPORT_VERSION,
        phase_patterns: Vec::new(),
        action_patterns: action_patterns
            .into_iter()
            .map(|pattern| PatternActionRow {
                action_id: Some(pattern.action_id),
                action_name: action_names.get(&pattern.action_id).cloned(),
                step: pattern.step,
                pattern: pattern.pattern,
                is_regex: pattern.is_regex,
                enabled: pattern.enabled,
                priority: pattern.priority,
            })
            .collect(),
    };

    let json = serde_json::to_string_pretty(&export).map_err(error_response)?;
    fs::write(&path, json).map_err(error_response)?;

    Ok(export)
}

#[command]
pub fn phase_patterns_import(path: String) -> CommandResult<PatternImportResult> {
    let raw = fs::read_to_string(&path).map_err(error_response)?;
    let payload: PatternExport = serde_json::from_str(&raw).map_err(error_response)?;

    if payload.version != PATTERN_EXPORT_VERSION {
        return Err(error_response("Unsupported pattern export version"));
    }

    let conn = db::get_conn().map_err(error_response)?;
    let mut imported = 0usize;
    let mut updated = 0usize;
    let mut skipped = 0usize;
    let mut skipped_items = Vec::new();

    for item in payload.phase_patterns {
        validate_pattern(&item.pattern, item.is_regex).map_err(error_response)?;
        validate_priority(item.priority).map_err(error_response)?;

        let phase_id = if let Some(phase_id) = item.phase_id {
            if phase_exists(&conn, phase_id)? {
                Some(phase_id)
            } else {
                None
            }
        } else if let Some(name) = item.phase_name.as_deref() {
            phase_id_by_name(&conn, name)?
        } else {
            None
        };

        let Some(phase_id) = phase_id else {
            skipped += 1;
            skipped_items.push(format!("Phase pattern skipped (missing phase): {}", item.pattern));
            continue;
        };

        let data = db::PhasePatternCreate {
            phase_id,
            pattern: item.pattern,
            is_regex: item.is_regex,
            enabled: item.enabled,
            priority: item.priority,
        };

        let was_updated = db::upsert_phase_pattern(&conn, &data).map_err(error_response)?;
        if was_updated {
            updated += 1;
        } else {
            imported += 1;
        }
    }

    Ok(PatternImportResult {
        imported,
        updated,
        skipped,
        skipped_items,
    })
}

#[command]
pub fn action_patterns_import(path: String) -> CommandResult<PatternImportResult> {
    let raw = fs::read_to_string(&path).map_err(error_response)?;
    let payload: PatternExport = serde_json::from_str(&raw).map_err(error_response)?;

    if payload.version != PATTERN_EXPORT_VERSION {
        return Err(error_response("Unsupported pattern export version"));
    }

    let conn = db::get_conn().map_err(error_response)?;
    let mut imported = 0usize;
    let mut updated = 0usize;
    let mut skipped = 0usize;
    let mut skipped_items = Vec::new();

    for item in payload.action_patterns {
        validate_pattern(&item.pattern, item.is_regex).map_err(error_response)?;
        validate_priority(item.priority).map_err(error_response)?;

        let action_id = if let Some(action_id) = item.action_id {
            if action_exists(&conn, action_id)? {
                Some(action_id)
            } else {
                None
            }
        } else if let Some(name) = item.action_name.as_deref() {
            action_id_by_name(&conn, name)?
        } else {
            None
        };

        let Some(action_id) = action_id else {
            skipped += 1;
            skipped_items.push(format!("Action pattern skipped (missing action): {}", item.pattern));
            continue;
        };

        let data = ActionPatternCreate {
            action_id,
            pattern: item.pattern,
            is_regex: item.is_regex,
            enabled: item.enabled,
            priority: item.priority,
            step: item.step,
        };

        let was_updated = db::upsert_action_pattern(&conn, &data).map_err(error_response)?;
        if was_updated {
            updated += 1;
        } else {
            imported += 1;
        }
    }

    Ok(PatternImportResult {
        imported,
        updated,
        skipped,
        skipped_items,
    })
}

/// Get the path to an account's session directory (for file picker default)
#[command]
pub fn account_session_path(account_id: i64) -> CommandResult<Option<String>> {
    let conn = db::get_conn().map_err(error_response)?;
    let user_id: Option<i64> = conn
        .query_row(
            "SELECT user_id FROM accounts WHERE id = ?1",
            params![account_id],
            |row| row.get(0),
        )
        .ok();

    let sessions_dir = get_sessions_dir();
    let session_dir = if let Some(uid) = user_id {
        let dir_by_uid = sessions_dir.join(format!("account_{}", uid));
        if dir_by_uid.exists() {
            dir_by_uid
        } else {
            get_account_session_dir(account_id)
        }
    } else {
        get_account_session_dir(account_id)
    };

    if session_dir.exists() {
        Ok(Some(session_dir.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}
