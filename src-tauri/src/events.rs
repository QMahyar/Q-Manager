//! Tauri Events for Real-time Updates
//!
//! Emits events to the frontend for:
//! - Account status changes
//! - Phase detections
//! - Action detections
//! - Join attempts

use serde::{Deserialize, Serialize};
#[cfg(feature = "desktop")]
use tauri::{AppHandle, Emitter, Runtime};

use crate::ipc::{
    EVENT_ACCOUNT_LOG, EVENT_ACCOUNT_STATUS, EVENT_ACTION_DETECTED, EVENT_JOIN_ATTEMPT,
    EVENT_PHASE_DETECTED, EVENT_REGEX_VALIDATION_ERROR,
};

// ============================================================================
// Event Bus — transport-agnostic fan-out
// ============================================================================
//
// Every event is mirrored onto a process-wide broadcast channel in addition to
// the Tauri AppHandle. The desktop build ignores it (no subscribers); the
// headless web-server build subscribes and forwards envelopes to WebSocket
// clients. Publishing is skipped entirely when there are no subscribers, so the
// desktop path pays nothing.

/// A serialized event ready to ship to any transport (WebSocket, etc.).
#[derive(Debug, Clone, Serialize)]
pub struct EventEnvelope {
    pub event: String,
    pub payload: serde_json::Value,
}

static EVENT_BUS: once_cell::sync::Lazy<tokio::sync::broadcast::Sender<EventEnvelope>> =
    once_cell::sync::Lazy::new(|| tokio::sync::broadcast::channel(1024).0);

/// Subscribe to the global event stream (used by the web-server WS handler).
pub fn subscribe_events() -> tokio::sync::broadcast::Receiver<EventEnvelope> {
    EVENT_BUS.subscribe()
}

/// Publish an event to the bus. No-op (and no serialization cost) when there
/// are no subscribers — i.e. in the desktop build.
pub fn publish_to_bus<T: Serialize>(event: &str, payload: &T) {
    if EVENT_BUS.receiver_count() == 0 {
        return;
    }
    if let Ok(value) = serde_json::to_value(payload) {
        let _ = EVENT_BUS.send(EventEnvelope {
            event: event.to_string(),
            payload: value,
        });
    }
}

// ============================================================================
// Event Types
// ============================================================================

/// Account status changed event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountStatusEvent {
    pub account_id: i64,
    pub status: String, // "stopped", "starting", "running", "stopping", "error"
    pub message: Option<String>,
}

/// Phase detected event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseDetectedEvent {
    pub account_id: i64,
    pub account_name: String,
    pub phase_name: String,
    pub timestamp: String,
}

/// Action detected event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionDetectedEvent {
    pub account_id: i64,
    pub account_name: String,
    pub action_name: String,
    pub button_clicked: Option<String>,
    pub timestamp: String,
}

/// Join attempt event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinAttemptEvent {
    pub account_id: i64,
    pub account_name: String,
    pub attempt: i32,
    pub max_attempts: i32,
    pub success: bool,
    pub timestamp: String,
}

/// Log message event (for debugging)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    pub account_id: i64,
    pub account_name: String,
    pub level: String, // "info", "warn", "error", "debug"
    pub message: String,
    pub timestamp: String,
}

/// Regex validation error event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegexValidationEvent {
    pub scope: String, // "phase", "action", "ban_patterns"
    pub pattern: String,
    pub error: String,
}

// ============================================================================
// Event Emitter Helper
// ============================================================================

/// Helper to emit events to the frontend
#[cfg(feature = "desktop")]
pub struct EventEmitter<R: Runtime> {
    app: AppHandle<R>,
}

#[cfg(feature = "desktop")]
impl<R: Runtime> EventEmitter<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }

    /// Emit account status change
    pub fn account_status(&self, account_id: i64, status: &str, message: Option<String>) {
        let event = AccountStatusEvent {
            account_id,
            status: status.to_string(),
            message,
        };
        publish_to_bus(EVENT_ACCOUNT_STATUS, &event);
        let _ = self.app.emit(EVENT_ACCOUNT_STATUS, event);
    }

    /// Emit phase detected
    pub fn phase_detected(&self, account_id: i64, account_name: &str, phase_name: &str) {
        let event = PhaseDetectedEvent {
            account_id,
            account_name: account_name.to_string(),
            phase_name: phase_name.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        publish_to_bus(EVENT_PHASE_DETECTED, &event);
        let _ = self.app.emit(EVENT_PHASE_DETECTED, event);
    }

    /// Emit action detected
    pub fn action_detected(
        &self,
        account_id: i64,
        account_name: &str,
        action_name: &str,
        button_clicked: Option<String>,
    ) {
        let event = ActionDetectedEvent {
            account_id,
            account_name: account_name.to_string(),
            action_name: action_name.to_string(),
            button_clicked,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        publish_to_bus(EVENT_ACTION_DETECTED, &event);
        let _ = self.app.emit(EVENT_ACTION_DETECTED, event);
    }

    /// Emit join attempt
    pub fn join_attempt(
        &self,
        account_id: i64,
        account_name: &str,
        attempt: i32,
        max_attempts: i32,
        success: bool,
    ) {
        let event = JoinAttemptEvent {
            account_id,
            account_name: account_name.to_string(),
            attempt,
            max_attempts,
            success,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        publish_to_bus(EVENT_JOIN_ATTEMPT, &event);
        let _ = self.app.emit(EVENT_JOIN_ATTEMPT, event);
    }

    /// Emit log message
    pub fn log(&self, account_id: i64, account_name: &str, level: &str, message: &str) {
        let event = LogEvent {
            account_id,
            account_name: account_name.to_string(),
            level: level.to_string(),
            message: message.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        publish_to_bus(EVENT_ACCOUNT_LOG, &event);
        let _ = self.app.emit(EVENT_ACCOUNT_LOG, event);
    }

    /// Emit regex validation error
    pub fn regex_validation(&self, scope: &str, pattern: &str, error: &str) {
        let event = RegexValidationEvent {
            scope: scope.to_string(),
            pattern: pattern.to_string(),
            error: error.to_string(),
        };
        publish_to_bus(EVENT_REGEX_VALIDATION_ERROR, &event);
        let _ = self.app.emit(EVENT_REGEX_VALIDATION_ERROR, event);
    }
}

// ============================================================================
// Global Event Functions (for use without AppHandle)
// ============================================================================

#[cfg(feature = "desktop")]
use once_cell::sync::OnceCell;

/// Global app handle for emitting events.
/// AppHandle is Clone + Send + Sync so no Mutex is needed.
#[cfg(feature = "desktop")]
static GLOBAL_APP: OnceCell<AppHandle<tauri::Wry>> = OnceCell::new();

/// Initialize the global app handle (call from setup)
#[cfg(feature = "desktop")]
pub fn init_global_emitter(app: AppHandle<tauri::Wry>) {
    let _ = GLOBAL_APP.set(app);
}

/// Get the global app handle (cloned, so no lock required)
#[cfg(feature = "desktop")]
fn get_global_app() -> Option<AppHandle<tauri::Wry>> {
    GLOBAL_APP.get().cloned()
}

/// Get the global event emitter
#[cfg(feature = "desktop")]
pub fn global_emitter() -> Option<EventEmitter<tauri::Wry>> {
    get_global_app().map(EventEmitter::new)
}

// These global emitters build the event once, publish it to the transport bus
// (for the web-server build — works with no AppHandle), and additionally emit
// through Tauri when a desktop AppHandle is present.

/// Emit account status change (global)
pub fn emit_account_status(account_id: i64, status: &str, message: Option<String>) {
    let event = AccountStatusEvent {
        account_id,
        status: status.to_string(),
        message,
    };
    publish_to_bus(EVENT_ACCOUNT_STATUS, &event);
    #[cfg(feature = "desktop")]
    if let Some(app) = get_global_app() {
        let _ = app.emit(EVENT_ACCOUNT_STATUS, event);
        crate::tray::refresh_tray_menu(&app);
    }
}

/// Emit phase detected (global)
pub fn emit_phase_detected(account_id: i64, account_name: &str, phase_name: &str) {
    let event = PhaseDetectedEvent {
        account_id,
        account_name: account_name.to_string(),
        phase_name: phase_name.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    publish_to_bus(EVENT_PHASE_DETECTED, &event);
    #[cfg(feature = "desktop")]
    if let Some(app) = get_global_app() {
        let _ = app.emit(EVENT_PHASE_DETECTED, event);
    }
}

/// Emit action detected (global)
pub fn emit_action_detected(
    account_id: i64,
    account_name: &str,
    action_name: &str,
    button_clicked: Option<String>,
) {
    let event = ActionDetectedEvent {
        account_id,
        account_name: account_name.to_string(),
        action_name: action_name.to_string(),
        button_clicked,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    publish_to_bus(EVENT_ACTION_DETECTED, &event);
    #[cfg(feature = "desktop")]
    if let Some(app) = get_global_app() {
        let _ = app.emit(EVENT_ACTION_DETECTED, event);
    }
}

/// Emit join attempt (global)
pub fn emit_join_attempt(
    account_id: i64,
    account_name: &str,
    attempt: i32,
    max_attempts: i32,
    success: bool,
) {
    let event = JoinAttemptEvent {
        account_id,
        account_name: account_name.to_string(),
        attempt,
        max_attempts,
        success,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    publish_to_bus(EVENT_JOIN_ATTEMPT, &event);
    #[cfg(feature = "desktop")]
    if let Some(app) = get_global_app() {
        let _ = app.emit(EVENT_JOIN_ATTEMPT, event);
    }
}

/// Emit log message (global)
pub fn emit_log(account_id: i64, account_name: &str, level: &str, message: &str) {
    let event = LogEvent {
        account_id,
        account_name: account_name.to_string(),
        level: level.to_string(),
        message: message.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    publish_to_bus(EVENT_ACCOUNT_LOG, &event);
    #[cfg(feature = "desktop")]
    if let Some(app) = get_global_app() {
        let _ = app.emit(EVENT_ACCOUNT_LOG, event);
    }
}

/// Emit regex validation error (global)
pub fn emit_regex_validation(scope: &str, pattern: &str, error: &str) {
    let event = RegexValidationEvent {
        scope: scope.to_string(),
        pattern: pattern.to_string(),
        error: error.to_string(),
    };
    publish_to_bus(EVENT_REGEX_VALIDATION_ERROR, &event);
    #[cfg(feature = "desktop")]
    if let Some(app) = get_global_app() {
        let _ = app.emit(EVENT_REGEX_VALIDATION_ERROR, event);
    }
}

/// Emit a generic event (global)
pub fn emit_event<T: serde::Serialize + Clone>(event_name: &str, payload: T) {
    publish_to_bus(event_name, &payload);
    #[cfg(feature = "desktop")]
    if let Some(app) = GLOBAL_APP.get() {
        let _ = app.emit(event_name, payload);
    }
}
