//! Comprehensive tests for database operations
//!
//! Tests cover:
//! - Account CRUD operations
//! - Settings management
//! - Phase pattern operations
//! - Action operations
//! - Target management

#[cfg(all(test, not(windows)))]
mod tests {
    use super::super::operations::*;
    use crate::db::schema::init_db;
    use rusqlite::Connection;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    #[test]
    fn test_settings_get_default() {
        let conn = create_test_db();
        let settings = get_settings(&conn).unwrap();

        // Default settings should exist
        assert_eq!(settings.join_max_attempts_default, 5);
        assert_eq!(settings.join_cooldown_seconds_default, 5);
    }

    #[test]
    fn test_settings_update() {
        let conn = create_test_db();

        let update = SettingsUpdate {
            api_id: Some(12345),
            api_hash: Some("test_hash".to_string()),
            main_bot_user_id: Some(111111),
            main_bot_username: Some("test_bot".to_string()),
            beta_bot_user_id: None,
            beta_bot_username: None,
            join_max_attempts_default: Some(10),
            join_cooldown_seconds_default: Some(3),
            ban_warning_patterns_json: None,
            theme_mode: None,
            theme_palette: None,
            theme_variant: None,
        };

        update_settings(&conn, &update).unwrap();

        let settings = get_settings(&conn).unwrap();
        assert_eq!(settings.api_id, Some(12345));
        assert_eq!(settings.api_hash, Some("test_hash".to_string()));
        assert_eq!(settings.main_bot_user_id, Some(111111));
        assert_eq!(settings.join_max_attempts_default, 10);
        assert_eq!(settings.join_cooldown_seconds_default, 3);
    }

    #[test]
    fn test_account_create_and_list() {
        let conn = create_test_db();

        let create_data = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: Some("Test User".to_string()),
            phone: Some("+1234567890".to_string()),
            user_id: Some(123456789),
            api_id_override: Some(12345),
            api_hash_override: Some("test_hash".to_string()),
        };

        let account_id = create_account(&conn, &create_data).unwrap();
        assert!(account_id > 0);

        let accounts = list_accounts(&conn).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].account_name, "TestAccount");
        assert_eq!(accounts[0].phone, Some("+1234567890".to_string()));
        assert_eq!(accounts[0].user_id, Some(123456789));
    }

    #[test]
    fn test_account_get_by_id() {
        let conn = create_test_db();

        let create_data = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: None,
            phone: None,
            user_id: None,
            api_id_override: None,
            api_hash_override: None,
        };

        let account_id = create_account(&conn, &create_data).unwrap();
        let account_opt = get_account(&conn, account_id).unwrap();

        assert!(account_opt.is_some());
        let account = account_opt.unwrap();
        assert_eq!(account.id, account_id);
        assert_eq!(account.account_name, "TestAccount");
        assert_eq!(account.status, "stopped");
    }

    #[test]
    fn test_account_update_status() {
        let conn = create_test_db();

        let create_data = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: None,
            phone: None,
            user_id: None,
            api_id_override: None,
            api_hash_override: None,
        };

        let account_id = create_account(&conn, &create_data).unwrap();

        update_account_status(&conn, account_id, "running").unwrap();
        let account = get_account(&conn, account_id).unwrap().unwrap();
        assert_eq!(account.status, "running");

        update_account_status(&conn, account_id, "stopped").unwrap();
        let account = get_account(&conn, account_id).unwrap().unwrap();
        assert_eq!(account.status, "stopped");
    }

    #[test]
    fn test_account_delete() {
        let conn = create_test_db();

        let create_data = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: None,
            phone: None,
            user_id: None,
            api_id_override: None,
            api_hash_override: None,
        };

        let account_id = create_account(&conn, &create_data).unwrap();
        delete_account(&conn, account_id).unwrap();

        let result = get_account(&conn, account_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_account_name_exists() {
        let conn = create_test_db();

        let create_data = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: None,
            phone: None,
            user_id: None,
            api_id_override: None,
            api_hash_override: None,
        };

        create_account(&conn, &create_data).unwrap();

        assert!(account_name_exists(&conn, "TestAccount").unwrap());
        assert!(!account_name_exists(&conn, "NonExistent").unwrap());
    }

    #[test]
    fn test_phase_patterns_list() {
        let conn = create_test_db();

        // Get default phases (should be 4: JoinTime, Join Confirmation, Game Start, Game End)
        let phases = list_phases(&conn).unwrap();
        assert_eq!(phases.len(), 4);
    }

    #[test]
    fn test_actions_list() {
        let conn = create_test_db();

        let actions = list_actions(&conn).unwrap();
        // Initially no actions
        assert_eq!(actions.len(), 0);
    }

    #[test]
    fn test_action_create_and_delete() {
        let conn = create_test_db();

        let create_data = ActionCreate {
            name: "Vote".to_string(),
            button_type: "player_list".to_string(),
            is_two_step: false,
            random_fallback_enabled: true,
        };

        let action_id = create_action(&conn, &create_data).unwrap();
        assert!(action_id > 0);

        let actions = list_actions(&conn).unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].name, "Vote");

        delete_action(&conn, action_id).unwrap();
        let actions = list_actions(&conn).unwrap();
        assert_eq!(actions.len(), 0);
    }

    #[test]
    fn test_effective_delay() {
        let conn = create_test_db();

        let account_create = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: None,
            phone: None,
            user_id: None,
            api_id_override: None,
            api_hash_override: None,
        };

        let account_id = create_account(&conn, &account_create).unwrap();

        let action_create = ActionCreate {
            name: "Vote".to_string(),
            button_type: "player_list".to_string(),
            is_two_step: false,
            random_fallback_enabled: true,
        };

        let action_id = create_action(&conn, &action_create).unwrap();

        // Get effective delay (should return defaults)
        let delay = get_effective_delay(&conn, account_id, action_id).unwrap();
        assert!(delay.0 >= 0);
        assert!(delay.1 >= delay.0);
    }

    #[test]
    fn test_blacklist_get() {
        let conn = create_test_db();

        let account_create = AccountCreate {
            account_name: "TestAccount".to_string(),
            telegram_name: None,
            phone: None,
            user_id: None,
            api_id_override: None,
            api_hash_override: None,
        };

        let account_id = create_account(&conn, &account_create).unwrap();

        let action_create = ActionCreate {
            name: "Vote".to_string(),
            button_type: "player_list".to_string(),
            is_two_step: false,
            random_fallback_enabled: true,
        };

        let action_id = create_action(&conn, &action_create).unwrap();

        // Get blacklist (should be empty initially)
        let blacklist = get_blacklist(&conn, account_id, action_id).unwrap();
        assert_eq!(blacklist.len(), 0);
    }

    #[test]
    fn test_integer_overflow_protection() {
        // Test that delays don't overflow
        let max_i32: i32 = i32::MAX;
        let result = max_i32.saturating_mul(1000);
        assert_eq!(result, i32::MAX); // Should saturate, not overflow

        // Test reasonable delay values
        let delay: i32 = 10;
        let result = delay.saturating_mul(1000);
        assert_eq!(result, 10000);
    }
}
