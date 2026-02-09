//! Tauri Events for Real-time Updates
//!
//! Emits events to the frontend for:
//! - Account status changes
//! - Phase detections
//! - Action detections
//! - Join attempts

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use crate::ipc::{EVENT_ACCOUNT_LOG, EVENT_ACCOUNT_STATUS, EVENT_ACTION_DETECTED, EVENT_JOIN_ATTEMPT, EVENT_PHASE_DETECTED, EVENT_REGEX_VALIDATION_ERROR};

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
pub struct EventEmitter<R: Runtime> {
    app: AppHandle<R>,
}

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
        let _ = self.app.emit(EVENT_PHASE_DETECTED, event);
    }

    /// Emit action detected
    pub fn action_detected(&self, account_id: i64, account_name: &str, action_name: &str, button_clicked: Option<String>) {
        let event = ActionDetectedEvent {
            account_id,
            account_name: account_name.to_string(),
            action_name: action_name.to_string(),
            button_clicked,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        let _ = self.app.emit(EVENT_ACTION_DETECTED, event);
    }

    /// Emit join attempt
    pub fn join_attempt(&self, account_id: i64, account_name: &str, attempt: i32, max_attempts: i32, success: bool) {
        let event = JoinAttemptEvent {
            account_id,
            account_name: account_name.to_string(),
            attempt,
            max_attempts,
            success,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
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
        let _ = self.app.emit(EVENT_ACCOUNT_LOG, event);
    }

    /// Emit regex validation error
    pub fn regex_validation(&self, scope: &str, pattern: &str, error: &str) {
        let event = RegexValidationEvent {
            scope: scope.to_string(),
            pattern: pattern.to_string(),
            error: error.to_string(),
        };
        let _ = self.app.emit(EVENT_REGEX_VALIDATION_ERROR, event);
    }
}

// ============================================================================
// Global Event Functions (for use without AppHandle)
// ============================================================================

use once_cell::sync::OnceCell;
use std::sync::Mutex;

/// Global app handle for emitting events
static GLOBAL_APP: OnceCell<Mutex<Option<AppHandle<tauri::Wry>>>> = OnceCell::new();

/// Initialize the global app handle (call from setup)
pub fn init_global_emitter(app: AppHandle<tauri::Wry>) {
    let _ = GLOBAL_APP.set(Mutex::new(Some(app)));
}

/// Get the global event emitter
pub fn global_emitter() -> Option<EventEmitter<tauri::Wry>> {
    GLOBAL_APP.get()
        .and_then(|m| m.lock().ok())
        .and_then(|guard| guard.clone())
        .map(EventEmitter::new)
}

/// Emit account status change (global)
pub fn emit_account_status(account_id: i64, status: &str, message: Option<String>) {
    if let Some(emitter) = global_emitter() {
        emitter.account_status(account_id, status, message.clone());
    }
    
    // Refresh tray menu when account status changes
    if let Some(app_mutex) = GLOBAL_APP.get() {
        if let Ok(guard) = app_mutex.lock() {
            if let Some(app) = guard.as_ref() {
                crate::tray::refresh_tray_menu(app);
            }
        }
    }
}

/// Emit phase detected (global)
pub fn emit_phase_detected(account_id: i64, account_name: &str, phase_name: &str) {
    if let Some(emitter) = global_emitter() {
        emitter.phase_detected(account_id, account_name, phase_name);
    }
}

/// Emit action detected (global)
pub fn emit_action_detected(account_id: i64, account_name: &str, action_name: &str, button_clicked: Option<String>) {
    if let Some(emitter) = global_emitter() {
        emitter.action_detected(account_id, account_name, action_name, button_clicked);
    }
}

/// Emit join attempt (global)
pub fn emit_join_attempt(account_id: i64, account_name: &str, attempt: i32, max_attempts: i32, success: bool) {
    if let Some(emitter) = global_emitter() {
        emitter.join_attempt(account_id, account_name, attempt, max_attempts, success);
    }
}

/// Emit log message (global)
pub fn emit_log(account_id: i64, account_name: &str, level: &str, message: &str) {
    if let Some(emitter) = global_emitter() {
        emitter.log(account_id, account_name, level, message);
    }
}

/// Emit regex validation error (global)
pub fn emit_regex_validation(scope: &str, pattern: &str, error: &str) {
    if let Some(emitter) = global_emitter() {
        emitter.regex_validation(scope, pattern, error);
    }
}

/// Emit a generic event (global)
pub fn emit_event<T: serde::Serialize + Clone>(event_name: &str, payload: T) {
    if let Some(app_mutex) = GLOBAL_APP.get() {
        if let Ok(guard) = app_mutex.lock() {
            if let Some(app) = guard.as_ref() {
                let _ = app.emit(event_name, payload);
            }
        }
    }
}
