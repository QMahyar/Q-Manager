use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::telethon::{TelethonClient, TelethonResponse};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "state")]
pub enum AuthState {
    #[serde(rename = "not_started")]
    NotStarted,
    #[serde(rename = "waiting_phone_number")]
    WaitingPhoneNumber,
    #[serde(rename = "waiting_code")]
    WaitingCode { phone_number: String },
    #[serde(rename = "waiting_password")]
    WaitingPassword { password_hint: String },
    #[serde(rename = "ready")]
    Ready {
        user_id: i64,
        first_name: String,
        last_name: String,
        phone: String,
    },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "closed")]
    Closed,
}

#[allow(dead_code)]
pub struct TelethonLoginSession {
    pub api_id: i64,
    pub api_hash: String,
    pub session_dir: std::path::PathBuf,
    pub client: TelethonClient,
    pub state: AuthState,
}

impl TelethonLoginSession {
    pub fn new(
        api_id: i64,
        api_hash: String,
        session_dir: std::path::PathBuf,
    ) -> Result<Self, String> {
        let session_path = session_dir
            .join("telethon.session")
            .to_string_lossy()
            .to_string();
        let client = TelethonClient::spawn(api_id, &api_hash, &session_path)?;
        let state = AuthState::WaitingPhoneNumber;
        Ok(Self {
            api_id,
            api_hash,
            session_dir,
            client,
            state,
        })
    }

    pub fn request_state(&mut self) -> Result<AuthState, String> {
        let response = self.client.request("state", serde_json::json!({}))?;
        self.state = parse_state(response)?;
        Ok(self.state.clone())
    }

    pub fn send_phone_number(&mut self, phone: &str) -> Result<AuthState, String> {
        let response = self
            .client
            .request("send_phone", serde_json::json!({"phone": phone}))?;
        self.state = parse_state(response)?;
        Ok(self.state.clone())
    }

    pub fn send_code(&mut self, code: &str) -> Result<AuthState, String> {
        let response = self
            .client
            .request("send_code", serde_json::json!({"code": code}))?;
        self.state = parse_state(response)?;
        Ok(self.state.clone())
    }

    pub fn send_password(&mut self, password: &str) -> Result<AuthState, String> {
        let response = self
            .client
            .request("send_password", serde_json::json!({"password": password}))?;
        self.state = parse_state(response)?;
        Ok(self.state.clone())
    }

    pub fn shutdown(&self) {
        let _ = self.client.shutdown();
    }
}

fn parse_state(response: TelethonResponse) -> Result<AuthState, String> {
    if !response.ok {
        return Err(response
            .error
            .unwrap_or_else(|| "Telethon worker error".to_string()));
    }
    let payload = response.payload.unwrap_or(Value::Null);
    serde_json::from_value(payload).map_err(|e| format!("Failed to parse auth state: {}", e))
}
