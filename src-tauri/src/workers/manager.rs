//! Worker Manager for Q Manager
//!
//! Global registry that tracks and manages running account workers.
//! Provides spawn/stop/query capabilities for account automation tasks.

use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use tokio::runtime::Runtime;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;

use crate::db;
use crate::events::emit_account_status;
use crate::workers::account_worker::WorkerState;
use crate::workers::AccountWorker;

/// Global worker manager instance
pub static WORKER_MANAGER: Lazy<WorkerManager> = Lazy::new(WorkerManager::new);

/// Monotonic counter used to stamp each spawned worker with a unique instance id.
/// Lets an exiting worker tell whether the handle currently in the map is still
/// its own (vs. a newer worker that replaced it) before touching it.
static WORKER_INSTANCE_SEQ: AtomicU64 = AtomicU64::new(1);

/// Commands that can be sent to a running worker
#[derive(Debug, Clone)]
pub enum WorkerCommand {
    Shutdown,
    ReloadPatterns,
}

/// Handle to control a running worker
#[allow(dead_code)]
pub struct WorkerHandle {
    pub account_id: i64,
    pub account_name: String,
    instance_id: u64,
    command_tx: mpsc::Sender<WorkerCommand>,
    task_handle: tokio::task::JoinHandle<()>,
}

/// RAII guard that releases a start reservation (see `WorkerManager::starting`)
/// on every exit path of `start_account`, including early error returns.
struct StartReservation {
    starting: Arc<StdMutex<HashSet<i64>>>,
    account_id: i64,
}

impl Drop for StartReservation {
    fn drop(&mut self) {
        self.starting
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(&self.account_id);
    }
}

#[allow(dead_code)]
impl WorkerHandle {
    /// Request the worker to stop
    pub async fn stop(&self) {
        let _ = self.command_tx.send(WorkerCommand::Shutdown).await;
    }

    /// Request the worker to reload detection patterns
    pub async fn reload_patterns(&self) {
        let _ = self.command_tx.send(WorkerCommand::ReloadPatterns).await;
    }

    /// Check if the worker task is still running
    pub fn is_running(&self) -> bool {
        !self.task_handle.is_finished()
    }
}

/// Worker Manager - manages all running account workers
pub struct WorkerManager {
    workers: Arc<RwLock<HashMap<i64, WorkerHandle>>>,
    worker_runtime: Arc<Runtime>,
    /// Account IDs whose start sequence is currently in flight (between the
    /// "is it running?" check and the handle insert). Guards against a TOCTOU
    /// double-spawn when two starts race (double-click, tray + UI, start-all
    /// racing a manual start).
    starting: Arc<StdMutex<HashSet<i64>>>,
}

impl WorkerManager {
    /// Create a new worker manager
    pub fn new() -> Self {
        // Blocking Telethon I/O is offloaded to the runtime's blocking pool via
        // TelethonClient::request_async/shutdown_async, so these worker threads
        // are reserved for async coordination. A small pool still provides
        // headroom for the short synchronous DB calls workers make inline.
        let worker_runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(4)
            .enable_all()
            .build()
            .unwrap_or_else(|e| {
                log::error!("Failed to create shared worker runtime: {}", e);
                panic!("Failed to create shared worker runtime: {}", e);
            });

        WorkerManager {
            workers: Arc::new(RwLock::new(HashMap::new())),
            worker_runtime: Arc::new(worker_runtime),
            starting: Arc::new(StdMutex::new(HashSet::new())),
        }
    }

    pub async fn get_worker_counts(&self) -> (usize, usize) {
        let workers = self.workers.read().await;
        let total = workers.len();
        let running = workers
            .values()
            .filter(|handle| handle.is_running())
            .count();
        (total, running)
    }

    /// Get the sessions directory path
    fn get_sessions_dir() -> PathBuf {
        crate::utils::fs::get_sessions_dir()
    }

    /// Start an account worker
    pub async fn start_account(&self, account_id: i64) -> Result<(), String> {
        // Check if already running
        {
            let workers = self.workers.read().await;
            if let Some(handle) = workers.get(&account_id) {
                if handle.is_running() {
                    return Err(format!("Account {} is already running", account_id));
                }
            }
        }

        // Atomically reserve this account's start slot. If another start is
        // already in flight (it passed the check above but hasn't inserted its
        // handle yet), bail out instead of spawning a duplicate worker. The
        // reservation is released on every return path by `_start_reservation`.
        {
            let mut starting = self.starting.lock().unwrap_or_else(|p| p.into_inner());
            if !starting.insert(account_id) {
                return Err(format!("Account {} is already starting", account_id));
            }
        }
        let _start_reservation = StartReservation {
            starting: self.starting.clone(),
            account_id,
        };

        // Get account and settings from DB
        let (account, settings, group_slots) = {
            let conn = db::get_conn().map_err(|e| e.to_string())?;
            let accounts = db::list_accounts(&conn).map_err(|e| e.to_string())?;
            let account = accounts
                .into_iter()
                .find(|a| a.id == account_id)
                .ok_or_else(|| format!("Account {} not found", account_id))?;
            let settings = db::get_settings(&conn).map_err(|e| e.to_string())?;

            // Get enabled group slots via the shared DB operations layer
            let slots = db::get_enabled_group_slots(&conn, account_id)
                .map_err(|e| e.to_string())?;

            (account, settings, slots)
        };

        // Validate API credentials
        let api_id = account
            .api_id_override
            .or(settings.api_id)
            .ok_or("API ID not configured")?;
        let api_hash = account
            .api_hash_override
            .clone()
            .or(settings.api_hash.clone())
            .ok_or("API Hash not configured")?;
        if api_id == 0 {
            return Err("API ID is invalid (0). Please configure a valid API ID in Settings or per-account.".to_string());
        }
        if api_hash.trim().is_empty() {
            return Err(
                "API Hash is empty. Please configure a valid API Hash in Settings or per-account."
                    .to_string(),
            );
        }

        // Get session directory
        let sessions_dir = Self::get_sessions_dir();
        let user_dir = account
            .user_id
            .map(|user_id| sessions_dir.join(format!("account_{}", user_id)));
        let account_dir = sessions_dir.join(format!("account_{}", account_id));
        let session_dir = if let Some(ref dir) = user_dir {
            if dir.exists() {
                dir.clone()
            } else if account_dir.exists() {
                account_dir.clone()
            } else {
                dir.clone()
            }
        } else {
            account_dir.clone()
        };

        if !session_dir.exists() {
            return Err(format!("Session directory not found: {:?}", session_dir));
        }

        // Build group chat IDs and moderator bot IDs
        let group_chat_ids: Vec<i64> = group_slots.iter().map(|(id, _, _)| *id).collect();

        // Warn if no groups are configured (but don't block start)
        if group_chat_ids.is_empty() {
            log::warn!("[{}] Warning: No game groups configured. The account will start but won't monitor any groups.", account.account_name);
        }

        let main_bot_id = settings.main_bot_user_id.filter(|id| *id > 0);
        let beta_bot_id = settings.beta_bot_user_id.filter(|id| *id > 0);

        let mut moderator_bot_ids = Vec::new();
        if let Some(id) = main_bot_id {
            moderator_bot_ids.push(id);
        }
        if let Some(id) = beta_bot_id {
            moderator_bot_ids.push(id);
        }

        // Warn if no moderator bots are configured
        if moderator_bot_ids.is_empty() {
            log::warn!("[{}] Warning: No moderator bot IDs configured in Settings. The account won't be able to detect game phases.", account.account_name);
        }

        // Build group slot configs with per-slot moderator
        let group_slot_configs: Vec<crate::workers::account_worker::GroupSlotConfig> = group_slots
            .iter()
            .map(|(group_id, moderator_kind, group_title)| {
                let bot_id = match moderator_kind.as_str() {
                    "beta" => beta_bot_id.or(main_bot_id),
                    _ => main_bot_id.or(beta_bot_id),
                };
                crate::workers::account_worker::GroupSlotConfig {
                    group_id: *group_id,
                    group_title: group_title.clone(),
                    moderator_kind: moderator_kind.clone(),
                    moderator_bot_id: bot_id.unwrap_or(0),
                }
            })
            .collect();

        // Create worker config
        let config = crate::workers::WorkerConfig {
            account_id,
            account_name: account.account_name.clone(),
            api_id,
            api_hash,
            session_dir,
            group_slots: group_slot_configs,
            group_chat_ids,
            moderator_bot_ids,
            main_bot_id,
            beta_bot_id,
            max_join_attempts: account
                .join_max_attempts_override
                .unwrap_or(settings.join_max_attempts_default),
            join_cooldown_seconds: account
                .join_cooldown_seconds_override
                .unwrap_or(settings.join_cooldown_seconds_default),
            // Device identity comes from global settings; proxy is per-account.
            connection: crate::telethon::ConnectionConfig::from_parts(
                settings.device_model.clone(),
                settings.system_version.clone(),
                settings.app_version.clone(),
                settings.lang_code.clone(),
                account.proxy_url.clone(),
            ),
        };

        // Update status to starting
        {
            let conn = db::get_conn().map_err(|e| e.to_string())?;
            db::update_account_status(&conn, account_id, WorkerState::Starting.as_str()).map_err(|e| e.to_string())?;
        }
        emit_account_status(account_id, WorkerState::Starting.as_str(), None);

        // Create command channel
        let (command_tx, command_rx) = mpsc::channel::<WorkerCommand>(8);
        let account_name = account.account_name.clone();

        // Stamp this worker with a unique instance id so its exit cleanup can
        // tell whether the handle in the map is still its own.
        let instance_id = WORKER_INSTANCE_SEQ.fetch_add(1, Ordering::Relaxed);

        // Spawn worker task on the dedicated worker runtime.
        // Using spawn directly avoids the convoluted tokio::spawn → spawn_blocking → block_on
        // nesting that was previously required.
        let workers = self.workers.clone();
        let account_name_clone = account_name.clone();
        let task_handle: JoinHandle<()> = self.worker_runtime.spawn(async move {
            log::info!("[{}] Worker task started", account_name_clone);

            let mut worker = AccountWorker::new(config);

            // Tracks why the worker exited. `Some(msg)` means it ended in an error
            // state (failed to start, fatal runtime error, or exhausted reconnects);
            // `None` means a clean stop. This is the single source of truth for the
            // final status so an error is never silently overwritten with "stopped".
            let final_error: Option<String> = match worker.start().await {
                Ok(()) => {
                    log::info!(
                        "[{}] Worker initialized, entering main loop",
                        account_name_clone
                    );

                    // Update status to running
                    if let Ok(conn) = db::get_conn() {
                        let _ = db::update_account_status(&conn, account_id, WorkerState::Running.as_str());
                    }
                    emit_account_status(account_id, WorkerState::Running.as_str(), None);

                    // Run the main loop
                    let run_result = worker.run_loop(command_rx).await;

                    // Stop the worker (best-effort cleanup of the Telethon session)
                    if let Err(e) = worker.stop().await {
                        log::debug!("[{}] Worker stop: {}", account_name_clone, e);
                    }

                    match run_result {
                        Ok(()) => None,
                        Err(e) => {
                            log::error!("[{}] Worker error: {}", account_name_clone, e);
                            Some(e)
                        }
                    }
                }
                Err(e) => {
                    log::error!("[{}] Failed to start worker: {}", account_name_clone, e);
                    Some(e)
                }
            };

            // Update DB status first, then remove from map so start_account
            // cannot race between "not in map" and DB still showing "running".
            {
                let mut workers_guard = workers.write().await;
                // Only act if the handle in the map is still ours (or none has
                // been inserted yet — the fast-fail path). If a newer worker
                // instance replaced us, leave its handle and status untouched so
                // we never orphan it or clobber its "running" state.
                let current_instance = workers_guard.get(&account_id).map(|h| h.instance_id);
                if current_instance == Some(instance_id) || current_instance.is_none() {
                    let (status, message): (&str, Option<String>) = match &final_error {
                        Some(e) => (WorkerState::Error(String::new()).as_str(), Some(e.clone())),
                        None => (WorkerState::Stopped.as_str(), None),
                    };
                    if let Ok(conn) = db::get_conn() {
                        let _ = db::update_account_status(&conn, account_id, status);
                    }
                    workers_guard.remove(&account_id);
                    emit_account_status(account_id, status, message);
                } else {
                    log::info!(
                        "[{}] Worker instance superseded by a newer start; skipping cleanup",
                        account_name_clone
                    );
                }
            }

            log::info!("[{}] Worker task ended", account_name_clone);
        });

        // Store the handle
        {
            let mut workers = self.workers.write().await;
            workers.insert(
                account_id,
                WorkerHandle {
                    account_id,
                    account_name: account.account_name,
                    instance_id,
                    command_tx,
                    task_handle,
                },
            );
        }

        // `_start_reservation` is released here, once the handle is in the map.
        Ok(())
    }

    /// Stop an account worker
    pub async fn stop_account(&self, account_id: i64) -> Result<(), String> {
        let (command_tx, task_finished) = {
            let workers = self.workers.read().await;
            workers
                .get(&account_id)
                .map(|h| (h.command_tx.clone(), h.task_handle.is_finished()))
        }
        .unzip();

        if let Some(command_tx) = command_tx {
            if task_finished.unwrap_or(true) {
                // Task already finished, just cleanup and mark stopped
                {
                    let mut workers = self.workers.write().await;
                    workers.remove(&account_id);
                }
                if let Ok(conn) = db::get_conn() {
                    let _ = db::update_account_status(&conn, account_id, WorkerState::Stopped.as_str());
                }
                emit_account_status(account_id, WorkerState::Stopped.as_str(), None);
                return Ok(());
            }

            // Update status to stopping
            {
                let conn = db::get_conn().map_err(|e| e.to_string())?;
                db::update_account_status(&conn, account_id, WorkerState::Stopping.as_str())
                    .map_err(|e| e.to_string())?;
            }
            emit_account_status(account_id, WorkerState::Stopping.as_str(), None);

            // Send shutdown signal
            let _ = command_tx.send(WorkerCommand::Shutdown).await;

            // Wait for worker to finish with timeout
            let start = std::time::Instant::now();
            let timeout =
                std::time::Duration::from_secs(crate::constants::WORKER_SHUTDOWN_TIMEOUT_SECONDS);
            loop {
                {
                    let workers = self.workers.read().await;
                    if !workers.contains_key(&account_id) {
                        break; // Worker removed itself
                    }
                    if let Some(h) = workers.get(&account_id) {
                        if h.task_handle.is_finished() {
                            break;
                        }
                    }
                }
                if start.elapsed() > timeout {
                    log::warn!("Timeout waiting for worker {} to stop", account_id);
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }

            // The worker task removes itself from the map and emits "stopped" atomically.
            // Only force-remove and emit "stopped" here if the task timed out and is still
            // in the map — avoid double-emitting if the worker already cleaned up.
            {
                let mut workers = self.workers.write().await;
                if workers.remove(&account_id).is_some() {
                    // Worker didn't clean itself up in time — force status update
                    if let Ok(conn) = db::get_conn() {
                        let _ = db::update_account_status(&conn, account_id, WorkerState::Stopped.as_str());
                    }
                    emit_account_status(account_id, WorkerState::Stopped.as_str(), None);
                }
            }

            Ok(())
        } else {
            // Account not running, just ensure status is stopped
            {
                let conn = db::get_conn().map_err(|e| e.to_string())?;
                db::update_account_status(&conn, account_id, WorkerState::Stopped.as_str())
                    .map_err(|e| e.to_string())?;
            }
            emit_account_status(account_id, WorkerState::Stopped.as_str(), None);
            Ok(())
        }
    }

    /// Check if an account is running (async version)
    pub async fn is_running(&self, account_id: i64) -> bool {
        let workers = self.workers.read().await;
        workers
            .get(&account_id)
            .map(|h| h.is_running())
            .unwrap_or(false)
    }

    /// Check if an account is running — synchronous version for use in sync commands.
    ///
    /// Deliberately avoids `blocking_read()`/`block_on`, which **panic** when
    /// called from within any Tokio runtime context. Tauri's execution context
    /// for sync commands is not guaranteed to be runtime-free, and a panic here
    /// would abort the calling command (e.g. `account_refresh_session`). Instead
    /// we use a short, bounded `try_read` retry: the workers write-lock is only
    /// ever held briefly (map insert/remove), so this resolves almost
    /// immediately. If the lock stays contended we conservatively report
    /// `true` so a session refresh never races an active worker.
    pub fn is_account_running(&self, account_id: i64) -> bool {
        for _ in 0..50 {
            if let Ok(workers) = self.workers.try_read() {
                return workers
                    .get(&account_id)
                    .map(|h| h.is_running())
                    .unwrap_or(false);
            }
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
        // Could not obtain a consistent view in ~100ms — assume running to be safe.
        true
    }

    /// Get list of running account IDs
    pub async fn running_accounts(&self) -> Vec<i64> {
        let workers = self.workers.read().await;
        workers
            .iter()
            .filter(|(_, h)| h.is_running())
            .map(|(id, _)| *id)
            .collect()
    }

    /// Reload detection patterns for a specific running worker
    pub async fn reload_patterns(&self, account_id: i64) -> Result<(), String> {
        let workers = self.workers.read().await;
        if let Some(handle) = workers.get(&account_id) {
            if handle.is_running() {
                handle.reload_patterns().await;
                Ok(())
            } else {
                Err(format!("Account {} is not running", account_id))
            }
        } else {
            Err(format!(
                "Account {} not found in running workers",
                account_id
            ))
        }
    }

    /// Reload detection patterns for all running workers
    pub async fn reload_all_patterns(&self) -> Result<(), String> {
        let workers = self.workers.read().await;
        for (account_id, handle) in workers.iter() {
            if handle.is_running() {
                log::info!("Reloading patterns for account {}", account_id);
                handle.reload_patterns().await;
            }
        }
        Ok(())
    }

    /// Stop all running workers
    pub async fn stop_all(&self) -> Result<(), String> {
        let account_ids: Vec<i64> = {
            let workers = self.workers.read().await;
            workers.keys().copied().collect()
        };

        // Stop all workers concurrently
        let futures: Vec<_> = account_ids
            .iter()
            .map(|&id| self.stop_account(id))
            .collect();

        let results = futures::future::join_all(futures).await;

        for (account_id, result) in account_ids.iter().zip(results) {
            if let Err(e) = result {
                log::error!("Failed to stop account {}: {}", account_id, e);
            }
        }

        Ok(())
    }
}

impl Default for WorkerManager {
    fn default() -> Self {
        Self::new()
    }
}
