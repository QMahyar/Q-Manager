//! Q Manager - Werewolf Game Automation
//!
//! This is the main library for the Tauri backend.

mod commands;
pub mod constants;
mod db;
pub mod errors;
pub mod events;
mod ipc;
mod logging;
pub mod startup_checks;
mod telethon;
mod tray;
mod utils;
pub mod validation;
mod workers;

#[cfg(all(test, not(windows)))]
mod validation_tests;

use commands::*;
use std::time::Instant;
use tauri::Manager;

/// Initialize logging
fn init_logging() {
    if let Err(err) = crate::logging::init() {
        eprintln!("Failed to initialize logger: {}", err);
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();

    log::info!("Starting Q Manager...");
    let start = Instant::now();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window when a second instance is launched
            log::info!("Second instance launched, focusing existing window");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            // Check Telethon worker
            match telethon::assert_worker_exists() {
                Ok(()) => log::info!("Telethon worker available"),
                Err(e) => log::warn!("Telethon worker not available: {}", e.message),
            }

            // Initialize global event emitter
            events::init_global_emitter(app.handle().clone());

            // Setup system tray (with dynamic refresh support)
            if let Err(e) = tray::setup_tray_wry(app) {
                log::error!("Failed to setup system tray: {}", e);
            }
            log::info!("Startup setup completed in {:?}", start.elapsed());
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                tauri::async_runtime::spawn(async {
                    let _ = crate::workers::WORKER_MANAGER.stop_all().await;
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings_get,
            settings_update,
            // Accounts
            accounts_list,
            account_create,
            account_delete,
            account_start,
            account_stop,
            accounts_start_all,
            accounts_stop_all,
            accounts_start_selected,
            accounts_stop_selected,
            account_update,
            account_get,
            account_name_exists,
            // Phases
            phases_list,
            phase_patterns_list,
            phase_pattern_create,
            phase_pattern_delete,
            phase_pattern_update,
            phase_update_priority,
            patterns_reload_all,
            patterns_reload,
            // Actions
            actions_list,
            action_create,
            action_delete,
            action_update,
            action_patterns_list,
            action_pattern_create,
            action_pattern_delete,
            action_pattern_update,
            // Login
            login_check_telethon,
            login_start,
            login_get_state,
            login_send_phone,
            login_send_code,
            login_send_password,
            login_complete,
            login_cancel,
            // Group Slots
            group_slots_get,
            group_slot_update,
            group_slots_init,
            account_fetch_groups,
            // Targets
            target_defaults_get,
            target_default_set,
            target_override_get,
            target_override_set,
            target_override_delete,
            target_overrides_list,
            blacklist_list,
            blacklist_add,
            blacklist_remove,
            delay_default_get,
            delay_default_set,
            delay_override_get,
            delay_override_set,
            delay_override_delete,
            target_pairs_list,
            target_pair_add,
            target_pair_remove,
            targets_copy,
            // Import/Export
            account_import_preflight,
            account_import_resolve,
            phase_patterns_export,
            phase_patterns_import,
            action_patterns_export,
            action_patterns_import,
            account_export,
            account_session_path,
            // Startup Checks
            check_telethon_available,
            check_telethon,
            check_account_start,
            check_can_login,
            check_system,
            diagnostics_snapshot,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log::error!("FATAL: Tauri application failed to start: {}", e);
            log::error!("This is a critical error. Check the logs above for details.");
            eprintln!("\n=== FATAL ERROR ===");
            eprintln!("Q Manager failed to start: {}", e);
            eprintln!("Check the application logs for more details.");
            eprintln!("===================\n");
            std::process::exit(1);
        });
}
