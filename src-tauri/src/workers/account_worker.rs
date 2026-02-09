//! Account worker for Q Manager
//!
//! Manages a single Telegram account's automation lifecycle.

use rand::Rng;
use regex::Regex;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;

use crate::constants::{
    DEFAULT_DELAY_MAX_SECONDS, DEFAULT_DELAY_MIN_SECONDS, LAST_SEEN_THROTTLE_SECONDS,
    MAX_DELAY_SECONDS, MIN_DELAY_SECONDS, TELETHON_MAX_RECONNECT_ATTEMPTS,
    TELETHON_RECONNECT_BACKOFF_MULTIPLIER, TELETHON_RECONNECT_DELAY_BASE_MS,
    TELETHON_RECONNECT_DELAY_MAX_MS, WORKER_IDLE_BACKOFF_BASE_MS, WORKER_IDLE_BACKOFF_MAX_MS,
    WORKER_IDLE_CYCLES_THRESHOLD,
};
use crate::db::{Account, Settings};
use crate::events::{
    emit_account_status, emit_action_detected, emit_join_attempt, emit_log, emit_phase_detected,
};
use crate::telethon::{TelethonButton, TelethonClient, TelethonEvent, TelethonMessage};
use crate::workers::cache::{shared_cache, ActionConfig, WorkerCache};
use crate::workers::detection::{DetectionPipeline, DetectionResult, InlineButton, MessageEvent};

/// Worker state
#[derive(Debug, Clone, PartialEq)]
pub enum WorkerState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Error(String),
}

/// Commands that can be sent to a worker
#[derive(Debug)]
pub enum WorkerCommand {
    Stop,
    Reload,
}

/// Group slot configuration with its moderator
#[derive(Debug, Clone)]
pub struct GroupSlotConfig {
    pub group_id: i64,
    pub group_title: String,
    pub moderator_kind: String, // "main" or "beta"
    pub moderator_bot_id: i64,
}

/// Account worker configuration
#[derive(Debug, Clone)]
pub struct WorkerConfig {
    pub account_id: i64,
    pub account_name: String,
    pub api_id: i64,
    pub api_hash: String,
    pub session_dir: PathBuf,
    pub group_slots: Vec<GroupSlotConfig>,
    pub group_chat_ids: Vec<i64>,
    pub moderator_bot_ids: Vec<i64>,
    pub main_bot_id: Option<i64>,
    pub beta_bot_id: Option<i64>,
    pub max_join_attempts: i32,
    pub join_cooldown_seconds: i32,
}

/// Account worker - manages a single Telegram account
pub struct AccountWorker {
    config: WorkerConfig,
    state: WorkerState,
    session: Option<TelethonClient>,
    detection_pipeline: DetectionPipeline,

    // Game state
    game_state: GameState,

    // Join state
    join_attempts: i32,
    last_join_attempt: Option<std::time::Instant>,

    // Throttle last_seen updates (once per 30s)
    last_seen_update: Option<std::time::Instant>,

    // Ban warning patterns (loaded from settings)
    ban_warning_patterns: Vec<BanWarningPattern>,

    // Two-step action cache (for Cupid etc.)
    two_step_cache: Vec<TwoStepCache>,

    // Reconnection state
    reconnect_attempts: u32,
    last_reconnect_attempt: Option<std::time::Instant>,

    // Cache for action/target metadata
    cache: std::sync::Arc<WorkerCache>,
}

/// Current game state for an account
#[derive(Debug, Default)]
pub struct GameState {
    pub joined: bool,
    pub game_started: bool,
    pub game_ended: bool,
    pub ban_warned: bool, // Set true if ban warning detected
}

/// Ban warning pattern (compiled)
#[derive(Debug)]
pub struct BanWarningPattern {
    pub pattern: String,
    pub is_regex: bool,
    pub compiled_regex: Option<Regex>,
}

/// Cache for two-step actions (e.g., Cupid)
#[derive(Debug, Clone)]
pub struct TwoStepCache {
    pub action_id: i64,
    pub first_chat_id: i64,
    pub first_message_id: i64,
    pub first_buttons: Vec<TelethonButton>,
    pub selected_a: Option<String>,
}

impl AccountWorker {
    /// Create a new account worker
    pub fn new(config: WorkerConfig) -> Self {
        AccountWorker {
            state: WorkerState::Stopped,
            session: None,
            detection_pipeline: DetectionPipeline::new(),
            game_state: GameState::default(),
            join_attempts: 0,
            last_join_attempt: None,
            last_seen_update: None,
            ban_warning_patterns: Vec::new(),
            two_step_cache: Vec::new(),
            reconnect_attempts: 0,
            last_reconnect_attempt: None,
            cache: shared_cache(),
            config,
        }
    }

    /// Create worker config from account and settings
    pub fn config_from_account(
        account: &Account,
        settings: &Settings,
        session_dir: PathBuf,
    ) -> WorkerConfig {
        let api_id = account
            .api_id_override
            .unwrap_or(settings.api_id.unwrap_or(0));
        let api_hash = account
            .api_hash_override
            .clone()
            .or_else(|| settings.api_hash.clone())
            .unwrap_or_default();

        // Validate API ID
        if api_id == 0 {
            log::error!(
                "[{}] Invalid API ID (0). Please configure API ID in Settings or per-account.",
                account.account_name
            );
            log::error!("The worker will fail to authenticate. Please set a valid API ID from https://my.telegram.org");
        }

        // Validate API Hash
        if api_hash.is_empty() {
            log::error!("[{}] Invalid API Hash (empty). Please configure API Hash in Settings or per-account.", account.account_name);
            log::error!("The worker will fail to authenticate. Please set a valid API Hash from https://my.telegram.org");
        }

        let max_attempts = account
            .join_max_attempts_override
            .unwrap_or(settings.join_max_attempts_default);
        let cooldown = account
            .join_cooldown_seconds_override
            .unwrap_or(settings.join_cooldown_seconds_default);

        // Get moderator bot IDs from settings
        let main_bot_id = settings.main_bot_user_id;
        let beta_bot_id = settings.beta_bot_user_id;

        let mut moderator_bot_ids = Vec::new();
        if let Some(id) = main_bot_id {
            moderator_bot_ids.push(id);
        }
        if let Some(id) = beta_bot_id {
            moderator_bot_ids.push(id);
        }

        WorkerConfig {
            account_id: account.id,
            account_name: account.account_name.clone(),
            api_id,
            api_hash,
            session_dir,
            group_slots: Vec::new(), // Will be populated from group slots by manager
            group_chat_ids: Vec::new(), // Will be populated from group slots
            moderator_bot_ids,
            main_bot_id,
            beta_bot_id,
            max_join_attempts: max_attempts,
            join_cooldown_seconds: cooldown,
        }
    }

    /// Get the moderator bot ID for a specific group
    pub fn get_moderator_for_group(&self, group_id: i64) -> Option<i64> {
        // Find the slot config for this group
        if let Some(slot) = self
            .config
            .group_slots
            .iter()
            .find(|s| s.group_id == group_id)
        {
            if slot.moderator_bot_id > 0 {
                return Some(slot.moderator_bot_id);
            }
        }
        // Fallback to first available bot
        self.config.moderator_bot_ids.first().copied()
    }

    /// Get the account ID
    pub fn account_id(&self) -> i64 {
        self.config.account_id
    }

    /// Get the current state
    pub fn state(&self) -> &WorkerState {
        &self.state
    }

    /// Start the worker
    pub async fn start(&mut self) -> Result<(), String> {
        if self.state != WorkerState::Stopped {
            return Err("Worker is not stopped".to_string());
        }

        self.state = WorkerState::Starting;
        log::info!("[{}] Starting worker...", self.config.account_name);

        let session_path = self
            .config
            .session_dir
            .join("telethon.session")
            .to_string_lossy()
            .to_string();
        let session =
            TelethonClient::spawn(self.config.api_id, &self.config.api_hash, &session_path)?;
        let response = session.request("start_updates", serde_json::json!({}))?;
        if !response.ok {
            return Err(response
                .error
                .unwrap_or_else(|| "Telethon worker error".to_string()));
        }

        self.session = Some(session);
        self.state = WorkerState::Running;

        // Load detection patterns
        self.load_detection_patterns()?;

        log::info!("[{}] Worker started successfully", self.config.account_name);
        Ok(())
    }

    /// Stop the worker
    pub async fn stop(&mut self) -> Result<(), String> {
        if self.state != WorkerState::Running && self.state != WorkerState::Starting {
            return Err("Worker is not running".to_string());
        }

        self.state = WorkerState::Stopping;
        log::info!("[{}] Stopping worker...", self.config.account_name);

        if let Some(session) = self.session.take() {
            let _ = session.shutdown();
        }

        self.state = WorkerState::Stopped;

        // Reset all state to clean slate
        self.game_state = GameState::default();
        self.join_attempts = 0;
        self.last_join_attempt = None;
        self.reconnect_attempts = 0;
        self.last_reconnect_attempt = None;
        self.two_step_cache.clear();

        log::info!("[{}] Worker stopped", self.config.account_name);
        Ok(())
    }

    /// Load detection patterns from database
    fn load_detection_patterns(&mut self) -> Result<(), String> {
        log::debug!(
            "[{}] Loading detection patterns...",
            self.config.account_name
        );

        // Load all data in a single lock scope to minimize lock time
        let (phase_patterns, actions, action_patterns, settings) = {
            let conn = crate::db::get_conn().map_err(|e| e.to_string())?;

            let phase_patterns = self.cache.get_phase_patterns(|| {
                crate::db::list_all_phase_patterns_with_info(&conn)
                    .map_err(|e| format!("Failed to load phase patterns: {}", e))
            })?;

            let actions = self.cache.get_actions(|| {
                crate::db::list_actions(&conn).map_err(|e| format!("Failed to load actions: {}", e))
            })?;

            let action_patterns = self.cache.get_action_patterns(|| {
                crate::db::list_all_action_patterns(&conn)
                    .map_err(|e| format!("Failed to load action patterns: {}", e))
            })?;

            let settings = crate::db::get_settings(&conn)
                .map_err(|e| format!("Failed to load settings: {}", e))?;

            // Return all data - lock is released here
            (phase_patterns, actions, action_patterns, settings)
        }; // Lock released here

        // Process the data after releasing the lock

        // Convert phase patterns to the format expected by DetectionPipeline
        let phase_data: Vec<(crate::db::PhasePattern, String, i32)> = phase_patterns
            .into_iter()
            .map(|p| (p.pattern, p.phase_name, p.phase_priority))
            .collect();

        self.detection_pipeline.load_phase_patterns(phase_data);
        log::info!(
            "[{}] Loaded {} phase patterns",
            self.config.account_name,
            self.detection_pipeline.phase_pattern_count()
        );

        // Load action patterns
        self.detection_pipeline
            .load_action_patterns(actions.clone(), action_patterns);
        log::info!(
            "[{}] Loaded {} action patterns",
            self.config.account_name,
            self.detection_pipeline.action_pattern_count()
        );
        crate::workers::detection::clear_regex_cache();

        // Preload per-account action configs to avoid hot-path DB calls
        let account_id = self.config.account_id;
        if let Ok(conn) = crate::db::get_conn() {
            for action in &actions {
                if let Ok(config) = self.build_action_config(&conn, account_id, action) {
                    let _ = self.cache.set_action_config(account_id, action.id, config);
                }
            }
        }

        // Parse ban warning patterns
        self.ban_warning_patterns =
            self.parse_ban_warning_patterns(&settings.ban_warning_patterns_json);
        log::info!(
            "[{}] Loaded {} ban warning patterns",
            self.config.account_name,
            self.ban_warning_patterns.len()
        );

        Ok(())
    }

    /// Parse ban warning patterns JSON into compiled patterns
    fn parse_ban_warning_patterns(&self, json: &str) -> Vec<BanWarningPattern> {
        let mut patterns = Vec::new();

        if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(json) {
            for item in arr {
                let pattern = item
                    .get("pattern")
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();
                let is_regex = item
                    .get("is_regex")
                    .and_then(|r| r.as_bool())
                    .unwrap_or(false);
                let enabled = item
                    .get("enabled")
                    .and_then(|e| e.as_bool())
                    .unwrap_or(true);

                if !enabled || pattern.is_empty() {
                    continue;
                }

                let compiled_regex = if is_regex {
                    Regex::new(&pattern).ok()
                } else {
                    None
                };

                patterns.push(BanWarningPattern {
                    pattern,
                    is_regex,
                    compiled_regex,
                });
            }
        }

        patterns
    }

    /// Check if a message matches any ban warning pattern
    fn check_ban_warning(&self, text: &str) -> bool {
        for pattern in &self.ban_warning_patterns {
            let matches = if pattern.is_regex {
                pattern
                    .compiled_regex
                    .as_ref()
                    .map(|r| r.is_match(text))
                    .unwrap_or(false)
            } else {
                text.contains(&pattern.pattern)
            };

            if matches {
                log::warn!(
                    "[{}] Ban warning detected: {}",
                    self.config.account_name,
                    &pattern.pattern
                );
                return true;
            }
        }
        false
    }

    fn stop_join_attempts(&mut self, reason: &str) {
        if self.join_attempts > 0 || self.last_join_attempt.is_some() {
            log::warn!(
                "[{}] Stopping join attempts: {}",
                self.config.account_name,
                reason
            );
        }
        self.join_attempts = 0;
        self.last_join_attempt = None;
    }

    /// Run the main message loop (call this in a tokio task)
    pub async fn run_loop(
        &mut self,
        mut command_rx: tokio::sync::mpsc::Receiver<crate::workers::manager::WorkerCommand>,
    ) -> Result<(), String> {
        use crate::workers::manager::WorkerCommand;

        log::info!("[{}] Starting message loop", self.config.account_name);
        let mut idle_cycles = 0u32;

        while self.state == WorkerState::Running {
            tokio::select! {
                cmd = command_rx.recv() => {
                    match cmd {
                        Some(WorkerCommand::Shutdown) | None => {
                            log::info!("[{}] Shutdown signal received", self.config.account_name);
                            self.state = WorkerState::Stopping;
                        }
                        Some(WorkerCommand::ReloadPatterns) => {
                            log::info!("[{}] Reloading detection patterns", self.config.account_name);
                            self.cache.invalidate_patterns();
                            self.cache.invalidate_action_configs();
                            if let Err(e) = self.load_detection_patterns() {
                                log::error!("[{}] Failed to reload patterns: {}", self.config.account_name, e);
                            } else {
                                log::info!("[{}] Detection patterns reloaded successfully", self.config.account_name);
                            }
                        }
                    }
                }
                result = async {
                    if let Some(session) = &self.session {
                        let events = session.poll_events();
                        Ok::<Vec<TelethonEvent>, String>(events)
                    } else {
                        Ok(Vec::new())
                    }
                } => {
                    match result {
                        Ok(events) => {
                            if events.is_empty() {
                                idle_cycles = idle_cycles.saturating_add(1);
                            } else {
                                idle_cycles = 0;
                                for event in events {
                                    self.handle_telethon_event(event).await?;
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("[{}] Telethon receive error: {}", self.config.account_name, e);
                        }
                    }
                }
            }

            if self.state != WorkerState::Running {
                break;
            }

            // Small sleep with mild backoff to prevent busy-waiting
            let backoff = if idle_cycles > WORKER_IDLE_CYCLES_THRESHOLD {
                WORKER_IDLE_BACKOFF_MAX_MS
            } else {
                WORKER_IDLE_BACKOFF_BASE_MS
            };
            tokio::time::sleep(Duration::from_millis(backoff)).await;
        }

        log::info!("[{}] Message loop ended", self.config.account_name);
        Ok(())
    }

    /// Handle a Telethon event
    async fn handle_telethon_event(&mut self, event: TelethonEvent) -> Result<(), String> {
        match event.kind.as_str() {
            "message" => {
                if let Some(message) = event.message {
                    self.reconnect_attempts = 0;
                    self.handle_telethon_message(message).await?;
                }
            }
            "message_edited" => {
                if let Some(message) = event.message {
                    log::debug!(
                        "[{}] Message edited: {}",
                        self.config.account_name,
                        message.id
                    );
                    self.handle_telethon_message(message).await?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    /// Check if a Telethon error is recoverable
    fn is_recoverable_error(error: &str) -> bool {
        let error_lower = error.to_lowercase();

        // Network-related errors are recoverable (temporary issues)
        if error_lower.contains("network")
            || error_lower.contains("timeout")
            || error_lower.contains("connection")
            || error_lower.contains("disconnected")
            || error_lower.contains("retry")
            || error_lower.contains("temporarily")
            || error_lower.contains("temporary")
            || error_lower.contains("flood")
            || error_lower.contains("unreachable")
            || error_lower.contains("unavailable")
        {
            return true;
        }

        // Auth/account errors are NOT recoverable (need user intervention)
        if error_lower.contains("auth")
            || error_lower.contains("password")
            || error_lower.contains("phone")
            || error_lower.contains("code")
            || error_lower.contains("banned")
            || error_lower.contains("deleted")
            || error_lower.contains("deactivated")
            || error_lower.contains("terminated")
            || error_lower.contains("revoked")
            || error_lower.contains("invalid session")
            || error_lower.contains("unauthorized")
        {
            return false;
        }

        // Default to NON-recoverable for unknown errors (safer)
        // This prevents infinite reconnection loops for unexpected errors
        // Users can restart the worker manually if needed
        log::warn!(
            "Unknown error type (treating as non-recoverable): {}",
            error
        );
        false
    }

    /// Handle an incoming message
    async fn handle_telethon_message(&mut self, message: TelethonMessage) -> Result<(), String> {
        // Skip outgoing messages
        if message.is_outgoing {
            return Ok(());
        }

        // Check if message is from a relevant chat
        let is_group_message = self.config.group_chat_ids.contains(&message.chat_id);
        let is_bot_pm = self.config.moderator_bot_ids.contains(&message.sender_id);

        if !is_group_message && !is_bot_pm {
            return Ok(()); // Ignore messages from other chats
        }

        // Update last_seen timestamp (throttled)
        let should_update = self
            .last_seen_update
            .map(|t| t.elapsed() > Duration::from_secs(LAST_SEEN_THROTTLE_SECONDS))
            .unwrap_or(true);
        if should_update {
            if let Ok(conn) = crate::db::get_conn() {
                let _ = crate::db::update_last_seen(&conn, self.config.account_id);
            }
            self.last_seen_update = Some(std::time::Instant::now());
        }

        let preview: String = message.text.chars().take(50).collect();
        log::debug!(
            "[{}] Message from {}: {}",
            self.config.account_name,
            if is_group_message { "group" } else { "bot PM" },
            preview
        );

        // Check for ban warning in bot PMs
        if is_bot_pm && !self.game_state.ban_warned {
            if self.check_ban_warning(&message.text) {
                self.game_state.ban_warned = true;
                self.stop_join_attempts("ban warning received");
                emit_log(
                    self.config.account_id,
                    &self.config.account_name,
                    "warn",
                    "Ban warning received from moderator bot. Join attempts stopped.",
                );
                // Don't return - still process the message for other detections
            }
        }

        // Convert to detection event
        let event = self.telethon_message_to_event(&message);

        // Run detection pipeline
        let results = self.detection_pipeline.process(&event);

        for result in results {
            match result {
                DetectionResult::Phase { phase_name, .. } => {
                    self.handle_phase(&phase_name, &message).await?;
                }
                DetectionResult::Action {
                    action_id,
                    action_name,
                    step,
                    ..
                } => {
                    self.handle_action(action_id, &action_name, step, &message)
                        .await?;
                }
            }
        }

        Ok(())
    }

    /// Convert TelethonMessage to MessageEvent for detection
    fn telethon_message_to_event(&self, message: &TelethonMessage) -> MessageEvent {
        let buttons: Vec<InlineButton> = message
            .buttons
            .iter()
            .flat_map(|row| row.iter())
            .map(|btn| InlineButton {
                text: btn.text.clone(),
                callback_data: btn.data.clone(),
                url: btn.url.clone(),
            })
            .collect();

        let is_private = !self.config.group_chat_ids.contains(&message.chat_id);

        MessageEvent {
            chat_id: message.chat_id,
            sender_id: message.sender_id,
            text: message.text.clone(),
            buttons,
            is_private,
        }
    }

    /// Handle a detected phase
    async fn handle_phase(
        &mut self,
        phase_name: &str,
        message: &TelethonMessage,
    ) -> Result<(), String> {
        log::info!(
            "[{}] Phase detected: {}",
            self.config.account_name,
            phase_name
        );
        emit_phase_detected(
            self.config.account_id,
            &self.config.account_name,
            phase_name,
        );

        match phase_name {
            "join_time" => {
                if !self.game_state.joined && self.can_attempt_join() {
                    self.attempt_join(message).await?;
                }
            }
            "join_confirmation" => {
                self.game_state.joined = true;
                self.stop_join_attempts("join confirmation received");
                log::info!("[{}] ✓ Join confirmed!", self.config.account_name);
            }
            "game_start" => {
                self.game_state.game_started = true;
                self.stop_join_attempts("game started");
                log::info!("[{}] ▶ Game started!", self.config.account_name);
            }
            "game_end" => {
                self.game_state.game_ended = true;
                log::info!("[{}] ■ Game ended!", self.config.account_name);
                self.reset_game_state();
            }
            _ => {}
        }

        Ok(())
    }

    /// Check if we can attempt to join (cooldown and max attempts)
    fn can_attempt_join(&self) -> bool {
        if self.game_state.ban_warned || self.game_state.joined || self.game_state.game_started {
            return false;
        }

        if self.join_attempts >= self.config.max_join_attempts {
            return false;
        }

        if let Some(last) = self.last_join_attempt {
            let cooldown = Duration::from_secs(self.config.join_cooldown_seconds as u64);
            if last.elapsed() < cooldown {
                return false;
            }
        }

        true
    }

    /// Handle a detected action
    async fn handle_action(
        &mut self,
        action_id: i64,
        action_name: &str,
        step: i32,
        message: &TelethonMessage,
    ) -> Result<(), String> {
        log::info!(
            "[{}] Action detected: {} (id={}, step={})",
            self.config.account_name,
            action_name,
            action_id,
            step
        );

        // Check if this is a two-step action
        let is_two_step = self.is_two_step_action(action_id);

        if is_two_step {
            self.handle_two_step_action(action_id, action_name, step, message)
                .await?;
        } else {
            // Get target rules for this account + action
            let target_button = self.select_target_button(action_id, message)?;

            if let Some((button, delay)) = target_button {
                // Apply delay
                if delay > 0 {
                    log::debug!(
                        "[{}] Waiting {}ms before clicking",
                        self.config.account_name,
                        delay
                    );
                    tokio::time::sleep(Duration::from_millis(delay as u64)).await;
                }

                // Click the button
                self.click_button(message.chat_id, message.id, &button)
                    .await?;

                // Emit action event
                emit_action_detected(
                    self.config.account_id,
                    &self.config.account_name,
                    action_name,
                    Some(button.text.clone()),
                );
            }
        }

        Ok(())
    }

    /// Check if an action is a two-step action
    fn is_two_step_action(&self, action_id: i64) -> bool {
        self.get_action_config(action_id)
            .map(|config| config.is_two_step)
            .unwrap_or(false)
    }

    /// Handle a two-step action (like Cupid choosing lovers)
    /// Algorithm: Cache first prompt buttons, then resolve pair when step 2 arrives.
    async fn handle_two_step_action(
        &mut self,
        action_id: i64,
        action_name: &str,
        step: i32,
        message: &TelethonMessage,
    ) -> Result<(), String> {
        let buttons: Vec<TelethonButton> = message
            .buttons
            .iter()
            .flat_map(|row| row.iter())
            .cloned()
            .collect();
        let button_texts: Vec<String> = buttons.iter().map(|b| b.text.clone()).collect();

        if step == 1 {
            // First step - cache buttons only
            self.two_step_cache
                .retain(|entry| entry.action_id != action_id);
            self.two_step_cache.push(TwoStepCache {
                action_id,
                first_chat_id: message.chat_id,
                first_message_id: message.id,
                first_buttons: buttons.clone(),
                selected_a: None,
            });
            return Ok(());
        }

        if step == 2 {
            let cache = self
                .two_step_cache
                .iter()
                .find(|entry| entry.action_id == action_id)
                .cloned();
            if cache.is_none() {
                log::warn!(
                    "[{}] Two-step action step 2 received but no cache exists for action '{}' (id={})",
                    self.config.account_name, action_name, action_id
                );
                return Ok(());
            }
            let first_buttons = cache
                .as_ref()
                .map(|c| c.first_buttons.clone())
                .unwrap_or_default();
            let pairs = self.get_target_pairs(action_id);
            let blacklist = self.get_blacklist(action_id);
            let button_has = |list: &[TelethonButton], target: &str| {
                list.iter().any(|b| b.text.contains(target))
            };

            // Find first configured pair where both A and B are available across prompts
            let mut selected_pair: Option<(String, String)> = None;
            for (target_a, target_b) in &pairs {
                if button_has(&first_buttons, target_a) && button_has(&buttons, target_b) {
                    selected_pair = Some((target_a.clone(), target_b.clone()));
                    break;
                }
            }

            // Random fallback: choose any available distinct A/B
            if selected_pair.is_none() && self.is_random_fallback_enabled(action_id) {
                let available_a: Vec<String> = first_buttons
                    .iter()
                    .filter(|b| !blacklist.contains(&b.text))
                    .map(|b| b.text.clone())
                    .collect();
                let available_b: Vec<String> = button_texts
                    .iter()
                    .filter(|b| !blacklist.contains(*b))
                    .cloned()
                    .collect();
                if !available_a.is_empty() && !available_b.is_empty() {
                    let a_idx = rand::thread_rng().gen_range(0..available_a.len());
                    let mut b_idx = rand::thread_rng().gen_range(0..available_b.len());
                    if available_a[a_idx] == available_b[b_idx] && available_b.len() > 1 {
                        b_idx = (b_idx + 1) % available_b.len();
                    }
                    selected_pair = Some((available_a[a_idx].clone(), available_b[b_idx].clone()));
                }
            }

            if let Some((target_a, target_b)) = selected_pair {
                if let Some(cache) = &cache {
                    if let Some(btn_a) = cache
                        .first_buttons
                        .iter()
                        .find(|b| b.text.contains(&target_a))
                        .cloned()
                    {
                        let delay = self.calculate_action_delay(action_id);
                        if delay > 0 {
                            tokio::time::sleep(Duration::from_millis(delay as u64)).await;
                        }
                        self.click_button(cache.first_chat_id, cache.first_message_id, &btn_a)
                            .await?;
                        emit_action_detected(
                            self.config.account_id,
                            &self.config.account_name,
                            &format!("{} (Step 1)", action_name),
                            Some(target_a.clone()),
                        );
                    }
                }

                if let Some(btn_b) = self.find_button_by_text(message, &target_b) {
                    let delay = self.calculate_action_delay(action_id);
                    if delay > 0 {
                        tokio::time::sleep(Duration::from_millis(delay as u64)).await;
                    }
                    self.click_button(message.chat_id, message.id, &btn_b)
                        .await?;
                    emit_action_detected(
                        self.config.account_id,
                        &self.config.account_name,
                        &format!("{} (Step 2)", action_name),
                        Some(target_b.clone()),
                    );
                }
            }

            self.two_step_cache
                .retain(|entry| entry.action_id != action_id);
        }

        Ok(())
    }

    /// Find a button by text (partial match)
    fn find_button_by_text(&self, message: &TelethonMessage, text: &str) -> Option<TelethonButton> {
        message
            .buttons
            .iter()
            .flat_map(|row| row.iter())
            .find(|b| b.text.contains(text))
            .cloned()
    }

    /// Get target pairs for a two-step action
    fn get_target_pairs(&self, action_id: i64) -> Vec<(String, String)> {
        self.get_action_config(action_id)
            .map(|config| config.target_pairs)
            .unwrap_or_default()
    }

    /// Select which button to click based on target rules
    fn select_target_button(
        &self,
        action_id: i64,
        message: &TelethonMessage,
    ) -> Result<Option<(TelethonButton, i32)>, String> {
        let buttons: Vec<&TelethonButton> =
            message.buttons.iter().flat_map(|row| row.iter()).collect();

        if buttons.is_empty() {
            return Ok(None);
        }

        // Get delay settings
        let (min_delay, max_delay) = self.get_delay_settings(action_id);
        let delay = if min_delay < max_delay {
            let delay_secs = rand::thread_rng().gen_range(min_delay..=max_delay);
            delay_secs.saturating_mul(1000)
        } else {
            min_delay.saturating_mul(1000)
        };

        // Get the action's button_type to determine selection strategy
        let button_type = self.get_action_button_type(action_id);

        // Try to get target override for this account + action
        let targets = self.get_target_list(action_id);
        let blacklist = self.get_blacklist(action_id);

        match button_type.as_str() {
            "player_list" => {
                // Player list: search for player names across all buttons
                for target in &targets {
                    if let Some(btn) = buttons.iter().find(|b| b.text.contains(target)) {
                        // Explicit targets override blacklist
                        return Ok(Some(((*btn).clone(), delay)));
                    }
                }

                // Random fallback for player lists
                if self.is_random_fallback_enabled(action_id) {
                    let available: Vec<_> = buttons
                        .iter()
                        .filter(|b| !blacklist.contains(&b.text))
                        .collect();

                    if !available.is_empty() {
                        let idx = rand::thread_rng().gen_range(0..available.len());
                        return Ok(Some(((*available[idx]).clone(), delay)));
                    }
                }
            }
            "yes_no" => {
                // Yes/No buttons: look for exact match or common patterns
                let target_value = targets.first().map(|s| s.as_str()).unwrap_or("yes");

                // Try to find button matching the target (yes/no/بله/خیر etc.)
                if let Some(btn) = buttons.iter().find(|b| {
                    let text_lower = b.text.to_lowercase();
                    match target_value.to_lowercase().as_str() {
                        "yes" | "بله" | "آره" => {
                            text_lower.contains("yes")
                                || text_lower.contains("بله")
                                || text_lower.contains("آره")
                                || text_lower.contains("✓")
                                || text_lower.contains("✅")
                        }
                        "no" | "خیر" | "نه" => {
                            text_lower.contains("no")
                                || text_lower.contains("خیر")
                                || text_lower.contains("نه")
                                || text_lower.contains("✗")
                                || text_lower.contains("❌")
                        }
                        _ => b.text.contains(target_value),
                    }
                }) {
                    return Ok(Some(((*btn).clone(), delay)));
                }

                // Fallback to first button if no match
                if self.is_random_fallback_enabled(action_id) {
                    if let Some(btn) = buttons.first() {
                        return Ok(Some(((*btn).clone(), delay)));
                    }
                }
            }
            "fixed" => {
                // Fixed buttons: exact text match required
                for target in &targets {
                    if let Some(btn) = buttons.iter().find(|b| b.text == *target) {
                        return Ok(Some(((*btn).clone(), delay)));
                    }
                }

                // Try partial match as fallback
                for target in &targets {
                    if let Some(btn) = buttons.iter().find(|b| b.text.contains(target)) {
                        return Ok(Some(((*btn).clone(), delay)));
                    }
                }
            }
            _ => {
                // Default behavior: partial text match (same as player_list)
                for target in &targets {
                    if let Some(btn) = buttons.iter().find(|b| b.text.contains(target)) {
                        // Explicit targets override blacklist
                        return Ok(Some(((*btn).clone(), delay)));
                    }
                }

                if self.is_random_fallback_enabled(action_id) {
                    let available: Vec<_> = buttons
                        .iter()
                        .filter(|b| !blacklist.contains(&b.text))
                        .collect();

                    if !available.is_empty() {
                        let idx = rand::thread_rng().gen_range(0..available.len());
                        return Ok(Some(((*available[idx]).clone(), delay)));
                    }
                }
            }
        }

        Ok(None)
    }

    /// Get the button_type for an action
    fn get_action_button_type(&self, action_id: i64) -> String {
        self.get_action_config(action_id)
            .map(|config| config.button_type)
            .unwrap_or_else(|_| "player_list".to_string())
    }

    /// Get delay settings for an action
    fn get_delay_settings(&self, action_id: i64) -> (i32, i32) {
        self.get_action_config(action_id)
            .map(|config| (config.delay_min, config.delay_max))
            .unwrap_or((DEFAULT_DELAY_MIN_SECONDS, DEFAULT_DELAY_MAX_SECONDS))
    }

    /// Calculate a random delay in milliseconds for an action
    fn calculate_action_delay(&self, action_id: i64) -> i32 {
        let (min_delay, max_delay) = self.get_delay_settings(action_id);
        if min_delay < max_delay {
            let delay_secs = rand::thread_rng().gen_range(min_delay..=max_delay);
            delay_secs.saturating_mul(1000)
        } else {
            min_delay.saturating_mul(1000)
        }
    }

    /// Get target list for an action
    fn get_target_list(&self, action_id: i64) -> Vec<String> {
        self.get_action_config(action_id)
            .map(|config| config.targets)
            .unwrap_or_default()
    }

    /// Get blacklist for an action
    fn get_blacklist(&self, action_id: i64) -> Vec<String> {
        self.get_action_config(action_id)
            .map(|config| config.blacklist)
            .unwrap_or_default()
    }

    fn get_action_config(&self, action_id: i64) -> Result<ActionConfig, String> {
        let account_id = self.config.account_id;
        self.cache.get_action_config(account_id, action_id, || {
            let conn = crate::db::get_conn().map_err(|e| e.to_string())?;
            let action = crate::db::get_action(&conn, action_id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "Action not found".to_string())?;
            self.build_action_config(&conn, account_id, &action)
        })
    }

    fn build_action_config(
        &self,
        conn: &crate::db::PooledConn,
        account_id: i64,
        action: &crate::db::Action,
    ) -> Result<ActionConfig, String> {
        let (delay_min, delay_max) = crate::db::get_effective_delay(conn, account_id, action.id)
            .unwrap_or((DEFAULT_DELAY_MIN_SECONDS, DEFAULT_DELAY_MAX_SECONDS));

        let target_pairs =
            crate::db::get_target_pairs(conn, account_id, action.id).unwrap_or_default();
        let blacklist = crate::db::get_blacklist(conn, account_id, action.id).unwrap_or_default();

        let mut targets = Vec::new();
        let mut random_fallback_enabled = action.random_fallback_enabled;

        if let Ok(Some(rule_json)) =
            crate::db::get_effective_target_rule(conn, account_id, action.id)
        {
            if let Ok(rule) = serde_json::from_str::<serde_json::Value>(&rule_json) {
                if let Some(target_list) = rule.get("targets").and_then(|t| t.as_array()) {
                    targets = target_list
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                }
                if let Some(fallback) = rule.get("random_fallback").and_then(|v| v.as_bool()) {
                    random_fallback_enabled = fallback;
                }
            }
        }

        Ok(ActionConfig {
            target_pairs,
            blacklist,
            targets,
            delay_min: delay_min.clamp(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS),
            delay_max: delay_max.clamp(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS),
            button_type: action.button_type.clone(),
            random_fallback_enabled,
            is_two_step: action.is_two_step,
        })
    }

    /// Check if random fallback is enabled for an action
    fn is_random_fallback_enabled(&self, action_id: i64) -> bool {
        self.get_action_config(action_id)
            .map(|config| config.random_fallback_enabled)
            .unwrap_or(true)
    }

    /// Click a button
    async fn click_button(
        &mut self,
        chat_id: i64,
        message_id: i64,
        button: &TelethonButton,
    ) -> Result<(), String> {
        log::info!(
            "[{}] Clicking button: {}",
            self.config.account_name,
            button.text
        );

        if let Some(session) = &self.session {
            match button.kind.as_str() {
                "callback" => {
                    if let Some(data) = &button.data {
                        let response = session.request(
                            "click_button",
                            serde_json::json!({
                                "chat_id": chat_id,
                                "message_id": message_id,
                                "data": data,
                            }),
                        )?;
                        self.handle_telethon_response("click_button", &response)
                            .await?;
                    }
                }
                "url" => {
                    if let Some(url) = &button.url {
                        if let Some(param) = parse_start_parameter(url) {
                            if let Some(bot_id) = self.config.moderator_bot_ids.first() {
                                let response = session.request(
                                    "send_message",
                                    serde_json::json!({
                                        "chat_id": *bot_id,
                                        "text": format!("/start {}", param),
                                    }),
                                )?;
                                self.handle_telethon_response("send_message", &response)
                                    .await?;
                            }
                        }
                    }
                }
                _ => {
                    log::warn!("[{}] Unknown button type", self.config.account_name);
                }
            }
        }

        Ok(())
    }

    async fn handle_telethon_response(
        &mut self,
        action: &str,
        response: &crate::telethon::TelethonResponse,
    ) -> Result<(), String> {
        if response.ok {
            return Ok(());
        }
        let mut code = "UNKNOWN".to_string();
        let mut seconds: Option<u64> = None;
        let mut message = response.error.clone();

        if let Some(payload) = &response.payload {
            if let Some(c) = payload.get("code").and_then(|v| v.as_str()) {
                code = c.to_string();
            }
            seconds = payload.get("seconds").and_then(|v| v.as_u64());
            if let Some(m) = payload.get("message").and_then(|v| v.as_str()) {
                message = Some(m.to_string());
            }
        }

        match code.as_str() {
            "FLOOD_WAIT" | "SLOWMODE_WAIT" => {
                let wait_for = seconds.unwrap_or(1);
                emit_log(
                    self.config.account_id,
                    &self.config.account_name,
                    "warn",
                    &format!("{} requires wait of {}s", code, wait_for),
                );
                sleep(Duration::from_secs(wait_for)).await;
                Ok(())
            }
            "AUTH_REVOKED" => {
                let msg = message.unwrap_or_else(|| "Session revoked or duplicated".to_string());
                self.state = WorkerState::Error(msg.clone());
                emit_account_status(self.config.account_id, "error", Some(msg.clone()));
                if let Ok(conn) = crate::db::get_conn() {
                    let _ =
                        crate::db::update_account_status(&conn, self.config.account_id, "error");
                }
                Err(msg)
            }
            _ => {
                let err = message.unwrap_or_else(|| "Telethon request failed".to_string());
                log::warn!(
                    "[{}] Telethon {} failed: {}",
                    self.config.account_name,
                    action,
                    err
                );
                Err(err)
            }
        }
    }

    /// Attempt to join a game
    async fn attempt_join(&mut self, message: &TelethonMessage) -> Result<(), String> {
        self.join_attempts += 1;
        self.last_join_attempt = Some(std::time::Instant::now());

        log::info!(
            "[{}] Attempting to join (attempt {}/{})",
            self.config.account_name,
            self.join_attempts,
            self.config.max_join_attempts
        );

        emit_join_attempt(
            self.config.account_id,
            &self.config.account_name,
            self.join_attempts,
            self.config.max_join_attempts,
            false, // Will be updated when confirmation received
        );

        // Get the correct moderator bot for this group
        let bot_id = self
            .get_moderator_for_group(message.chat_id)
            .or_else(|| self.config.moderator_bot_ids.first().copied());

        // Find the join button (URL button)
        for row in &message.buttons {
            for button in row {
                if button.kind == "url" {
                    if let Some(url) = &button.url {
                        if let Some(param) = parse_start_parameter(url) {
                            if let Some(bot) = bot_id {
                                if let Some(session) = &self.session {
                                    log::info!(
                                        "[{}] Sending /start {} to bot {}",
                                        self.config.account_name,
                                        param,
                                        bot
                                    );
                                    let response = session.request(
                                        "send_message",
                                        serde_json::json!({
                                            "chat_id": bot,
                                            "text": format!("/start {}", param),
                                        }),
                                    )?;
                                    self.handle_telethon_response("send_message", &response)
                                        .await?;
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
        }

        log::warn!("[{}] No join button found", self.config.account_name);
        Ok(())
    }

    /// Reset game state for next game
    fn reset_game_state(&mut self) {
        self.game_state = GameState::default();
        self.join_attempts = 0;
        self.last_join_attempt = None;
    }

    /// Calculate reconnection delay with exponential backoff
    fn calculate_reconnect_delay(&self) -> u64 {
        let base = TELETHON_RECONNECT_DELAY_BASE_MS as f64;
        let multiplier = TELETHON_RECONNECT_BACKOFF_MULTIPLIER.powi(self.reconnect_attempts as i32);
        let delay = (base * multiplier) as u64;
        delay.min(TELETHON_RECONNECT_DELAY_MAX_MS)
    }

    /// Attempt to reconnect to Telethon
    async fn attempt_reconnect(&mut self) -> Result<bool, String> {
        if self.reconnect_attempts >= TELETHON_MAX_RECONNECT_ATTEMPTS {
            log::error!(
                "[{}] Max reconnection attempts ({}) exceeded",
                self.config.account_name,
                TELETHON_MAX_RECONNECT_ATTEMPTS
            );
            return Ok(false);
        }

        self.reconnect_attempts += 1;
        let delay = self.calculate_reconnect_delay();

        log::info!(
            "[{}] Reconnection attempt {}/{} (waiting {}ms)",
            self.config.account_name,
            self.reconnect_attempts,
            TELETHON_MAX_RECONNECT_ATTEMPTS,
            delay
        );

        tokio::time::sleep(Duration::from_millis(delay)).await;
        self.last_reconnect_attempt = Some(std::time::Instant::now());

        if let Some(old_session) = self.session.take() {
            let _ = old_session.shutdown();
            tokio::time::sleep(Duration::from_millis(250)).await;
        }

        let session_path = self
            .config
            .session_dir
            .join("telethon.session")
            .to_string_lossy()
            .to_string();
        match TelethonClient::spawn(self.config.api_id, &self.config.api_hash, &session_path) {
            Ok(session) => {
                let response = session.request("start_updates", serde_json::json!({}))?;
                if !response.ok {
                    log::warn!(
                        "[{}] Telethon reconnect failed: {}",
                        self.config.account_name,
                        response.error.unwrap_or_default()
                    );
                    return Ok(false);
                }

                log::info!("[{}] Reconnection successful!", self.config.account_name);
                self.session = Some(session);
                self.reconnect_attempts = 0;
                self.state = WorkerState::Running;
                emit_account_status(self.config.account_id, "running", None);

                if let Err(e) = self.load_detection_patterns() {
                    log::warn!(
                        "[{}] Failed to reload patterns after reconnect: {}",
                        self.config.account_name,
                        e
                    );
                }

                Ok(true)
            }
            Err(e) => {
                log::error!(
                    "[{}] Failed to create Telethon session: {}",
                    self.config.account_name,
                    e
                );
                Ok(false)
            }
        }
    }

    /// Handle connection loss with reconnection logic
    async fn handle_connection_lost(&mut self, reason: &str) -> Result<(), String> {
        log::warn!("[{}] Connection lost: {}", self.config.account_name, reason);

        emit_log(
            self.config.account_id,
            &self.config.account_name,
            "warn",
            &format!("Connection lost: {}. Attempting to reconnect...", reason),
        );

        // Attempt reconnection with proper backoff
        loop {
            if self.state != WorkerState::Running {
                return Err("Worker is stopping; aborting reconnection".to_string());
            }

            match self.attempt_reconnect().await {
                Ok(true) => {
                    emit_log(
                        self.config.account_id,
                        &self.config.account_name,
                        "info",
                        "Successfully reconnected to Telegram",
                    );
                    return Ok(());
                }
                Ok(false) => {
                    if self.reconnect_attempts >= TELETHON_MAX_RECONNECT_ATTEMPTS {
                        // Max attempts reached, stop the worker
                        self.state = WorkerState::Error(format!(
                            "Failed to reconnect after {} attempts",
                            TELETHON_MAX_RECONNECT_ATTEMPTS
                        ));
                        emit_account_status(
                            self.config.account_id,
                            "error",
                            Some(format!(
                                "Reconnection failed after {} attempts",
                                TELETHON_MAX_RECONNECT_ATTEMPTS
                            )),
                        );
                        emit_log(
                            self.config.account_id,
                            &self.config.account_name,
                            "error",
                            &format!(
                                "Failed to reconnect after {} attempts. Worker stopped.",
                                TELETHON_MAX_RECONNECT_ATTEMPTS
                            ),
                        );

                        if let Ok(conn) = crate::db::get_conn() {
                            let _ = crate::db::update_account_status(
                                &conn,
                                self.config.account_id,
                                "error",
                            );
                        }

                        return Err("Max reconnection attempts exceeded".to_string());
                    }
                    // Continue trying - attempt_reconnect will handle delay on next iteration
                }
                Err(e) => {
                    log::error!("[{}] Reconnection error: {}", self.config.account_name, e);
                    // Continue trying unless max attempts reached
                    if self.reconnect_attempts >= TELETHON_MAX_RECONNECT_ATTEMPTS {
                        self.state = WorkerState::Error(e.clone());
                        if let Ok(conn) = crate::db::get_conn() {
                            let _ = crate::db::update_account_status(
                                &conn,
                                self.config.account_id,
                                "error",
                            );
                        }
                        return Err(e);
                    }
                    // Continue trying - attempt_reconnect will handle delay on next iteration
                }
            }
        }
    }
}

/// Parse the start parameter from a Telegram bot URL
fn parse_start_parameter(url: &str) -> Option<String> {
    // URL format: https://t.me/botname?start=parameter
    let parsed = url::Url::parse(url).ok()?;
    for (key, value) in parsed.query_pairs() {
        if key == "start" {
            return Some(value.into_owned());
        }
    }
    None
}
