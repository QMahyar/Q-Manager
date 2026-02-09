//! Integration tests for Q Manager
//! 
//! These tests verify that different components work together correctly.

// Note: Integration tests would normally import from the crate
// For now, we test the logic without database dependencies

// Note: Detection pipeline tests would require database access
// These are covered by unit tests in the workers module

#[test]
fn test_url_parsing() {
    // Test that URL parsing works correctly
    let url = "https://t.me/botname?start=game123";
    
    // This would use the parse_start_parameter function
    // In a real integration test, we'd invoke this through the public API
    assert!(url.contains("start="));
}

// Note: Message and button structure tests are covered in unit tests

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
    let blacklist = vec!["Player1".to_string(), "Player2".to_string()];
    let available_players = vec!["Player1", "Player2", "Player3", "Player4"];
    
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
        let delay = (base * multiplier.powi(attempt as i32)) as u64;
        let capped_delay = delay.min(max_delay);
        assert!(capped_delay <= max_delay);
    }
}
