//! Login wizard commands
//! 
//! Tauri commands for the Telethon authentication flow.

use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::command;
use serde::Serialize;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};

static LOGIN_SESSIONS: Lazy<Mutex<HashMap<String, TelethonLoginSession>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

const LOGIN_RATE_LIMIT_SECONDS: u64 = 2;
static LOGIN_RATE_LIMIT: Lazy<StdMutex<HashMap<String, Instant>>> =
    Lazy::new(|| StdMutex::new(HashMap::new()));

use crate::db;
use crate::telethon;
use crate::telethon::login_session::{AuthState, TelethonLoginSession};
use crate::validation::{validate_phone_number, validate_account_name};
use crate::commands::{CommandResult, error_response};

/// Login progress event for UI feedback
#[derive(Debug, Clone, Serialize)]
pub struct LoginProgressEvent {
    pub token: String,
    pub step: String,
    pub message: String,
    pub progress: u8, // 0-100
}

/// Emit a login progress event
fn emit_login_progress(token: &str, step: &str, message: &str, progress: u8) {
    let event = LoginProgressEvent {
        token: token.to_string(),
        step: step.to_string(),
        message: message.to_string(),
        progress,
    };
    crate::events::emit_event(crate::ipc::EVENT_LOGIN_PROGRESS, event);
}

/// Generate a unique session token
fn generate_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("session_{}", timestamp)
}

fn check_rate_limit(token: &str) -> Result<(), crate::commands::ErrorResponse> {
    let mut map = LOGIN_RATE_LIMIT.lock().map_err(|_| error_response("Rate limiter unavailable"))?;
    if let Some(last) = map.get(token) {
        if last.elapsed() < Duration::from_secs(LOGIN_RATE_LIMIT_SECONDS) {
            return Err(error_response("Please wait a moment before retrying."));
        }
    }
    map.insert(token.to_string(), Instant::now());
    Ok(())
}

/// Get the sessions directory
fn get_sessions_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    
    exe_dir.join("sessions")
}

/// Check if Telethon worker is available
#[command]
pub fn login_check_telethon() -> CommandResult<bool> {
    telethon::assert_worker_exists()?;
    Ok(true)
}

/// Start a new login session
#[command]
pub async fn login_start(api_id: Option<i64>, api_hash: Option<String>) -> CommandResult<LoginStartResult> {
    let temp_token = generate_token();
    emit_login_progress(&temp_token, "init", "Loading API credentials...", 10);

    telethon::assert_worker_exists()?;

    // Get API credentials (from params or global settings)
    let (api_id, api_hash) = if let (Some(id), Some(hash)) = (api_id, api_hash) {
        (id, hash)
    } else {
        let conn = db::get_conn().map_err(error_response)?;
        let settings = db::get_settings(&conn).map_err(error_response)?;

        let id = settings.api_id.ok_or_else(|| error_response("API ID not configured. Please set it in Settings."))?;
        let hash = settings.api_hash.ok_or_else(|| error_response("API Hash not configured. Please set it in Settings."))?;
        (id, hash)
    };

    emit_login_progress(&temp_token, "init", "Creating session directory...", 30);

    let token = temp_token;
    let session_dir = get_sessions_dir().join(&token);
    std::fs::create_dir_all(&session_dir).map_err(error_response)?;

    emit_login_progress(&token, "init", "Starting Telethon worker...", 70);

    let session_path = session_dir.join("telethon.session").to_string_lossy().to_string();
    let client = telethon::TelethonClient::spawn(api_id, &api_hash, &session_path).map_err(error_response)?;

    emit_login_progress(&token, "init", "Worker ready", 90);

    let state_payload = client
        .request("state", serde_json::json!({}))
        .map_err(error_response)?;

    if !state_payload.ok {
        return Err(error_response(state_payload.error.unwrap_or_else(|| "Telethon worker error".to_string())));
    }

    let state_value = state_payload.payload.unwrap_or(serde_json::json!({}));
    let state: AuthState = serde_json::from_value(state_value).map_err(error_response)?;

    let mut sessions = LOGIN_SESSIONS.lock().await;
    sessions.insert(token.clone(), TelethonLoginSession::new(api_id, api_hash, session_dir).map_err(error_response)?);
    emit_login_progress(&token, "ready", "Ready for phone number", 100);

    Ok(LoginStartResult { token, state })
}

#[derive(serde::Serialize)]
pub struct LoginStartResult {
    pub token: String,
    pub state: AuthState,
}

/// Get current login state
#[command]
pub async fn login_get_state(token: String) -> CommandResult<AuthState> {
    let mut sessions = LOGIN_SESSIONS.lock().await;
    let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
    session.request_state().map_err(error_response)
}

/// Send phone number
#[command]
pub async fn login_send_phone(token: String, phone: String) -> CommandResult<AuthState> {
    // Validate phone number
    validate_phone_number(&phone).map_err(error_response)?;
    check_rate_limit(&token)?;
    
    emit_login_progress(&token, "phone", "Sending phone number...", 30);
    
    // Send phone number (acquire lock briefly)
    {
        let mut sessions = LOGIN_SESSIONS.lock().await;
        let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
        session.send_phone_number(&phone).map_err(error_response)?;
    }

    emit_login_progress(&token, "phone", "Waiting for verification code...", 70);

    let mut sessions = LOGIN_SESSIONS.lock().await;
    let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
    let state = session.request_state().map_err(error_response)?;

    emit_login_progress(&token, "phone", "Phone number accepted", 100);
    Ok(state)
}

/// Send verification code
#[command]
pub async fn login_send_code(token: String, code: String) -> CommandResult<AuthState> {
    check_rate_limit(&token)?;
    emit_login_progress(&token, "code", "Verifying code...", 50);
    
    // Send the code (acquire lock briefly)
    {
        let mut sessions = LOGIN_SESSIONS.lock().await;
        let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
        session.send_code(&code).map_err(error_response)?;
    }

    emit_login_progress(&token, "code", "Processing verification...", 80);

    let mut sessions = LOGIN_SESSIONS.lock().await;
    let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
    let state = session.request_state().map_err(error_response)?;

    emit_login_progress(&token, "code", "Code verified", 100);
    Ok(state)
}

/// Send 2FA password
#[command]
pub async fn login_send_password(token: String, password: String) -> CommandResult<AuthState> {
    check_rate_limit(&token)?;
    emit_login_progress(&token, "password", "Verifying 2FA password...", 50);
    
    // Send password (acquire lock briefly)
    {
        let mut sessions = LOGIN_SESSIONS.lock().await;
        let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
        session.send_password(&password).map_err(error_response)?;
    }

    emit_login_progress(&token, "password", "Processing authentication...", 80);

    let mut sessions = LOGIN_SESSIONS.lock().await;
    let session = sessions.get_mut(&token).ok_or_else(|| error_response("Session not found"))?;
    let state = session.request_state().map_err(error_response)?;

    emit_login_progress(&token, "password", "Authentication complete", 100);
    Ok(state)
}

/// Complete login and create account
#[command]
pub async fn login_complete(
    token: String,
    account_name: String,
    api_id_override: Option<i64>,
    api_hash_override: Option<String>
) -> CommandResult<crate::db::Account> {
    // Validate account name
    validate_account_name(&account_name).map_err(error_response)?;
    
    let mut sessions = LOGIN_SESSIONS.lock().await;
    let session = sessions.remove(&token).ok_or_else(|| error_response("Session not found"))?;

    // Check if login was successful
    let (user_id, telegram_name, phone) = match &session.state {
        AuthState::Ready { user_id, first_name, last_name, phone } => {
            let full_name = if last_name.is_empty() {
                first_name.clone()
            } else {
                format!("{} {}", first_name, last_name)
            };
            (*user_id, full_name, phone.clone())
        }
        _ => return Err(error_response("Login not complete")),
    };

    if user_id <= 0 {
        session.shutdown();
        return Err(error_response("Failed to fetch Telegram user info. Please retry login."));
    }

    session.shutdown();

    // Move session folder to permanent location
    let temp_dir = get_sessions_dir().join(&token);
    let perm_dir = get_sessions_dir().join(format!("account_{}", user_id));
    
    if perm_dir.exists() {
        std::fs::remove_dir_all(&perm_dir).ok();
    }
    if let Err(err) = std::fs::rename(&temp_dir, &perm_dir) {
        // If rename fails (e.g., across filesystems), fall back to copy + remove
        if let Err(copy_err) = crate::utils::fs::copy_dir_recursive(&temp_dir, &perm_dir) {
            return Err(error_response(format!("Failed to move session directory: {}", copy_err)));
        }
        if let Err(remove_err) = std::fs::remove_dir_all(&temp_dir) {
            log::warn!("Failed to remove temp session directory {:?}: {}", temp_dir, remove_err);
        }
        log::warn!("Rename failed ({}) - session directory copied instead", err);
    }
    
    // Create account in database
    let conn = db::get_conn().map_err(error_response)?;
    
    let account_data = db::AccountCreate {
        account_name,
        telegram_name: Some(telegram_name),
        phone: Some(phone),
        user_id: Some(user_id),
        api_id_override,
        api_hash_override,
    };
    
    let account_id = db::create_account(&conn, &account_data).map_err(error_response)?;
    
    // Fetch and return the created account
    let accounts = db::list_accounts(&conn).map_err(error_response)?;
    accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| error_response("Failed to find created account"))
}

/// Cancel login and cleanup
#[command]
pub async fn login_cancel(token: String) -> CommandResult<()> {
    let mut sessions = LOGIN_SESSIONS.lock().await;
    
    if let Some(session) = sessions.remove(&token) {
        session.shutdown();
    }
    
    // Cleanup temp session folder
    let temp_dir = get_sessions_dir().join(&token);
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir).ok();
    }
    
    Ok(())
}
