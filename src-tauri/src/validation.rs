//! Input validation for Q Manager
//!
//! Provides validation functions for user inputs to prevent invalid data
//! from being stored in the database.

use crate::constants::*;
use regex::Regex;

/// Validation error type
#[derive(Debug, Clone)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

impl std::error::Error for ValidationError {}

/// Result type for validation
pub type ValidationResult<T> = Result<T, ValidationError>;

// ============================================================================
// Pattern Validation
// ============================================================================

/// Validate a regex pattern string
pub fn validate_regex_pattern(pattern: &str) -> ValidationResult<()> {
    if pattern.is_empty() {
        return Err(ValidationError {
            field: "pattern".to_string(),
            message: "Pattern cannot be empty".to_string(),
        });
    }

    if pattern.len() > MAX_PATTERN_LENGTH {
        return Err(ValidationError {
            field: "pattern".to_string(),
            message: format!(
                "Pattern exceeds maximum length of {} characters",
                MAX_PATTERN_LENGTH
            ),
        });
    }

    // Try to compile the regex to validate syntax
    if let Err(e) = Regex::new(pattern) {
        return Err(ValidationError {
            field: "pattern".to_string(),
            message: format!("Invalid regex syntax: {}", e),
        });
    }

    Ok(())
}

/// Validate a pattern (regex or substring)
pub fn validate_pattern(pattern: &str, is_regex: bool) -> ValidationResult<()> {
    if pattern.is_empty() {
        return Err(ValidationError {
            field: "pattern".to_string(),
            message: "Pattern cannot be empty".to_string(),
        });
    }

    if pattern.len() > MAX_PATTERN_LENGTH {
        return Err(ValidationError {
            field: "pattern".to_string(),
            message: format!(
                "Pattern exceeds maximum length of {} characters",
                MAX_PATTERN_LENGTH
            ),
        });
    }

    if is_regex {
        if let Err(e) = Regex::new(pattern) {
            return Err(ValidationError {
                field: "pattern".to_string(),
                message: format!("Invalid regex syntax: {}", e),
            });
        }
    }

    Ok(())
}

// ============================================================================
// Delay Validation
// ============================================================================

/// Validate delay values (min/max seconds)
pub fn validate_delay(min_seconds: i32, max_seconds: i32) -> ValidationResult<()> {
    if min_seconds < MIN_DELAY_SECONDS {
        return Err(ValidationError {
            field: "min_seconds".to_string(),
            message: format!(
                "Minimum delay cannot be less than {} seconds",
                MIN_DELAY_SECONDS
            ),
        });
    }

    if max_seconds < MIN_DELAY_SECONDS {
        return Err(ValidationError {
            field: "max_seconds".to_string(),
            message: format!(
                "Maximum delay cannot be less than {} seconds",
                MIN_DELAY_SECONDS
            ),
        });
    }

    if min_seconds > MAX_DELAY_SECONDS {
        return Err(ValidationError {
            field: "min_seconds".to_string(),
            message: format!("Minimum delay cannot exceed {} seconds", MAX_DELAY_SECONDS),
        });
    }

    if max_seconds > MAX_DELAY_SECONDS {
        return Err(ValidationError {
            field: "max_seconds".to_string(),
            message: format!("Maximum delay cannot exceed {} seconds", MAX_DELAY_SECONDS),
        });
    }

    if min_seconds > max_seconds {
        return Err(ValidationError {
            field: "delay".to_string(),
            message: "Minimum delay cannot be greater than maximum delay".to_string(),
        });
    }

    Ok(())
}

// ============================================================================
// Priority Validation
// ============================================================================

/// Validate priority value
pub fn validate_priority(priority: i32) -> ValidationResult<()> {
    if priority < MIN_PRIORITY {
        return Err(ValidationError {
            field: "priority".to_string(),
            message: format!("Priority cannot be less than {}", MIN_PRIORITY),
        });
    }

    if priority > MAX_PRIORITY {
        return Err(ValidationError {
            field: "priority".to_string(),
            message: format!("Priority cannot exceed {}", MAX_PRIORITY),
        });
    }

    Ok(())
}

// ============================================================================
// Name Validation
// ============================================================================

/// Validate account name
pub fn validate_account_name(name: &str) -> ValidationResult<()> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(ValidationError {
            field: "account_name".to_string(),
            message: "Account name cannot be empty".to_string(),
        });
    }

    if trimmed.len() > MAX_ACCOUNT_NAME_LENGTH {
        return Err(ValidationError {
            field: "account_name".to_string(),
            message: format!(
                "Account name exceeds maximum length of {} characters",
                MAX_ACCOUNT_NAME_LENGTH
            ),
        });
    }

    Ok(())
}

/// Validate action name (internal identifier)
pub fn validate_action_name(name: &str) -> ValidationResult<()> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(ValidationError {
            field: "name".to_string(),
            message: "Action name cannot be empty".to_string(),
        });
    }

    if trimmed.len() > MAX_ACTION_NAME_LENGTH {
        return Err(ValidationError {
            field: "name".to_string(),
            message: format!(
                "Action name exceeds maximum length of {} characters",
                MAX_ACTION_NAME_LENGTH
            ),
        });
    }

    // Action names should be lowercase alphanumeric with underscores
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(ValidationError {
            field: "name".to_string(),
            message: "Action name must contain only lowercase letters, numbers, and underscores"
                .to_string(),
        });
    }

    Ok(())
}

/// Validate display name
pub fn validate_display_name(name: &str) -> ValidationResult<()> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(ValidationError {
            field: "display_name".to_string(),
            message: "Display name cannot be empty".to_string(),
        });
    }

    if trimmed.len() > MAX_DISPLAY_NAME_LENGTH {
        return Err(ValidationError {
            field: "display_name".to_string(),
            message: format!(
                "Display name exceeds maximum length of {} characters",
                MAX_DISPLAY_NAME_LENGTH
            ),
        });
    }

    Ok(())
}

// ============================================================================
// Phone Number Validation
// ============================================================================

/// Validate phone number format
pub fn validate_phone_number(phone: &str) -> ValidationResult<()> {
    let trimmed = phone.trim();

    if trimmed.is_empty() {
        return Err(ValidationError {
            field: "phone".to_string(),
            message: "Phone number cannot be empty".to_string(),
        });
    }

    if trimmed.len() > MAX_PHONE_LENGTH {
        return Err(ValidationError {
            field: "phone".to_string(),
            message: format!(
                "Phone number exceeds maximum length of {} characters",
                MAX_PHONE_LENGTH
            ),
        });
    }

    // Phone should contain only digits, spaces, dashes, plus sign, and parentheses
    let valid_chars = trimmed
        .chars()
        .all(|c| c.is_ascii_digit() || c == '+' || c == '-' || c == ' ' || c == '(' || c == ')');

    if !valid_chars {
        return Err(ValidationError {
            field: "phone".to_string(),
            message: "Phone number contains invalid characters".to_string(),
        });
    }

    // Must contain at least some digits
    let digit_count = trimmed.chars().filter(|c| c.is_ascii_digit()).count();
    if digit_count < 7 {
        return Err(ValidationError {
            field: "phone".to_string(),
            message: "Phone number must contain at least 7 digits".to_string(),
        });
    }

    Ok(())
}

// ============================================================================
// API Credentials Validation
// ============================================================================

/// Validate Telegram API ID
pub fn validate_api_id(api_id: i64) -> ValidationResult<()> {
    if api_id <= 0 {
        return Err(ValidationError {
            field: "api_id".to_string(),
            message: "API ID must be a positive number".to_string(),
        });
    }

    Ok(())
}

/// Validate Telegram API Hash
pub fn validate_api_hash(api_hash: &str) -> ValidationResult<()> {
    let trimmed = api_hash.trim();

    if trimmed.is_empty() {
        return Err(ValidationError {
            field: "api_hash".to_string(),
            message: "API Hash cannot be empty".to_string(),
        });
    }

    // API hash is typically 32 hex characters
    if trimmed.len() != 32 {
        return Err(ValidationError {
            field: "api_hash".to_string(),
            message: "API Hash must be exactly 32 characters".to_string(),
        });
    }

    if !trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ValidationError {
            field: "api_hash".to_string(),
            message: "API Hash must contain only hexadecimal characters".to_string(),
        });
    }

    Ok(())
}

// ============================================================================
// Join Rules Validation
// ============================================================================

/// Validate join rules
pub fn validate_join_rules(max_attempts: i32, cooldown_seconds: i32) -> ValidationResult<()> {
    if max_attempts < 1 {
        return Err(ValidationError {
            field: "max_attempts".to_string(),
            message: "Maximum join attempts must be at least 1".to_string(),
        });
    }

    if max_attempts > 100 {
        return Err(ValidationError {
            field: "max_attempts".to_string(),
            message: "Maximum join attempts cannot exceed 100".to_string(),
        });
    }

    if cooldown_seconds < 0 {
        return Err(ValidationError {
            field: "cooldown_seconds".to_string(),
            message: "Cooldown cannot be negative".to_string(),
        });
    }

    if cooldown_seconds > 300 {
        return Err(ValidationError {
            field: "cooldown_seconds".to_string(),
            message: "Cooldown cannot exceed 300 seconds".to_string(),
        });
    }

    Ok(())
}

// ============================================================================
// Button Type Validation
// ============================================================================

/// Validate button type string
pub fn validate_button_type(button_type: &str) -> ValidationResult<()> {
    match button_type {
        "player_list" | "yes_no" | "fixed" => Ok(()),
        _ => Err(ValidationError {
            field: "button_type".to_string(),
            message: format!(
                "Invalid button type '{}'. Must be one of: player_list, yes_no, fixed",
                button_type
            ),
        }),
    }
}

// ============================================================================
// Target Rule JSON Validation
// ============================================================================

/// Validate target rule JSON structure
pub fn validate_target_rule_json(json: &str) -> ValidationResult<()> {
    if json.is_empty() {
        return Ok(()); // Empty is valid (uses defaults)
    }

    let parsed: serde_json::Value = serde_json::from_str(json).map_err(|e| ValidationError {
        field: "rule_json".to_string(),
        message: format!("Invalid JSON: {}", e),
    })?;

    // Check if it's an object
    if !parsed.is_object() {
        return Err(ValidationError {
            field: "rule_json".to_string(),
            message: "Target rule must be a JSON object".to_string(),
        });
    }

    // Validate type field
    if let Some(rule_type) = parsed.get("type") {
        if let Some(rule_type) = rule_type.as_str() {
            match rule_type {
                "player_list" | "yes_no" | "fixed" | "names" | "button_text" | "random" => {}
                _ => {
                    return Err(ValidationError {
                        field: "type".to_string(),
                        message: "Target rule type must be one of: player_list, yes_no, fixed, names, button_text, random".to_string(),
                    });
                }
            }
        } else {
            return Err(ValidationError {
                field: "type".to_string(),
                message: "Target rule type must be a string".to_string(),
            });
        }
    }

    // Validate random fallback fields if present
    if let Some(random_fallback) = parsed.get("random_fallback") {
        if !random_fallback.is_boolean() {
            return Err(ValidationError {
                field: "random_fallback".to_string(),
                message: "random_fallback must be a boolean".to_string(),
            });
        }
    }
    if let Some(random_fallback_enabled) = parsed.get("random_fallback_enabled") {
        if !random_fallback_enabled.is_boolean() {
            return Err(ValidationError {
                field: "random_fallback_enabled".to_string(),
                message: "random_fallback_enabled must be a boolean".to_string(),
            });
        }
    }

    // Validate targets array if present
    if let Some(targets) = parsed.get("targets") {
        if let Some(arr) = targets.as_array() {
            if arr.len() > MAX_TARGET_LIST_SIZE {
                return Err(ValidationError {
                    field: "targets".to_string(),
                    message: format!(
                        "Target list exceeds maximum size of {}",
                        MAX_TARGET_LIST_SIZE
                    ),
                });
            }
            for (index, item) in arr.iter().enumerate() {
                if let Some(target) = item.as_str() {
                    if target.trim().is_empty() {
                        return Err(ValidationError {
                            field: "targets".to_string(),
                            message: format!("Target at index {} cannot be empty", index),
                        });
                    }
                } else {
                    return Err(ValidationError {
                        field: "targets".to_string(),
                        message: format!("Target at index {} must be a string", index),
                    });
                }
            }
        } else {
            return Err(ValidationError {
                field: "targets".to_string(),
                message: "Targets must be a JSON array".to_string(),
            });
        }
    }

    Ok(())
}

// ============================================================================
// Bot ID Validation
// ============================================================================

/// Validate bot user ID (optional field - can be None or 0 to indicate not set)
pub fn validate_bot_user_id(user_id: Option<i64>) -> ValidationResult<()> {
    match user_id {
        None => Ok(()),
        Some(0) => Ok(()), // 0 means not set
        Some(id) if id > 0 => Ok(()),
        Some(_) => Err(ValidationError {
            field: "bot_user_id".to_string(),
            message: "Bot User ID must be a positive number".to_string(),
        }),
    }
}

/// Validate bot username (optional, for display purposes)
pub fn validate_bot_username(username: Option<&str>) -> ValidationResult<()> {
    match username {
        None => Ok(()),
        Some("") => Ok(()),
        Some(s) => {
            if s.len() > 64 {
                return Err(ValidationError {
                    field: "bot_username".to_string(),
                    message: "Bot username exceeds maximum length of 64 characters".to_string(),
                });
            }
            // Telegram usernames: alphanumeric and underscores, 5-32 chars, start with letter
            // But we're lenient here since it's just for display
            Ok(())
        }
    }
}

// ============================================================================
// Group/Chat ID Validation
// ============================================================================

/// Validate group/chat ID (can be negative for supergroups/channels)
pub fn validate_group_id(group_id: Option<i64>) -> ValidationResult<()> {
    match group_id {
        None => Ok(()),
        Some(0) => Err(ValidationError {
            field: "group_id".to_string(),
            message: "Group ID cannot be 0".to_string(),
        }),
        Some(_) => Ok(()), // Both positive and negative IDs are valid
    }
}

/// Validate group slot number
pub fn validate_group_slot(slot: i32) -> ValidationResult<()> {
    if !(1..=2).contains(&slot) {
        return Err(ValidationError {
            field: "group_slot".to_string(),
            message: "Group slot must be 1 or 2".to_string(),
        });
    }
    Ok(())
}

// ============================================================================
// Blacklist Validation
// ============================================================================

/// Validate blacklist JSON
pub fn validate_blacklist_json(json: &str) -> ValidationResult<()> {
    if json.is_empty() {
        return Ok(()); // Empty is valid (no blacklist)
    }

    let parsed: serde_json::Value = serde_json::from_str(json).map_err(|e| ValidationError {
        field: "blacklist_json".to_string(),
        message: format!("Invalid JSON: {}", e),
    })?;

    // Should be an array of strings
    if let Some(arr) = parsed.as_array() {
        if arr.len() > MAX_BLACKLIST_SIZE {
            return Err(ValidationError {
                field: "blacklist_json".to_string(),
                message: format!("Blacklist exceeds maximum size of {}", MAX_BLACKLIST_SIZE),
            });
        }
        for item in arr {
            if !item.is_string() {
                return Err(ValidationError {
                    field: "blacklist_json".to_string(),
                    message: "Blacklist items must be strings".to_string(),
                });
            }
        }
        Ok(())
    } else {
        Err(ValidationError {
            field: "blacklist_json".to_string(),
            message: "Blacklist must be a JSON array".to_string(),
        })
    }
}

// ============================================================================
// Target Pairs Validation
// ============================================================================

/// Validate target pairs JSON (for two-step actions like Cupid)
pub fn validate_target_pairs_json(json: &str) -> ValidationResult<()> {
    if json.is_empty() {
        return Ok(()); // Empty is valid (no pairs)
    }

    let parsed: serde_json::Value = serde_json::from_str(json).map_err(|e| ValidationError {
        field: "pairs_json".to_string(),
        message: format!("Invalid JSON: {}", e),
    })?;

    // Should be an array of [A, B] pairs
    if let Some(arr) = parsed.as_array() {
        if arr.len() > MAX_TARGET_PAIRS {
            return Err(ValidationError {
                field: "pairs_json".to_string(),
                message: format!("Target pairs exceed maximum count of {}", MAX_TARGET_PAIRS),
            });
        }
        for (i, item) in arr.iter().enumerate() {
            if let Some(pair) = item.as_array() {
                if pair.len() != 2 {
                    return Err(ValidationError {
                        field: "pairs_json".to_string(),
                        message: format!("Pair at index {} must have exactly 2 elements", i),
                    });
                }
                if !pair[0].is_string() || !pair[1].is_string() {
                    return Err(ValidationError {
                        field: "pairs_json".to_string(),
                        message: format!("Pair elements at index {} must be strings", i),
                    });
                }
            } else {
                return Err(ValidationError {
                    field: "pairs_json".to_string(),
                    message: format!("Item at index {} must be an array pair", i),
                });
            }
        }
        Ok(())
    } else {
        Err(ValidationError {
            field: "pairs_json".to_string(),
            message: "Target pairs must be a JSON array".to_string(),
        })
    }
}

// ============================================================================
// Ban Pattern Validation
// ============================================================================

/// Validate ban warning patterns JSON
pub fn validate_ban_patterns_json(json: &str) -> ValidationResult<()> {
    if json.is_empty() {
        return Ok(()); // Empty is valid
    }

    let parsed: serde_json::Value = serde_json::from_str(json).map_err(|e| ValidationError {
        field: "ban_patterns_json".to_string(),
        message: format!("Invalid JSON: {}", e),
    })?;

    // Should be an array of pattern objects or strings
    if let Some(arr) = parsed.as_array() {
        if arr.len() > 50 {
            return Err(ValidationError {
                field: "ban_patterns_json".to_string(),
                message: "Ban patterns exceed maximum count of 50".to_string(),
            });
        }
        for (i, item) in arr.iter().enumerate() {
            // Can be a string (simple pattern) or an object with pattern and is_regex
            if item.is_string() {
                let pattern = item.as_str().unwrap();
                if pattern.is_empty() {
                    return Err(ValidationError {
                        field: "ban_patterns_json".to_string(),
                        message: format!("Pattern at index {} cannot be empty", i),
                    });
                }
            } else if let Some(obj) = item.as_object() {
                if let Some(pattern) = obj.get("pattern").and_then(|p| p.as_str()) {
                    if pattern.is_empty() {
                        return Err(ValidationError {
                            field: "ban_patterns_json".to_string(),
                            message: format!("Pattern at index {} cannot be empty", i),
                        });
                    }
                    // If is_regex is true, validate the regex
                    if obj
                        .get("is_regex")
                        .and_then(|r| r.as_bool())
                        .unwrap_or(false)
                    {
                        if let Err(e) = Regex::new(pattern) {
                            return Err(ValidationError {
                                field: "ban_patterns_json".to_string(),
                                message: format!("Invalid regex at index {}: {}", i, e),
                            });
                        }
                    }
                } else {
                    return Err(ValidationError {
                        field: "ban_patterns_json".to_string(),
                        message: format!(
                            "Object at index {} must have a 'pattern' string field",
                            i
                        ),
                    });
                }
            } else {
                return Err(ValidationError {
                    field: "ban_patterns_json".to_string(),
                    message: format!("Item at index {} must be a string or object", i),
                });
            }
        }
        Ok(())
    } else {
        Err(ValidationError {
            field: "ban_patterns_json".to_string(),
            message: "Ban patterns must be a JSON array".to_string(),
        })
    }
}

#[cfg(all(test, not(windows)))]
mod tests {
    use super::*;

    #[test]
    fn test_validate_delay() {
        assert!(validate_delay(2, 8).is_ok());
        assert!(validate_delay(0, 0).is_ok());
        assert!(validate_delay(5, 5).is_ok());
        assert!(validate_delay(8, 2).is_err()); // min > max
        assert!(validate_delay(-1, 5).is_err()); // negative
        assert!(validate_delay(0, 4000).is_err()); // exceeds max
    }

    #[test]
    fn test_validate_pattern() {
        assert!(validate_pattern("hello", false).is_ok());
        assert!(validate_pattern("hello.*world", true).is_ok());
        assert!(validate_pattern("", false).is_err());
        assert!(validate_pattern("[invalid", true).is_err()); // bad regex
    }

    #[test]
    fn test_validate_phone_number() {
        assert!(validate_phone_number("+1234567890").is_ok());
        assert!(validate_phone_number("(123) 456-7890").is_ok());
        assert!(validate_phone_number("123").is_err()); // too short
        assert!(validate_phone_number("abc123def").is_err()); // invalid chars
    }

    #[test]
    fn test_validate_action_name() {
        assert!(validate_action_name("vote").is_ok());
        assert!(validate_action_name("kill_target").is_ok());
        assert!(validate_action_name("").is_err());
        assert!(validate_action_name("Vote").is_err()); // uppercase
        assert!(validate_action_name("vote target").is_err()); // space
    }

    #[test]
    fn test_validate_button_type() {
        assert!(validate_button_type("player_list").is_ok());
        assert!(validate_button_type("yes_no").is_ok());
        assert!(validate_button_type("fixed").is_ok());
        assert!(validate_button_type("invalid").is_err());
    }

    #[test]
    fn test_validate_bot_user_id() {
        assert!(validate_bot_user_id(None).is_ok());
        assert!(validate_bot_user_id(Some(0)).is_ok());
        assert!(validate_bot_user_id(Some(123456789)).is_ok());
        assert!(validate_bot_user_id(Some(-1)).is_err());
    }

    #[test]
    fn test_validate_group_id() {
        assert!(validate_group_id(None).is_ok());
        assert!(validate_group_id(Some(123456789)).is_ok());
        assert!(validate_group_id(Some(-1001234567890)).is_ok()); // supergroup
        assert!(validate_group_id(Some(0)).is_err());
    }

    #[test]
    fn test_validate_group_slot() {
        assert!(validate_group_slot(1).is_ok());
        assert!(validate_group_slot(2).is_ok());
        assert!(validate_group_slot(0).is_err());
        assert!(validate_group_slot(3).is_err());
    }

    #[test]
    fn test_validate_blacklist_json() {
        assert!(validate_blacklist_json("").is_ok());
        assert!(validate_blacklist_json(r#"["player1", "player2"]"#).is_ok());
        assert!(validate_blacklist_json(r#"[1, 2, 3]"#).is_err()); // not strings
        assert!(validate_blacklist_json("not json").is_err());
    }

    #[test]
    fn test_validate_target_pairs_json() {
        assert!(validate_target_pairs_json("").is_ok());
        assert!(validate_target_pairs_json(r#"[["Alice", "Bob"], ["Carol", "Dave"]]"#).is_ok());
        assert!(validate_target_pairs_json(r#"[["Alice"]]"#).is_err()); // not a pair
        assert!(validate_target_pairs_json(r#"[[1, 2]]"#).is_err()); // not strings
    }
}
