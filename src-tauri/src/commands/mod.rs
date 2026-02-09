//! Tauri commands for Q Manager
//! All IPC commands exposed to the frontend.

mod settings;
mod accounts;
mod phases;
mod actions;
mod login;
mod group_slots;
mod targets;
mod import_export;
mod startup_checks;

pub use settings::*;
pub use accounts::*;
pub use phases::*;
pub use actions::*;
pub use login::*;
pub use group_slots::*;
pub use targets::*;
pub use import_export::*;
pub use startup_checks::*;

use crate::errors::{AppError, ErrorResponse};

pub type CommandResult<T> = Result<T, ErrorResponse>;

pub fn error_response<E: Into<AppError>>(err: E) -> ErrorResponse {
    let app_err: AppError = err.into();
    ErrorResponse::from(&app_err)
}
