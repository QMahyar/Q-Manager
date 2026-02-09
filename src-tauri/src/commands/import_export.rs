//! Account Import/Export commands
//!
//! Import: Load a Telethon session from a file/folder
//! Export: Save account session to a ZIP file or raw folder

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::command;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::commands::{error_response, CommandResult};
use crate::db;
use crate::telethon;

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

/// Import a Telethon session from a directory or ZIP file
#[command]
pub fn account_import(source_path: String, account_name: String) -> CommandResult<ImportResult> {
    let source = PathBuf::from(&source_path);

    if !source.exists() {
        return Ok(ImportResult {
            success: false,
            account_id: None,
            account_name,
            message: "Source path does not exist".to_string(),
        });
    }

    // Create account in database first
    let conn = db::get_conn().map_err(error_response)?;

    conn.execute(
        "INSERT INTO accounts (account_name, status, created_at, updated_at) 
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
    ).map_err(error_response)?;
    conn.execute(
        "INSERT INTO account_group_slots (account_id, slot, enabled, moderator_kind) VALUES (?1, 1, 0, 'main')",
        params![account_id],
    ).map_err(error_response)?;

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
            ).map_err(error_response)?;

            Ok(ImportResult {
                success: true,
                account_id: Some(account_id),
                account_name,
                message: format!("Account imported and validated successfully (User: {})", telegram_name.unwrap_or_default()),
            })
        }
        Ok(None) => Ok(ImportResult {
            success: true,
            account_id: Some(account_id),
            account_name,
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
                account_name,
                message: format!("Import failed: Session validation error - {:?}", e),
            })
        }
    }
}

/// Validate an imported session by connecting with Telethon
/// Returns Ok(Some((user_id, telegram_name, phone))) if valid
/// Returns Ok(None) if Telethon worker not available or session needs re-login
/// Returns Err if validation definitively failed
fn validate_imported_session(
    session_dir: &PathBuf,
    _account_id: i64,
) -> CommandResult<Option<(i64, Option<String>, Option<String>)>> {
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
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
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
    base_path: &PathBuf,
    current_path: &PathBuf,
    options: SimpleFileOptions,
) -> Result<(), std::io::Error> {
    for entry in fs::read_dir(current_path)? {
        let entry = entry?;
        let path = entry.path();
        let name = path
            .strip_prefix(base_path)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?
            .to_string_lossy()
            .to_string();

        if path.is_dir() {
            zip.add_directory(&name, options)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            add_dir_to_zip(zip, base_path, &path, options)?;
        } else {
            zip.start_file(&name, options)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            let mut file = fs::File::open(&path)?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)?;
            zip.write_all(&buffer)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
        }
    }

    Ok(())
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
