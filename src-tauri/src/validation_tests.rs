//! Comprehensive tests for validation logic

#[cfg(test)]
mod tests {
    use crate::validation::*;

    #[test]
    fn test_validate_account_name_valid() {
        assert!(validate_account_name("ValidName").is_ok());
        assert!(validate_account_name("Account_123").is_ok());
        assert!(validate_account_name("Test-Account").is_ok());
    }

    #[test]
    fn test_validate_account_name_empty() {
        let result = validate_account_name("");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_account_name_too_long() {
        let long_name = "a".repeat(101);
        let result = validate_account_name(&long_name);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_phone_number_valid() {
        assert!(validate_phone_number("+1234567890").is_ok());
        assert!(validate_phone_number("+441234567890").is_ok());
        assert!(validate_phone_number("1234567890").is_ok());
    }

    #[test]
    fn test_validate_phone_number_invalid() {
        assert!(validate_phone_number("+123").is_err()); // Too short
        assert!(validate_phone_number("+abc").is_err()); // Invalid characters
    }

    #[test]
    fn test_validate_api_id_valid() {
        assert!(validate_api_id(12345).is_ok());
        assert!(validate_api_id(999999).is_ok());
    }

    #[test]
    fn test_validate_api_id_invalid() {
        assert!(validate_api_id(0).is_err());
        assert!(validate_api_id(-1).is_err());
    }

    #[test]
    fn test_validate_api_hash_valid() {
        assert!(validate_api_hash("0123456789abcdef0123456789abcdef").is_ok());
        assert!(validate_api_hash(&"a".repeat(32)).is_ok());
    }

    #[test]
    fn test_validate_api_hash_invalid() {
        assert!(validate_api_hash("").is_err());
        assert!(validate_api_hash("short").is_err());
        assert!(validate_api_hash("has spaces").is_err());
    }

    #[test]
    fn test_validate_pattern_valid() {
        assert!(validate_pattern("Join the game", false).is_ok());
        assert!(validate_pattern(r"game.*started", true).is_ok());
    }

    #[test]
    fn test_validate_pattern_empty() {
        let result = validate_pattern("", false);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_pattern_invalid_regex() {
        let result = validate_pattern("[invalid(regex", true);
        assert!(result.is_err());
        // Just verify it's an error - don't check message content
    }

    #[test]
    fn test_sanitization() {
        // Test that sanitization doesn't break valid inputs
        let name = "Valid_Name-123";
        assert!(validate_account_name(name).is_ok());

        let phone = "+1234567890";
        assert!(validate_phone_number(phone).is_ok());
    }

    #[test]
    fn test_validate_delay() {
        assert!(validate_delay(2, 5).is_ok());
        assert!(validate_delay(0, 10).is_ok());
    }

    #[test]
    fn test_validate_delay_invalid() {
        assert!(validate_delay(-1, 5).is_err()); // Negative min
        assert!(validate_delay(10, 5).is_err()); // Min > Max
    }

    #[test]
    fn test_validate_button_type() {
        assert!(validate_button_type("player_list").is_ok());
        assert!(validate_button_type("yes_no").is_ok());
        assert!(validate_button_type("fixed").is_ok());
    }

    #[test]
    fn test_validate_button_type_invalid() {
        assert!(validate_button_type("invalid_type").is_err());
    }
}
