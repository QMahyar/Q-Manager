//! Headless web-server mode.
//!
//! Serves the built React UI and bridges the frontend to the same backend the
//! Tauri desktop app uses:
//!   - `POST /api/invoke/:command`  → calls the corresponding command function
//!   - `GET  /api/events` (WebSocket) → streams backend events from the bus
//!   - `GET  /api/version`          → app version (replaces `@tauri-apps/api/app`)
//!   - everything else              → embedded SPA assets (index.html fallback)
//!
//! This lets a single binary run on any platform Rust targets — including
//! Termux/ARM where a desktop webview is unavailable — and be used from any
//! browser, local or over LAN.

use axum::{
    body::Bytes,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path,
    },
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rust_embed::Embed;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

use crate::commands::{self as c, error_response};
use crate::errors::ErrorResponse;

#[derive(Embed)]
#[folder = "$CARGO_MANIFEST_DIR/../dist"]
struct Assets;

// ----------------------------------------------------------------------------
// Argument helpers
// ----------------------------------------------------------------------------

/// Extract and deserialize a single named argument from the invoke payload.
/// Missing keys deserialize from `null` (so `Option<_>` params become `None`).
fn field<T: DeserializeOwned>(args: &Value, key: &str) -> Result<T, ErrorResponse> {
    serde_json::from_value(args.get(key).cloned().unwrap_or(Value::Null))
        .map_err(|e| error_response(format!("argument '{key}': {e}")))
}

/// Serialize a command result into a JSON value for the HTTP response.
fn jv<T: serde::Serialize>(value: T) -> Result<Value, ErrorResponse> {
    serde_json::to_value(value).map_err(error_response)
}

/// Run a blocking command on the blocking thread pool. Required for sync
/// commands that internally `block_on` (e.g. import resolve) or do blocking
/// Telethon IPC (session refresh) — running those directly on a reactor thread
/// would stall it or panic.
async fn blocking<T, F>(f: F) -> Result<T, ErrorResponse>
where
    F: FnOnce() -> Result<T, ErrorResponse> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| error_response(format!("background task failed: {e}")))?
}

// ----------------------------------------------------------------------------
// Command dispatch — mirrors lib.rs `invoke_handler!`
// ----------------------------------------------------------------------------

async fn dispatch(command: &str, args: Value) -> Result<Value, ErrorResponse> {
    match command {
        // Settings
        "settings_get" => jv(c::settings_get()?),
        "settings_update" => jv(c::settings_update(field(&args, "payload")?)?),

        // Accounts
        "accounts_list" => jv(c::accounts_list()?),
        "account_create" => jv(c::account_create(field(&args, "payload")?)?),
        "account_delete" => jv(c::account_delete(field(&args, "accountId")?).await?),
        "account_start" => jv(c::account_start(field(&args, "accountId")?).await?),
        "account_stop" => jv(c::account_stop(field(&args, "accountId")?).await?),
        "accounts_start_all" => jv(c::accounts_start_all().await?),
        "accounts_stop_all" => jv(c::accounts_stop_all().await?),
        "accounts_start_selected" => {
            jv(c::accounts_start_selected(field(&args, "accountIds")?).await?)
        }
        "accounts_stop_selected" => {
            jv(c::accounts_stop_selected(field(&args, "accountIds")?).await?)
        }
        "account_update" => jv(c::account_update(field(&args, "payload")?)?),
        "account_get" => jv(c::account_get(field(&args, "accountId")?)?),
        "account_name_exists" => jv(c::account_name_exists(field(&args, "name")?)?),
        "account_refresh_session" => {
            // Spawns a Telethon worker and does blocking IPC — keep it off the
            // async reactor threads.
            let account_id: i64 = field(&args, "accountId")?;
            jv(blocking(move || c::account_refresh_session(account_id)).await?)
        }

        // Phases
        "phases_list" => jv(c::phases_list()?),
        "phase_patterns_list" => jv(c::phase_patterns_list(field(&args, "phaseId")?)?),
        "phase_pattern_create" => jv(c::phase_pattern_create(field(&args, "payload")?)?),
        "phase_pattern_delete" => jv(c::phase_pattern_delete(field(&args, "patternId")?)?),
        "phase_pattern_update" => jv(c::phase_pattern_update(field(&args, "payload")?)?),
        "phase_update_priority" => {
            // Frontend sends { payload: { phaseId, priority } }.
            let p: Value = field(&args, "payload")?;
            jv(c::phase_update_priority(
                field(&p, "phaseId")?,
                field(&p, "priority")?,
            )?)
        }
        "patterns_reload_all" => jv(c::patterns_reload_all().await?),
        "patterns_reload" => jv(c::patterns_reload(field(&args, "accountId")?).await?),

        // Actions
        "actions_list" => jv(c::actions_list()?),
        "action_create" => jv(c::action_create(field(&args, "payload")?)?),
        "action_delete" => jv(c::action_delete(field(&args, "actionId")?)?),
        "action_update" => jv(c::action_update(field(&args, "payload")?)?),
        "action_patterns_list" => jv(c::action_patterns_list(field(&args, "actionId")?)?),
        "action_pattern_create" => jv(c::action_pattern_create(field(&args, "payload")?)?),
        "action_pattern_delete" => jv(c::action_pattern_delete(field(&args, "patternId")?)?),
        "action_pattern_update" => jv(c::action_pattern_update(field(&args, "payload")?)?),

        // Login
        "login_check_telethon" => jv(c::login_check_telethon()?),
        "login_start" => {
            jv(c::login_start(field(&args, "apiId")?, field(&args, "apiHash")?).await?)
        }
        "login_get_state" => jv(c::login_get_state(field(&args, "token")?).await?),
        "login_send_phone" => {
            jv(c::login_send_phone(field(&args, "token")?, field(&args, "phone")?).await?)
        }
        "login_send_code" => {
            jv(c::login_send_code(field(&args, "token")?, field(&args, "code")?).await?)
        }
        "login_send_password" => jv(c::login_send_password(
            field(&args, "token")?,
            field(&args, "password")?,
        )
        .await?),
        "login_complete" => jv(c::login_complete(
            field(&args, "token")?,
            field(&args, "accountName")?,
            field(&args, "apiIdOverride")?,
            field(&args, "apiHashOverride")?,
        )
        .await?),
        "login_cancel" => jv(c::login_cancel(field(&args, "token")?).await?),

        // Group slots
        "group_slots_get" => jv(c::group_slots_get(field(&args, "accountId")?)?),
        "group_slot_update" => jv(c::group_slot_update(field(&args, "payload")?)?),
        "group_slots_init" => jv(c::group_slots_init(field(&args, "accountId")?)?),
        "account_fetch_groups" => {
            jv(c::account_fetch_groups(field(&args, "accountId")?).await?)
        }

        // Targets
        "target_defaults_get" => jv(c::target_defaults_get(field(&args, "actionId")?)?),
        "target_default_set" => jv(c::target_default_set(
            field(&args, "actionId")?,
            field(&args, "ruleJson")?,
        )?),
        "target_override_get" => jv(c::target_override_get(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
        )?),
        "target_override_set" => jv(c::target_override_set(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
            field(&args, "ruleJson")?,
        )?),
        "target_override_delete" => jv(c::target_override_delete(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
        )?),
        "target_overrides_list" => jv(c::target_overrides_list(field(&args, "accountId")?)?),
        "blacklist_list" => jv(c::blacklist_list(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
        )?),
        "blacklist_add" => jv(c::blacklist_add(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
            field(&args, "buttonText")?,
        )?),
        "blacklist_remove" => jv(c::blacklist_remove(field(&args, "entryId")?)?),
        "delay_default_get" => jv(c::delay_default_get(field(&args, "actionId")?)?),
        "delay_default_set" => jv(c::delay_default_set(
            field(&args, "actionId")?,
            field(&args, "minSeconds")?,
            field(&args, "maxSeconds")?,
        )?),
        "delay_override_get" => jv(c::delay_override_get(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
        )?),
        "delay_override_set" => jv(c::delay_override_set(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
            field(&args, "minSeconds")?,
            field(&args, "maxSeconds")?,
        )?),
        "delay_override_delete" => jv(c::delay_override_delete(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
        )?),
        "target_pairs_list" => jv(c::target_pairs_list(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
        )?),
        "target_pair_add" => jv(c::target_pair_add(
            field(&args, "accountId")?,
            field(&args, "actionId")?,
            field(&args, "targetA")?,
            field(&args, "targetB")?,
        )?),
        "target_pair_remove" => jv(c::target_pair_remove(field(&args, "pairId")?)?),
        "targets_copy" => jv(c::targets_copy(
            field(&args, "fromAccountId")?,
            field(&args, "toAccountIds")?,
            field(&args, "actionIds")?,
        )?),

        // Import / Export
        "account_import_preflight" => {
            jv(c::account_import_preflight(field(&args, "candidates")?)?)
        }
        "account_import_resolve" => {
            // Internally uses block_on(stop_account); must not run on a reactor
            // thread or tokio panics ("runtime within a runtime").
            let resolutions: Vec<crate::commands::ImportResolution> =
                field(&args, "resolutions")?;
            jv(blocking(move || c::account_import_resolve(resolutions)).await?)
        }
        "phase_patterns_export" => jv(c::phase_patterns_export(field(&args, "path")?)?),
        "phase_patterns_import" => jv(c::phase_patterns_import(field(&args, "path")?)?),
        "action_patterns_export" => jv(c::action_patterns_export(field(&args, "path")?)?),
        "action_patterns_import" => jv(c::action_patterns_import(field(&args, "path")?)?),
        "account_export" => jv(c::account_export(
            field(&args, "accountId")?,
            field(&args, "destPath")?,
            field(&args, "format")?,
        )?),
        "accounts_export" => jv(c::accounts_export(
            field(&args, "accountIds")?,
            field(&args, "destPath")?,
            field(&args, "format")?,
        )?),
        "account_session_path" => jv(c::account_session_path(field(&args, "accountId")?)?),

        // Startup checks (these return plain values, not CommandResult)
        "check_telethon_available" => jv(c::check_telethon_available()),
        "check_telethon" => jv(c::check_telethon()),
        "check_account_start" => jv(c::check_account_start(field(&args, "accountId")?)),
        "check_can_login" => jv(c::check_can_login(
            field(&args, "apiIdOverride")?,
            field(&args, "apiHashOverride")?,
        )),
        "check_system" => jv(c::check_system()),
        "diagnostics_snapshot" => jv(c::diagnostics_snapshot().await),

        other => Err(error_response(format!("Unknown command: {other}"))),
    }
}

// ----------------------------------------------------------------------------
// HTTP handlers
// ----------------------------------------------------------------------------

async fn invoke_handler(Path(command): Path<String>, body: Bytes) -> Response {
    let args: Value = if body.is_empty() {
        Value::Null
    } else {
        match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(e) => {
                let err = json!({"code":"BAD_REQUEST","message":format!("Invalid JSON body: {e}"),"details":null});
                return (StatusCode::BAD_REQUEST, Json(err)).into_response();
            }
        }
    };

    match dispatch(&command, args).await {
        Ok(value) => Json(value).into_response(),
        // Mirror Tauri's reject semantics: status 400 + the serialized ErrorResponse,
        // so the frontend's existing error handling parses it unchanged.
        Err(err) => (StatusCode::BAD_REQUEST, Json(err)).into_response(),
    }
}

async fn version_handler() -> Json<Value> {
    Json(json!({ "version": env!("CARGO_PKG_VERSION") }))
}

async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    let mut rx = crate::events::subscribe_events();
    loop {
        tokio::select! {
            received = rx.recv() => match received {
                Ok(envelope) => {
                    if let Ok(text) = serde_json::to_string(&envelope) {
                        if socket.send(Message::Text(text)).await.is_err() {
                            break;
                        }
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break, // sender dropped
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(_)) => {} // ignore client → server messages (pings, etc.)
                _ => break,       // closed or errored
            },
        }
    }
}

async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match <Assets as Embed>::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                [(header::CONTENT_TYPE, mime.as_ref())],
                content.data.into_owned(),
            )
                .into_response()
        }
        // SPA fallback: unknown routes (e.g. /accounts) serve index.html.
        None => match <Assets as Embed>::get("index.html") {
            Some(content) => (
                [(header::CONTENT_TYPE, "text/html")],
                content.data.into_owned(),
            )
                .into_response(),
            None => (
                StatusCode::NOT_FOUND,
                "UI assets not bundled. Build the frontend (npm run build) before compiling the server.",
            )
                .into_response(),
        },
    }
}

fn router() -> Router {
    Router::new()
        .route("/api/invoke/:command", post(invoke_handler))
        .route("/api/version", get(version_handler))
        .route("/api/events", get(ws_handler))
        .fallback(static_handler)
}

/// Start the headless web server, blocking until shutdown.
pub async fn serve(host: &str, port: u16) -> Result<(), String> {
    // Same startup housekeeping the desktop build does in `setup`.
    if let Ok(conn) = crate::db::get_conn() {
        if let Ok(accounts) = crate::db::list_accounts(&conn) {
            for account in accounts {
                if account.status != "stopped" && account.status != "error" {
                    let _ = crate::db::update_account_status(&conn, account.id, "stopped");
                }
            }
        }
    }
    match crate::telethon::assert_worker_exists() {
        Ok(()) => log::info!("Telethon worker available"),
        Err(e) => log::warn!("Telethon worker not available: {}", e.message),
    }

    let addr = format!("{host}:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind {addr}: {e}"))?;

    log::info!("Q Manager is running — open it in your browser:");
    log::info!("  Local:   http://localhost:{port}");
    if let Ok(ip) = local_ip_address::local_ip() {
        log::info!("  Network: http://{ip}:{port}  (phones/other devices on your LAN)");
    }

    axum::serve(listener, router())
        .await
        .map_err(|e| format!("Server error: {e}"))?;
    Ok(())
}
