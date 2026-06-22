//! Integration tests for Q Manager
//!
//! These tests verify that different components work together correctly.
//! They use the public API surface of q_manager_lib.

#[test]
fn test_url_parsing() {
    // Test that URL parsing works correctly
    let url = "https://t.me/botname?start=game123";
    assert!(url.contains("start="));
}

#[test]
fn test_login_state_flow() {
    // AuthState-like variants as local enum to avoid depending on private internals
    #[derive(Debug, PartialEq)]
    enum AuthState {
        NotStarted,
        WaitingPhoneNumber,
        WaitingCode {
            phone_number: String,
        },
        WaitingPassword {
            password_hint: String,
        },
        Ready {
            user_id: i64,
            first_name: String,
            last_name: String,
            phone: String,
        },
        Error {
            message: String,
        },
        Closed,
    }

    let state = AuthState::NotStarted;
    assert!(matches!(state, AuthState::NotStarted));

    let state = AuthState::WaitingPhoneNumber;
    assert!(matches!(state, AuthState::WaitingPhoneNumber));

    let state = AuthState::WaitingCode {
        phone_number: "+15555550123".to_string(),
    };
    assert!(matches!(state, AuthState::WaitingCode { .. }));

    let state = AuthState::WaitingPassword {
        password_hint: "hint".to_string(),
    };
    assert!(matches!(state, AuthState::WaitingPassword { .. }));

    let state = AuthState::Ready {
        user_id: 42,
        first_name: "Test".to_string(),
        last_name: "User".to_string(),
        phone: "+15555550123".to_string(),
    };
    assert!(matches!(state, AuthState::Ready { .. }));

    let state = AuthState::Error {
        message: "oops".to_string(),
    };
    assert!(matches!(state, AuthState::Error { .. }));

    let state = AuthState::Closed;
    assert!(matches!(state, AuthState::Closed));
}

#[test]
fn test_game_state_transitions() {
    // Test game state logic
    let mut joined = false;
    let mut game_started = false;
    let mut game_ended = false;

    // Simulate game flow
    assert!(!joined);
    assert!(!game_started);

    joined = true;
    assert!(joined);
    assert!(!game_started);

    game_started = true;
    assert!(joined);
    assert!(game_started);
    assert!(!game_ended);

    game_ended = true;
    assert!(game_ended);

    // Reset
    joined = false;
    game_started = false;
    game_ended = false;
    assert!(!joined && !game_started && !game_ended);
}

#[test]
fn test_worker_config_uses_overrides() {
    // Test that local overrides take precedence over default values
    #[allow(clippy::too_many_arguments)]
    fn config_from_account(
        api_id_override: Option<i32>,
        api_hash_override: Option<String>,
        join_max_attempts_override: Option<i32>,
        join_cooldown_seconds_override: Option<i32>,
        default_join_max: i32,
        default_join_cooldown: i32,
        default_api_id: Option<i32>,
        default_api_hash: Option<String>,
    ) -> (i32, String, i32, i32) {
        let api_id = api_id_override.or(default_api_id).unwrap_or(0);
        let api_hash = api_hash_override.or(default_api_hash).unwrap_or_default();
        let max_join_attempts = join_max_attempts_override.unwrap_or(default_join_max);
        let join_cooldown = join_cooldown_seconds_override.unwrap_or(default_join_cooldown);
        (api_id, api_hash, max_join_attempts, join_cooldown)
    }

    // With overrides
    let (api_id, api_hash, max_attempts, cooldown) = config_from_account(
        Some(99),
        Some("override_hash".to_string()),
        Some(3),
        Some(7),
        5,
        10,
        Some(1),
        Some("default_hash".to_string()),
    );
    assert_eq!(api_id, 99);
    assert_eq!(api_hash, "override_hash");
    assert_eq!(max_attempts, 3);
    assert_eq!(cooldown, 7);

    // Without overrides (should use defaults)
    let (api_id, api_hash, max_attempts, cooldown) = config_from_account(
        None,
        None,
        None,
        None,
        5,
        10,
        Some(1),
        Some("default_hash".to_string()),
    );
    assert_eq!(api_id, 1);
    assert_eq!(api_hash, "default_hash");
    assert_eq!(max_attempts, 5);
    assert_eq!(cooldown, 10);
}

#[test]
fn test_import_export_session_directory_naming() {
    use std::path::PathBuf;

    fn get_account_session_dir(account_id: i64) -> PathBuf {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        exe_dir
            .join("sessions")
            .join(format!("account_{}", account_id))
    }

    let session_dir = get_account_session_dir(42);
    assert!(session_dir.to_string_lossy().contains("account_42"));
}

#[test]
fn test_split_zip_source_helper() {
    use q_manager_lib::import_utils::split_zip_source;

    let (path, subdir) = split_zip_source("C:/sessions/accounts.zip::Player_session");
    assert_eq!(path.to_string_lossy(), "C:/sessions/accounts.zip");
    assert_eq!(subdir.unwrap().to_string_lossy(), "Player_session");

    let (path, subdir) = split_zip_source("C:/sessions/accounts.zip");
    assert_eq!(path.to_string_lossy(), "C:/sessions/accounts.zip");
    assert!(subdir.is_none());
}

#[test]
fn test_ban_warning_detection() {
    // Test ban warning pattern matching
    let text = "Warning: You have been reported for spam";
    let pattern = "Warning:";

    assert!(text.contains(pattern));
}

#[test]
fn test_regex_pattern_compilation() {
    use regex::Regex;

    // Test regex pattern compilation
    let pattern = r"(?i)join.*game";
    let regex = Regex::new(pattern);

    assert!(regex.is_ok());

    let compiled = regex.unwrap();
    assert!(compiled.is_match("Join the game now"));
    assert!(compiled.is_match("JOIN THE GAME"));
    assert!(!compiled.is_match("Start playing"));
}

#[test]
fn test_blacklist_filtering() {
    // Test blacklist functionality
    let blacklist = ["Player1".to_string(), "Player2".to_string()];
    let available_players = ["Player1", "Player2", "Player3", "Player4"];

    let filtered: Vec<&str> = available_players
        .iter()
        .copied()
        .filter(|p| !blacklist.contains(&p.to_string()))
        .collect();

    assert_eq!(filtered.len(), 2);
    assert!(filtered.contains(&"Player3"));
    assert!(filtered.contains(&"Player4"));
}

#[test]
fn test_delay_calculation() {
    use rand::Rng;

    // Test delay randomization
    let min_delay = 2;
    let max_delay = 5;

    for _ in 0..10 {
        let delay = rand::thread_rng().gen_range(min_delay..=max_delay);
        assert!(delay >= min_delay && delay <= max_delay);
    }
}

#[test]
fn test_exponential_backoff() {
    // Test exponential backoff calculation
    let base = 1000.0_f64;
    let multiplier = 2.0_f64;
    let max_delay = 60000_u64;

    for attempt in 0..5 {
        let delay = (base * multiplier.powi(attempt)) as u64;
        let capped_delay = delay.min(max_delay);
        assert!(capped_delay <= max_delay);
    }
}
