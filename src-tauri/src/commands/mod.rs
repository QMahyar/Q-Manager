//! Tauri commands for Q Manager
//! All IPC commands exposed to the frontend.

mod accounts;
mod actions;
mod group_slots;
mod import_export;
mod login;
mod phases;
mod settings;
mod startup_checks;
mod targets;

pub use accounts::*;
pub use actions::*;
pub use group_slots::*;
pub use import_export::*;
pub use login::*;
pub use phases::*;
pub use settings::*;
pub use startup_checks::*;
pub use targets::*;

use crate::errors::{AppError, ErrorResponse};

pub type CommandResult<T> = Result<T, ErrorResponse>;

pub fn error_response<E: Into<AppError>>(err: E) -> ErrorResponse {
    let app_err: AppError = err.into();
    ErrorResponse::from(&app_err)
}
