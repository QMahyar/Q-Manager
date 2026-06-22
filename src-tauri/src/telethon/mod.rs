use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::commands::error_response;
use crate::constants::TELETHON_REQUEST_TIMEOUT_MS;

pub mod login_session;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelethonButton {
    pub text: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub data: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelethonMessage {
    pub id: i64,
    pub chat_id: i64,
    pub sender_id: i64,
    pub text: String,
    pub is_outgoing: bool,
    pub buttons: Vec<Vec<TelethonButton>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelethonEvent {
    #[serde(rename = "type")]
    pub kind: String,
    pub message: Option<TelethonMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TelethonRequest {
    pub id: String,
    pub command: String,
    pub payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TelethonResponse {
    pub id: String,
    pub ok: bool,
    pub payload: Option<Value>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct TelethonClient {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<TelethonResponse>>>>,
    events: Arc<Mutex<Vec<TelethonEvent>>>,
    /// `true` while the worker subprocess is believed to be running. The reader
    /// thread flips this to `false` when stdout closes (the process exited) so
    /// in-flight and future `request()` calls fail fast instead of blocking for
    /// the full request timeout.
    alive: Arc<AtomicBool>,
}

impl Drop for TelethonClient {
    fn drop(&mut self) {
        // Best-effort shutdown: kill the subprocess when the client is dropped
        // without an explicit shutdown() call.
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
        }
    }
}

impl TelethonClient {
    pub fn spawn(api_id: i64, api_hash: &str, session_path: &str) -> Result<Self, String> {
        let mut child = Command::new(get_worker_path())
            .arg(api_id.to_string())
            .arg(api_hash)
            .arg(session_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn telethon worker: {}", e))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to open worker stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to open worker stdout".to_string())?;

        let pending: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<TelethonResponse>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let events: Arc<Mutex<Vec<TelethonEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let alive = Arc::new(AtomicBool::new(true));
        let pending_clone = Arc::clone(&pending);
        let events_clone = Arc::clone(&events);
        let alive_clone = Arc::clone(&alive);
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(response) = serde_json::from_str::<TelethonResponse>(&line) {
                    // If there's no pending waiter, the response is silently discarded
                    // (unmatched responses are not buffered to prevent memory leaks)
                    if let Some(sender) = pending_clone.lock().unwrap_or_else(|p| p.into_inner()).remove(&response.id) {
                        let _ = sender.send(response);
                    }
                } else if let Ok(event_wrapper) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(event_value) = event_wrapper.get("event") {
                        if let Ok(event) =
                            serde_json::from_value::<TelethonEvent>(event_value.clone())
                        {
                            let mut guard = events_clone.lock().unwrap_or_else(|p| p.into_inner());
                            guard.push(event);
                        }
                    }
                }
            }
            // stdout closed → the worker subprocess has exited. Mark the client
            // dead and drop every pending response sender so any in-flight or
            // future request() fails fast (the receiver sees a disconnected
            // channel) instead of blocking for the full request timeout.
            alive_clone.store(false, Ordering::Release);
            pending_clone
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .clear();
        });

        Ok(TelethonClient {
            child: Arc::new(Mutex::new(child)),
            stdin: Arc::new(Mutex::new(stdin)),
            pending,
            events,
            alive,
        })
    }

    /// Send a request and block the calling thread until the worker responds,
    /// the request times out, or the worker dies.
    ///
    /// This is synchronous I/O. When called from an async task, prefer
    /// [`Self::request_async`] so the blocking wait happens on the dedicated
    /// blocking pool rather than parking a runtime worker thread.
    pub fn request(&self, command: &str, payload: Value) -> Result<TelethonResponse, String> {
        // Fast-fail if the worker is already known to be dead.
        if !self.alive.load(Ordering::Acquire) {
            return Err("Telethon worker process has exited".to_string());
        }

        let request_id = format!("req_{}", uuid::Uuid::new_v4());
        let request = TelethonRequest {
            id: request_id.clone(),
            command: command.to_string(),
            payload,
        };
        let payload = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        let (tx, rx) = std::sync::mpsc::channel();
        self.pending
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(request_id.clone(), tx);

        // Write the request. On any failure remove our pending entry immediately
        // so a failed send can never leak a sender into the map.
        let write_result = (|| -> Result<(), String> {
            let mut stdin = self.stdin.lock().unwrap_or_else(|p| p.into_inner());
            stdin
                .write_all(payload.as_bytes())
                .map_err(|e| e.to_string())?;
            stdin.write_all(b"\n").map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
            Ok(())
        })();
        if let Err(e) = write_result {
            self.pending
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .remove(&request_id);
            return Err(e);
        }

        // The worker may have exited between our insert and now; in that case the
        // reader thread has already drained `pending`. Re-check so we don't sit
        // on the channel for the full timeout waiting for a response that the
        // (now dead) reader can never deliver.
        if !self.alive.load(Ordering::Acquire) {
            self.pending
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .remove(&request_id);
            return Err("Telethon worker process has exited".to_string());
        }

        match rx.recv_timeout(Duration::from_millis(TELETHON_REQUEST_TIMEOUT_MS)) {
            Ok(response) => Ok(response),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                self.pending
                    .lock()
                    .unwrap_or_else(|p| p.into_inner())
                    .remove(&request_id);
                Err("Telethon worker timeout".to_string())
            }
            Err(_) => {
                // Sender was dropped — the reader thread exited (worker died).
                self.pending
                    .lock()
                    .unwrap_or_else(|p| p.into_inner())
                    .remove(&request_id);
                Err("Telethon worker connection closed".to_string())
            }
        }
    }

    /// Async wrapper around [`Self::request`] that runs the blocking call on the
    /// dedicated blocking thread pool. Use this from async worker code so a slow
    /// or hung worker never parks one of the (few) async runtime threads.
    pub async fn request_async(
        &self,
        command: &str,
        payload: Value,
    ) -> Result<TelethonResponse, String> {
        let client = self.clone();
        let command = command.to_string();
        tokio::task::spawn_blocking(move || client.request(&command, payload))
            .await
            .map_err(|e| format!("Telethon request task failed: {}", e))?
    }

    /// Async wrapper around [`Self::shutdown`] that runs the blocking shutdown
    /// (which waits up to 3s for graceful exit) off the async runtime threads.
    pub async fn shutdown_async(&self) -> Result<(), String> {
        let client = self.clone();
        tokio::task::spawn_blocking(move || client.shutdown())
            .await
            .map_err(|e| format!("Telethon shutdown task failed: {}", e))?
    }

    pub fn poll_events(&self) -> Vec<TelethonEvent> {
        self.events.lock().unwrap_or_else(|p| p.into_inner()).drain(..).collect()
    }

    /// Returns true if the worker subprocess is still running.
    /// Used to detect an unexpectedly-exited worker so the account can reconnect.
    pub fn is_alive(&self) -> bool {
        // The reader thread flips `alive` to false the moment stdout closes,
        // which is often detected before `try_wait` reports the exit.
        if !self.alive.load(Ordering::Acquire) {
            return false;
        }
        match self.child.lock() {
            // `Ok(None)` from `try_wait` means the process has not exited yet.
            Ok(mut child) => matches!(child.try_wait(), Ok(None)),
            // Poisoned lock: assume alive to avoid spurious reconnect storms.
            Err(_) => true,
        }
    }

    pub fn shutdown(&self) -> Result<(), String> {
        // Send graceful shutdown command and give the worker time to disconnect cleanly
        let _ = self.request("shutdown", Value::Null);
        // Wait up to 3 seconds for graceful exit before force-killing
        let mut child = self.child.lock().unwrap_or_else(|p| p.into_inner());
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
        loop {
            match child.try_wait() {
                Ok(Some(_)) => return Ok(()), // exited cleanly
                Ok(None) if std::time::Instant::now() < deadline => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                _ => break,
            }
        }
        let _ = child.kill();
        Ok(())
    }
}

pub fn get_worker_path() -> String {
    #[cfg(windows)]
    let worker_name = "telethon-worker.exe";
    #[cfg(not(windows))]
    let worker_name = "telethon-worker";

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    let candidates = [
        exe_dir.join(worker_name),
        exe_dir.join("resources").join(worker_name),
        exe_dir.join("..").join("resources").join(worker_name),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    exe_dir.join(worker_name).to_string_lossy().to_string()
}

pub fn assert_worker_exists() -> Result<(), crate::errors::ErrorResponse> {
    let path = get_worker_path();
    if !std::path::Path::new(&path).exists() {
        return Err(error_response(format!(
            "Telethon worker not found at {}",
            path
        )));
    }
    Ok(())
}
