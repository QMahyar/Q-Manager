//! System tray functionality
//!
//! Provides tray icon with menu:
//! - Show/Hide window
//! - Start/Stop account submenus
//! - Exit

use image::GenericImageView;
use once_cell::sync::OnceCell;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::db;

/// Global tray icon reference for dynamic updates
static TRAY_ICON: OnceCell<Mutex<Option<TrayIcon<tauri::Wry>>>> = OnceCell::new();

/// Account info for tray menu
#[derive(Debug, Clone)]
struct TrayAccount {
    id: i64,
    name: String,
    status: String,
}

/// Get accounts from database for tray menu
fn get_accounts() -> Vec<TrayAccount> {
    let conn = match db::get_conn() {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut stmt =
        match conn.prepare("SELECT id, account_name, status FROM accounts ORDER BY account_name") {
            Ok(s) => s,
            Err(_) => return vec![],
        };

    let accounts = stmt
        .query_map([], |row| {
            Ok(TrayAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(2)?,
            })
        })
        .ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    accounts
}

/// Create and setup the system tray (specific for Wry runtime, stores globally)
pub fn setup_tray_wry(app: &tauri::App<tauri::Wry>) -> Result<(), Box<dyn std::error::Error>> {
    // Build initial menu
    let menu = build_tray_menu(app)?;

    // Load icon - use the app's path resolver to find the icon
    let icon_path = app.path().resource_dir()?.join("icons").join("icon.png");
    log::info!("Loading tray icon from: {:?}", icon_path);
    
    // Read the icon file and create an Image
    let icon_bytes = std::fs::read(&icon_path)
        .map_err(|e| {
            log::error!("Failed to read tray icon from {:?}: {}", icon_path, e);
            e
        })?;
    
    let icon = image::load_from_memory(&icon_bytes)
        .map_err(|e| {
            log::error!("Failed to decode tray icon: {}", e);
            e
        })?;
    
    let (width, height) = icon.dimensions();
    let rgba = icon.to_rgba8().into_raw();
    let tauri_icon = tauri::image::Image::new_owned(rgba, width, height);

    // Create tray icon
    let tray = TrayIconBuilder::new()
        .icon(tauri_icon)
        .menu(&menu)
        .tooltip("Q Manager")
        .on_menu_event(move |app, event| {
            handle_menu_event(app, &event.id.0);
        })
        .on_tray_icon_event(|tray, event| {
            // Click to show/hide window
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Store tray icon globally for dynamic updates
    let _ = TRAY_ICON.set(Mutex::new(Some(tray)));

    log::info!("System tray initialized (with dynamic refresh support)");
    Ok(())
}

/// Build the tray menu with current account states
pub fn build_tray_menu<R: Runtime>(
    app: &tauri::App<R>,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let accounts = get_accounts();

    // Separate running and stopped accounts
    let stopped_accounts: Vec<_> = accounts
        .iter()
        .filter(|a| a.status == "stopped" || a.status == "error")
        .collect();
    let running_accounts: Vec<_> = accounts
        .iter()
        .filter(|a| a.status == "running" || a.status == "starting")
        .collect();

    // Create menu items
    let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
    let separator1 = MenuItem::with_id(app, "sep1", "─────────────", false, None::<&str>)?;

    // Start submenu
    let start_submenu = if stopped_accounts.is_empty() {
        Submenu::with_items(
            app,
            "▶ Start",
            true,
            &[&MenuItem::with_id(
                app,
                "no_stopped",
                "(No stopped accounts)",
                false,
                None::<&str>,
            )?],
        )?
    } else {
        let mut items: Vec<MenuItem<R>> = Vec::new();
        // Add "Start All" option first
        items.push(MenuItem::with_id(
            app,
            "start_all",
            "Start All",
            true,
            None::<&str>,
        )?);
        items.push(MenuItem::with_id(
            app,
            "start_sep",
            "─────────────",
            false,
            None::<&str>,
        )?);
        for acc in &stopped_accounts {
            items.push(MenuItem::with_id(
                app,
                format!("start_{}", acc.id),
                &acc.name,
                true,
                None::<&str>,
            )?);
        }
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = items
            .iter()
            .map(|i| i as &dyn tauri::menu::IsMenuItem<R>)
            .collect();
        Submenu::with_items(app, "▶ Start", true, &item_refs)?
    };

    // Stop submenu
    let stop_submenu = if running_accounts.is_empty() {
        Submenu::with_items(
            app,
            "■ Stop",
            true,
            &[&MenuItem::with_id(
                app,
                "no_running",
                "(No running accounts)",
                false,
                None::<&str>,
            )?],
        )?
    } else {
        let mut items: Vec<MenuItem<R>> = Vec::new();
        // Add "Stop All" option first
        items.push(MenuItem::with_id(
            app,
            "stop_all",
            "Stop All",
            true,
            None::<&str>,
        )?);
        items.push(MenuItem::with_id(
            app,
            "stop_sep",
            "─────────────",
            false,
            None::<&str>,
        )?);
        for acc in &running_accounts {
            items.push(MenuItem::with_id(
                app,
                format!("stop_{}", acc.id),
                &acc.name,
                true,
                None::<&str>,
            )?);
        }
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = items
            .iter()
            .map(|i| i as &dyn tauri::menu::IsMenuItem<R>)
            .collect();
        Submenu::with_items(app, "■ Stop", true, &item_refs)?
    };

    let separator2 = MenuItem::with_id(app, "sep2", "─────────────", false, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(
        app,
        &[
            &show_hide,
            &separator1,
            &start_submenu,
            &stop_submenu,
            &separator2,
            &exit,
        ],
    )?;

    Ok(menu)
}

/// Refresh the tray menu with current account states
/// Call this when account status changes
pub fn refresh_tray_menu(app: &AppHandle<tauri::Wry>) {
    if let Some(tray_mutex) = TRAY_ICON.get() {
        if let Ok(guard) = tray_mutex.lock() {
            if let Some(tray) = guard.as_ref() {
                // Build new menu
                match build_tray_menu_for_handle(app) {
                    Ok(menu) => {
                        if let Err(e) = tray.set_menu(Some(menu)) {
                            log::error!("Failed to update tray menu: {}", e);
                        } else {
                            log::debug!("Tray menu refreshed");
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to build tray menu: {}", e);
                    }
                }
            }
        }
    }
}

/// Build tray menu using AppHandle (for refresh)
fn build_tray_menu_for_handle(
    app: &AppHandle<tauri::Wry>,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let accounts = get_accounts();

    // Separate running and stopped accounts
    let stopped_accounts: Vec<_> = accounts
        .iter()
        .filter(|a| a.status == "stopped" || a.status == "error")
        .collect();
    let running_accounts: Vec<_> = accounts
        .iter()
        .filter(|a| a.status == "running" || a.status == "starting")
        .collect();

    // Create menu items
    let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
    let separator1 = MenuItem::with_id(app, "sep1", "─────────────", false, None::<&str>)?;

    // Start submenu
    let start_submenu = if stopped_accounts.is_empty() {
        Submenu::with_items(
            app,
            "▶ Start",
            true,
            &[&MenuItem::with_id(
                app,
                "no_stopped",
                "(No stopped accounts)",
                false,
                None::<&str>,
            )?],
        )?
    } else {
        let mut items: Vec<MenuItem<tauri::Wry>> = Vec::new();
        items.push(MenuItem::with_id(
            app,
            "start_all",
            "Start All",
            true,
            None::<&str>,
        )?);
        items.push(MenuItem::with_id(
            app,
            "start_sep",
            "─────────────",
            false,
            None::<&str>,
        )?);
        for acc in &stopped_accounts {
            items.push(MenuItem::with_id(
                app,
                format!("start_{}", acc.id),
                &acc.name,
                true,
                None::<&str>,
            )?);
        }
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = items
            .iter()
            .map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
            .collect();
        Submenu::with_items(app, "▶ Start", true, &item_refs)?
    };

    // Stop submenu
    let stop_submenu = if running_accounts.is_empty() {
        Submenu::with_items(
            app,
            "■ Stop",
            true,
            &[&MenuItem::with_id(
                app,
                "no_running",
                "(No running accounts)",
                false,
                None::<&str>,
            )?],
        )?
    } else {
        let mut items: Vec<MenuItem<tauri::Wry>> = Vec::new();
        items.push(MenuItem::with_id(
            app,
            "stop_all",
            "Stop All",
            true,
            None::<&str>,
        )?);
        items.push(MenuItem::with_id(
            app,
            "stop_sep",
            "─────────────",
            false,
            None::<&str>,
        )?);
        for acc in &running_accounts {
            items.push(MenuItem::with_id(
                app,
                format!("stop_{}", acc.id),
                &acc.name,
                true,
                None::<&str>,
            )?);
        }
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = items
            .iter()
            .map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
            .collect();
        Submenu::with_items(app, "■ Stop", true, &item_refs)?
    };

    let separator2 = MenuItem::with_id(app, "sep2", "─────────────", false, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(
        app,
        &[
            &show_hide,
            &separator1,
            &start_submenu,
            &stop_submenu,
            &separator2,
            &exit,
        ],
    )?;

    Ok(menu)
}

/// Handle tray menu events
fn handle_menu_event<R: Runtime>(app: &tauri::AppHandle<R>, id: &str) {
    log::debug!("Tray menu event: {}", id);

    match id {
        "show_hide" => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        "exit" => {
            log::info!("Exit requested from tray");
            app.exit(0);
        }
        "start_all" => {
            log::info!("Start all accounts requested from tray");
            // Emit event to frontend to handle
            let _ = app.emit("tray-start-all", ());
        }
        "stop_all" => {
            log::info!("Stop all accounts requested from tray");
            // Emit event to frontend to handle
            let _ = app.emit("tray-stop-all", ());
        }
        id if id.starts_with("start_") => {
            if let Ok(account_id) = id.trim_start_matches("start_").parse::<i64>() {
                log::info!("Start account {} requested from tray", account_id);
                let _ = app.emit("tray-start-account", account_id);
            }
        }
        id if id.starts_with("stop_") => {
            if let Ok(account_id) = id.trim_start_matches("stop_").parse::<i64>() {
                log::info!("Stop account {} requested from tray", account_id);
                let _ = app.emit("tray-stop-account", account_id);
            }
        }
        _ => {}
    }
}
