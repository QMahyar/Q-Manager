use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
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
    responses: Arc<Mutex<HashMap<String, TelethonResponse>>>,
    events: Arc<Mutex<Vec<TelethonEvent>>>,
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

        let responses: Arc<Mutex<HashMap<String, TelethonResponse>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let events: Arc<Mutex<Vec<TelethonEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let responses_clone = Arc::clone(&responses);
        let events_clone = Arc::clone(&events);
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                if let Ok(response) = serde_json::from_str::<TelethonResponse>(&line) {
                    let mut guard = responses_clone.lock().unwrap();
                    guard.insert(response.id.clone(), response);
                } else if let Ok(event_wrapper) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(event_value) = event_wrapper.get("event") {
                        if let Ok(event) =
                            serde_json::from_value::<TelethonEvent>(event_value.clone())
                        {
                            let mut guard = events_clone.lock().unwrap();
                            guard.push(event);
                        }
                    }
                }
            }
        });

        Ok(TelethonClient {
            child: Arc::new(Mutex::new(child)),
            stdin: Arc::new(Mutex::new(stdin)),
            responses,
            events,
        })
    }

    pub fn request(&self, command: &str, payload: Value) -> Result<TelethonResponse, String> {
        let request_id = format!("req_{}", uuid::Uuid::new_v4());
        let request = TelethonRequest {
            id: request_id.clone(),
            command: command.to_string(),
            payload,
        };
        let payload = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        {
            let mut stdin = self.stdin.lock().unwrap();
            stdin
                .write_all(payload.as_bytes())
                .map_err(|e| e.to_string())?;
            stdin.write_all(b"\n").map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
        }

        let poll_interval_ms = 25u64;
        let max_iters = TELETHON_REQUEST_TIMEOUT_MS / poll_interval_ms;
        for _ in 0..max_iters {
            std::thread::sleep(Duration::from_millis(poll_interval_ms));
            if let Some(response) = self.responses.lock().unwrap().remove(&request_id) {
                return Ok(response);
            }
        }

        Err("Telethon worker timeout".to_string())
    }

    pub fn poll_events(&self) -> Vec<TelethonEvent> {
        let mut guard = self.events.lock().unwrap();
        let drained = guard.drain(..).collect::<Vec<_>>();
        drained
    }

    pub fn shutdown(&self) -> Result<(), String> {
        let _ = self.request("shutdown", Value::Null);
        let mut child = self.child.lock().unwrap();
        let _ = child.kill();
        Ok(())
    }
}

pub fn get_worker_path() -> String {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    #[cfg(windows)]
    let worker_name = "telethon-worker.exe";
    #[cfg(not(windows))]
    let worker_name = "telethon-worker";

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
