//! Application constants for Q Manager
//!
//! Centralizes all magic numbers and configuration defaults.

// ============================================================================
// Telethon Configuration
// ============================================================================

/// Telethon receive timeout in seconds (for polling updates)
pub const TELETHON_RECEIVE_TIMEOUT: f64 = 0.2;

/// Telethon authorization wait timeout in seconds
pub const TELETHON_AUTH_TIMEOUT_SECONDS: u32 = 10;

/// Telethon initialization wait timeout in seconds (for import validation)
pub const TELETHON_INIT_TIMEOUT_SECONDS: u32 = 30;

/// Telethon request timeout in milliseconds
pub const TELETHON_REQUEST_TIMEOUT_MS: u64 = 15000;

// ============================================================================
// Worker Configuration
// ============================================================================

/// Throttle interval for updating last_seen timestamp (in seconds)
pub const LAST_SEEN_THROTTLE_SECONDS: u64 = 30;

/// Worker idle backoff base delay (milliseconds)
pub const WORKER_IDLE_BACKOFF_BASE_MS: u64 = 10;

/// Worker idle backoff max delay (milliseconds)
pub const WORKER_IDLE_BACKOFF_MAX_MS: u64 = 50;

/// Number of idle cycles before increasing backoff
pub const WORKER_IDLE_CYCLES_THRESHOLD: u32 = 10;

/// Worker shutdown timeout in seconds
pub const WORKER_SHUTDOWN_TIMEOUT_SECONDS: u64 = 5;

// ============================================================================
// Telethon Reconnection Configuration
// ============================================================================

/// Maximum reconnection attempts before giving up
pub const TELETHON_MAX_RECONNECT_ATTEMPTS: u32 = 5;

/// Initial reconnection delay in milliseconds
pub const TELETHON_RECONNECT_DELAY_BASE_MS: u64 = 1000;

/// Maximum reconnection delay in milliseconds (with exponential backoff)
pub const TELETHON_RECONNECT_DELAY_MAX_MS: u64 = 30000;

/// Backoff multiplier for reconnection delays
pub const TELETHON_RECONNECT_BACKOFF_MULTIPLIER: f64 = 2.0;

/// Delay before attempting to restart after fatal error (milliseconds)
pub const TELETHON_FATAL_ERROR_DELAY_MS: u64 = 5000;

// ============================================================================
// Detection Pipeline
// ============================================================================

/// Maximum size of regex cache (LRU eviction is automatic)
pub const REGEX_CACHE_MAX_SIZE: usize = 500;

// ============================================================================
// Join Rules Defaults
// ============================================================================

/// Default maximum join attempts
pub const DEFAULT_JOIN_MAX_ATTEMPTS: i32 = 5;

/// Default join cooldown in seconds
pub const DEFAULT_JOIN_COOLDOWN_SECONDS: i32 = 5;

// ============================================================================
// Delay Defaults
// ============================================================================

/// Default minimum action delay in seconds
pub const DEFAULT_DELAY_MIN_SECONDS: i32 = 2;

/// Default maximum action delay in seconds
pub const DEFAULT_DELAY_MAX_SECONDS: i32 = 8;

// ============================================================================
// Validation Limits
// ============================================================================

/// Maximum pattern length
pub const MAX_PATTERN_LENGTH: usize = 1000;

/// Maximum account name length
pub const MAX_ACCOUNT_NAME_LENGTH: usize = 100;

/// Maximum action name length
pub const MAX_ACTION_NAME_LENGTH: usize = 100;

/// Maximum display name length
pub const MAX_DISPLAY_NAME_LENGTH: usize = 200;

/// Maximum phone number length
pub const MAX_PHONE_LENGTH: usize = 20;

/// Maximum target list size per action
pub const MAX_TARGET_LIST_SIZE: usize = 100;

/// Maximum blacklist size per account per action
pub const MAX_BLACKLIST_SIZE: usize = 100;

/// Maximum target pairs per account per action
pub const MAX_TARGET_PAIRS: usize = 50;

/// Minimum delay value in seconds
pub const MIN_DELAY_SECONDS: i32 = 0;

/// Maximum delay value in seconds
pub const MAX_DELAY_SECONDS: i32 = 3600;

/// Maximum priority value
pub const MAX_PRIORITY: i32 = 10000;

/// Minimum priority value
pub const MIN_PRIORITY: i32 = -10000;
