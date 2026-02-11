//! IPC command and event names shared across the backend.

// Commands
#![allow(dead_code)]

pub const CMD_SETTINGS_GET: &str = "settings_get";
pub const CMD_SETTINGS_UPDATE: &str = "settings_update";
pub const CMD_ACCOUNTS_LIST: &str = "accounts_list";
pub const CMD_ACCOUNT_CREATE: &str = "account_create";
pub const CMD_ACCOUNT_DELETE: &str = "account_delete";
pub const CMD_ACCOUNT_START: &str = "account_start";
pub const CMD_ACCOUNT_STOP: &str = "account_stop";
pub const CMD_ACCOUNTS_START_ALL: &str = "accounts_start_all";
pub const CMD_ACCOUNTS_STOP_ALL: &str = "accounts_stop_all";
pub const CMD_ACCOUNTS_START_SELECTED: &str = "accounts_start_selected";
pub const CMD_ACCOUNTS_STOP_SELECTED: &str = "accounts_stop_selected";
pub const CMD_PHASES_LIST: &str = "phases_list";
pub const CMD_PHASE_PATTERNS_LIST: &str = "phase_patterns_list";
pub const CMD_PHASE_PATTERN_CREATE: &str = "phase_pattern_create";
pub const CMD_PHASE_PATTERN_DELETE: &str = "phase_pattern_delete";
pub const CMD_PHASE_PATTERN_UPDATE: &str = "phase_pattern_update";
pub const CMD_PHASE_UPDATE_PRIORITY: &str = "phase_update_priority";
pub const CMD_PATTERNS_RELOAD_ALL: &str = "patterns_reload_all";
pub const CMD_PATTERNS_RELOAD: &str = "patterns_reload";
pub const CMD_ACTIONS_LIST: &str = "actions_list";
pub const CMD_ACTION_CREATE: &str = "action_create";
pub const CMD_ACTION_DELETE: &str = "action_delete";
pub const CMD_ACTION_UPDATE: &str = "action_update";
pub const CMD_ACTION_PATTERNS_LIST: &str = "action_patterns_list";
pub const CMD_ACTION_PATTERN_CREATE: &str = "action_pattern_create";
pub const CMD_ACTION_PATTERN_DELETE: &str = "action_pattern_delete";
pub const CMD_ACTION_PATTERN_UPDATE: &str = "action_pattern_update";
pub const CMD_PHASE_PATTERNS_EXPORT: &str = "phase_patterns_export";
pub const CMD_PHASE_PATTERNS_IMPORT: &str = "phase_patterns_import";
pub const CMD_ACTION_PATTERNS_EXPORT: &str = "action_patterns_export";
pub const CMD_ACTION_PATTERNS_IMPORT: &str = "action_patterns_import";
pub const CMD_TARGET_DEFAULTS_GET: &str = "target_defaults_get";
pub const CMD_TARGET_DEFAULT_SET: &str = "target_default_set";
pub const CMD_TARGET_OVERRIDE_GET: &str = "target_override_get";
pub const CMD_TARGET_OVERRIDE_SET: &str = "target_override_set";
pub const CMD_TARGET_OVERRIDE_DELETE: &str = "target_override_delete";
pub const CMD_TARGET_OVERRIDES_LIST: &str = "target_overrides_list";
pub const CMD_BLACKLIST_LIST: &str = "blacklist_list";
pub const CMD_BLACKLIST_ADD: &str = "blacklist_add";
pub const CMD_BLACKLIST_REMOVE: &str = "blacklist_remove";
pub const CMD_DELAY_DEFAULT_GET: &str = "delay_default_get";
pub const CMD_DELAY_DEFAULT_SET: &str = "delay_default_set";
// Events
pub const EVENT_ACCOUNT_STATUS: &str = "account-status";
pub const EVENT_PHASE_DETECTED: &str = "phase-detected";
pub const EVENT_ACTION_DETECTED: &str = "action-detected";
pub const EVENT_JOIN_ATTEMPT: &str = "join-attempt";
pub const EVENT_ACCOUNT_LOG: &str = "account-log";
pub const EVENT_REGEX_VALIDATION_ERROR: &str = "regex-validation-error";
pub const EVENT_LOGIN_PROGRESS: &str = "login-progress";
