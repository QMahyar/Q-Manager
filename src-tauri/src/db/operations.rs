//! Database operations for Q Manager
//! CRUD operations for all tables.

use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

// ============================================================================
// Pattern Versions (cache invalidation)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternVersions {
    pub phase_version: i64,
    pub action_version: i64,
}

pub fn get_pattern_versions(conn: &Connection) -> Result<PatternVersions> {
    conn.query_row(
        "SELECT phase_version, action_version FROM pattern_versions WHERE id = 1",
        [],
        |row| {
            Ok(PatternVersions {
                phase_version: row.get(0)?,
                action_version: row.get(1)?,
            })
        },
    )
}

pub fn bump_phase_version(conn: &Connection) -> Result<i64> {
    conn.execute(
        "UPDATE pattern_versions SET phase_version = phase_version + 1, updated_at = datetime('now') WHERE id = 1",
        [],
    )?;
    conn.query_row(
        "SELECT phase_version FROM pattern_versions WHERE id = 1",
        [],
        |row| row.get(0),
    )
}

pub fn bump_action_version(conn: &Connection) -> Result<i64> {
    conn.execute(
        "UPDATE pattern_versions SET action_version = action_version + 1, updated_at = datetime('now') WHERE id = 1",
        [],
    )?;
    conn.query_row(
        "SELECT action_version FROM pattern_versions WHERE id = 1",
        [],
        |row| row.get(0),
    )
}

// ============================================================================
// Settings
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub api_id: Option<i64>,
    pub api_hash: Option<String>,
    pub main_bot_user_id: Option<i64>,
    pub main_bot_username: Option<String>,
    pub beta_bot_user_id: Option<i64>,
    pub beta_bot_username: Option<String>,
    pub join_max_attempts_default: i32,
    pub join_cooldown_seconds_default: i32,
    pub ban_warning_patterns_json: String,
    pub theme_mode: String,
    pub theme_palette: String,
    pub theme_variant: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

pub fn get_settings(conn: &Connection) -> Result<Settings> {
    conn.query_row(
        "SELECT api_id, api_hash, main_bot_user_id, main_bot_username, 
                beta_bot_user_id, beta_bot_username, join_max_attempts_default,
                join_cooldown_seconds_default, ban_warning_patterns_json,
                theme_mode, theme_palette, theme_variant, created_at, updated_at
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                api_id: row.get(0)?,
                api_hash: row.get(1)?,
                main_bot_user_id: row.get(2)?,
                main_bot_username: row.get(3)?,
                beta_bot_user_id: row.get(4)?,
                beta_bot_username: row.get(5)?,
                join_max_attempts_default: row.get(6)?,
                join_cooldown_seconds_default: row.get(7)?,
                ban_warning_patterns_json: row.get(8)?,
                theme_mode: row.get(9)?,
                theme_palette: row.get(10)?,
                theme_variant: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        },
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsUpdate {
    pub api_id: Option<i64>,
    pub api_hash: Option<String>,
    pub main_bot_user_id: Option<i64>,
    pub main_bot_username: Option<String>,
    pub beta_bot_user_id: Option<i64>,
    pub beta_bot_username: Option<String>,
    pub join_max_attempts_default: Option<i32>,
    pub join_cooldown_seconds_default: Option<i32>,
    pub ban_warning_patterns_json: Option<String>,
    pub theme_mode: Option<String>,
    pub theme_palette: Option<String>,
    pub theme_variant: Option<String>,
}

pub fn update_settings(conn: &Connection, update: &SettingsUpdate) -> Result<()> {
    conn.execute(
        "UPDATE settings SET
            api_id = COALESCE(?1, api_id),
            api_hash = COALESCE(?2, api_hash),
            main_bot_user_id = COALESCE(?3, main_bot_user_id),
            main_bot_username = COALESCE(?4, main_bot_username),
            beta_bot_user_id = COALESCE(?5, beta_bot_user_id),
            beta_bot_username = COALESCE(?6, beta_bot_username),
            join_max_attempts_default = COALESCE(?7, join_max_attempts_default),
            join_cooldown_seconds_default = COALESCE(?8, join_cooldown_seconds_default),
            ban_warning_patterns_json = COALESCE(?9, ban_warning_patterns_json),
            theme_mode = COALESCE(?10, theme_mode),
            theme_palette = COALESCE(?11, theme_palette),
            theme_variant = COALESCE(?12, theme_variant),
            updated_at = datetime('now')
         WHERE id = 1",
        params![
            update.api_id,
            update.api_hash,
            update.main_bot_user_id,
            update.main_bot_username,
            update.beta_bot_user_id,
            update.beta_bot_username,
            update.join_max_attempts_default,
            update.join_cooldown_seconds_default,
            update.ban_warning_patterns_json,
            update.theme_mode,
            update.theme_palette,
            update.theme_variant,
        ],
    )?;
    Ok(())
}

// ============================================================================
// Accounts
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: i64,
    pub account_name: String,
    pub telegram_name: Option<String>,
    pub phone: Option<String>,
    pub user_id: Option<i64>,
    pub status: String,
    pub last_seen_at: Option<String>,
    pub api_id_override: Option<i64>,
    pub api_hash_override: Option<String>,
    pub join_max_attempts_override: Option<i32>,
    pub join_cooldown_seconds_override: Option<i32>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

pub fn list_accounts(conn: &Connection) -> Result<Vec<Account>> {
    let mut stmt = conn.prepare(
        "SELECT id, account_name, telegram_name, phone, user_id, status, last_seen_at,
                api_id_override, api_hash_override, join_max_attempts_override,
                join_cooldown_seconds_override, created_at, updated_at
         FROM accounts ORDER BY id",
    )?;

    let accounts = stmt.query_map([], |row| {
        Ok(Account {
            id: row.get(0)?,
            account_name: row.get(1)?,
            telegram_name: row.get(2)?,
            phone: row.get(3)?,
            user_id: row.get(4)?,
            status: row.get(5)?,
            last_seen_at: row.get(6)?,
            api_id_override: row.get(7)?,
            api_hash_override: row.get(8)?,
            join_max_attempts_override: row.get(9)?,
            join_cooldown_seconds_override: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    })?;

    accounts.collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountCreate {
    pub account_name: String,
    pub telegram_name: Option<String>,
    pub phone: Option<String>,
    pub user_id: Option<i64>,
    pub api_id_override: Option<i64>,
    pub api_hash_override: Option<String>,
}

pub fn create_account(conn: &Connection, data: &AccountCreate) -> Result<i64> {
    conn.execute(
        "INSERT INTO accounts (account_name, telegram_name, phone, user_id, 
                               api_id_override, api_hash_override, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
        params![
            data.account_name,
            data.telegram_name,
            data.phone,
            data.user_id,
            data.api_id_override,
            data.api_hash_override,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Check if an account name already exists (case-insensitive)
/// Optimized: EXISTS is faster than COUNT for existence checks
pub fn account_name_exists(conn: &Connection, name: &str) -> Result<bool> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM accounts WHERE account_name = ?1 COLLATE NOCASE)",
        params![name.trim()],
        |row| row.get(0),
    )?;
    Ok(exists)
}

pub fn delete_account(conn: &Connection, account_id: i64) -> Result<()> {
    conn.execute("DELETE FROM accounts WHERE id = ?1", params![account_id])?;
    Ok(())
}

pub fn update_account_status(conn: &Connection, account_id: i64, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE accounts SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![status, account_id],
    )?;
    Ok(())
}

// ============================================================================
// Phases
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Phase {
    pub id: i64,
    pub name: String,
    pub display_name: String,
    pub priority: i32,
}

pub fn list_phases(conn: &Connection) -> Result<Vec<Phase>> {
    let mut stmt =
        conn.prepare("SELECT id, name, display_name, priority FROM phases ORDER BY priority DESC")?;

    let phases = stmt.query_map([], |row| {
        Ok(Phase {
            id: row.get(0)?,
            name: row.get(1)?,
            display_name: row.get(2)?,
            priority: row.get(3)?,
        })
    })?;

    phases.collect()
}

// ============================================================================
// Phase Patterns
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhasePattern {
    pub id: i64,
    pub phase_id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
}

pub fn list_phase_patterns(conn: &Connection, phase_id: i64) -> Result<Vec<PhasePattern>> {
    let mut stmt = conn.prepare(
        "SELECT id, phase_id, pattern, is_regex, enabled, priority 
         FROM phase_patterns WHERE phase_id = ?1 ORDER BY priority DESC",
    )?;

    let patterns = stmt.query_map(params![phase_id], |row| {
        Ok(PhasePattern {
            id: row.get(0)?,
            phase_id: row.get(1)?,
            pattern: row.get(2)?,
            is_regex: row.get::<_, i32>(3)? != 0,
            enabled: row.get::<_, i32>(4)? != 0,
            priority: row.get(5)?,
        })
    })?;

    patterns.collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhasePatternCreate {
    pub phase_id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
}

pub fn create_phase_pattern(conn: &Connection, data: &PhasePatternCreate) -> Result<i64> {
    conn.execute(
        "INSERT INTO phase_patterns (phase_id, pattern, is_regex, enabled, priority)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            data.phase_id,
            data.pattern,
            data.is_regex as i32,
            data.enabled as i32,
            data.priority,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_phase_pattern(conn: &Connection, pattern_id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM phase_patterns WHERE id = ?1",
        params![pattern_id],
    )?;
    Ok(())
}

// ============================================================================
// Actions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub id: i64,
    pub name: String,
    pub button_type: String,
    pub random_fallback_enabled: bool,
    pub is_two_step: bool,
}

pub fn list_actions(conn: &Connection) -> Result<Vec<Action>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, button_type, random_fallback_enabled, is_two_step
         FROM actions ORDER BY name",
    )?;

    let actions = stmt.query_map([], |row| {
        Ok(Action {
            id: row.get(0)?,
            name: row.get(1)?,
            button_type: row.get(2)?,
            random_fallback_enabled: row.get::<_, i32>(3)? != 0,
            is_two_step: row.get::<_, i32>(4)? != 0,
        })
    })?;

    actions.collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionCreate {
    pub name: String,
    pub button_type: String,
    pub random_fallback_enabled: bool,
    pub is_two_step: bool,
}

pub fn create_action(conn: &Connection, data: &ActionCreate) -> Result<i64> {
    conn.execute(
        "INSERT INTO actions (name, button_type, random_fallback_enabled, is_two_step)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            data.name,
            data.button_type,
            data.random_fallback_enabled as i32,
            data.is_two_step as i32,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_action(conn: &Connection, action_id: i64) -> Result<()> {
    conn.execute("DELETE FROM actions WHERE id = ?1", params![action_id])?;
    Ok(())
}

// ============================================================================
// Action Patterns
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionPattern {
    pub id: i64,
    pub action_id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
    pub step: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionPatternCreate {
    pub action_id: i64,
    pub pattern: String,
    pub is_regex: bool,
    pub enabled: bool,
    pub priority: i32,
    pub step: i32,
}

pub fn list_action_patterns(conn: &Connection, action_id: i64) -> Result<Vec<ActionPattern>> {
    let mut stmt = conn.prepare(
        "SELECT id, action_id, pattern, is_regex, enabled, priority, step
         FROM action_patterns WHERE action_id = ?1 ORDER BY priority DESC",
    )?;

    let patterns = stmt.query_map(params![action_id], |row| {
        Ok(ActionPattern {
            id: row.get(0)?,
            action_id: row.get(1)?,
            pattern: row.get(2)?,
            is_regex: row.get::<_, i32>(3)? != 0,
            enabled: row.get::<_, i32>(4)? != 0,
            priority: row.get(5)?,
            step: row.get(6)?,
        })
    })?;

    patterns.collect()
}

pub fn list_all_action_patterns(conn: &Connection) -> Result<Vec<ActionPattern>> {
    let mut stmt = conn.prepare(
        "SELECT id, action_id, pattern, is_regex, enabled, priority, step
         FROM action_patterns ORDER BY priority DESC",
    )?;

    let patterns = stmt.query_map([], |row| {
        Ok(ActionPattern {
            id: row.get(0)?,
            action_id: row.get(1)?,
            pattern: row.get(2)?,
            is_regex: row.get::<_, i32>(3)? != 0,
            enabled: row.get::<_, i32>(4)? != 0,
            priority: row.get(5)?,
            step: row.get(6)?,
        })
    })?;

    patterns.collect()
}

pub fn list_all_phase_patterns(conn: &Connection) -> Result<Vec<PhasePattern>> {
    let mut stmt = conn.prepare(
        "SELECT id, phase_id, pattern, is_regex, enabled, priority
         FROM phase_patterns ORDER BY priority DESC",
    )?;

    let patterns = stmt.query_map([], |row| {
        Ok(PhasePattern {
            id: row.get(0)?,
            phase_id: row.get(1)?,
            pattern: row.get(2)?,
            is_regex: row.get::<_, i32>(3)? != 0,
            enabled: row.get::<_, i32>(4)? != 0,
            priority: row.get(5)?,
        })
    })?;

    patterns.collect()
}

pub fn upsert_phase_pattern(conn: &Connection, data: &PhasePatternCreate) -> Result<bool> {
    let updated = conn.execute(
        "UPDATE phase_patterns SET enabled = ?1, priority = ?2
         WHERE phase_id = ?3 AND pattern = ?4 AND is_regex = ?5",
        params![
            data.enabled as i32,
            data.priority,
            data.phase_id,
            data.pattern,
            data.is_regex as i32
        ],
    )?;

    if updated == 0 {
        create_phase_pattern(conn, data)?;
        Ok(false)
    } else {
        Ok(true)
    }
}

pub fn upsert_action_pattern(conn: &Connection, data: &ActionPatternCreate) -> Result<bool> {
    let updated = conn.execute(
        "UPDATE action_patterns SET enabled = ?1, priority = ?2
         WHERE action_id = ?3 AND step = ?4 AND pattern = ?5 AND is_regex = ?6",
        params![
            data.enabled as i32,
            data.priority,
            data.action_id,
            data.step,
            data.pattern,
            data.is_regex as i32
        ],
    )?;

    if updated == 0 {
        conn.execute(
            "INSERT INTO action_patterns (action_id, pattern, is_regex, enabled, priority, step)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                data.action_id,
                data.pattern,
                data.is_regex as i32,
                data.enabled as i32,
                data.priority,
                data.step,
            ],
        )?;
        Ok(false)
    } else {
        Ok(true)
    }
}

// ============================================================================
// Phase Patterns with Phase Info (for detection pipeline)
// ============================================================================

/// Phase pattern with associated phase name and priority
#[derive(Debug, Clone)]
pub struct PhasePatternWithInfo {
    pub pattern: PhasePattern,
    pub phase_name: String,
    pub phase_priority: i32,
}

/// Load all phase patterns with their phase info for the detection pipeline
pub fn list_all_phase_patterns_with_info(conn: &Connection) -> Result<Vec<PhasePatternWithInfo>> {
    let mut stmt = conn.prepare(
        "SELECT pp.id, pp.phase_id, pp.pattern, pp.is_regex, pp.enabled, pp.priority,
                p.name, p.priority as phase_priority
         FROM phase_patterns pp
         JOIN phases p ON pp.phase_id = p.id
         ORDER BY p.priority DESC, pp.priority DESC",
    )?;

    let patterns = stmt.query_map([], |row| {
        Ok(PhasePatternWithInfo {
            pattern: PhasePattern {
                id: row.get(0)?,
                phase_id: row.get(1)?,
                pattern: row.get(2)?,
                is_regex: row.get::<_, i32>(3)? != 0,
                enabled: row.get::<_, i32>(4)? != 0,
                priority: row.get(5)?,
            },
            phase_name: row.get(6)?,
            phase_priority: row.get(7)?,
        })
    })?;

    patterns.collect()
}

// ============================================================================
// Target Rules (for action execution)
// ============================================================================

/// Get target rule for an account+action (returns override if exists, else default)
/// Optimized: Single query using COALESCE instead of two separate queries
pub fn get_effective_target_rule(
    conn: &Connection,
    account_id: i64,
    action_id: i64,
) -> Result<Option<String>> {
    conn.query_row(
        "SELECT COALESCE(
            (SELECT rule_json FROM target_overrides WHERE account_id = ?1 AND action_id = ?2),
            (SELECT rule_json FROM target_defaults WHERE action_id = ?2)
        )",
        params![account_id, action_id],
        |row| row.get(0),
    )
    .optional()
}

/// Get blacklist entries for an account+action
pub fn get_blacklist(conn: &Connection, account_id: i64, action_id: i64) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT button_text FROM target_blacklist WHERE account_id = ?1 AND action_id = ?2",
    )?;

    let entries = stmt.query_map(params![account_id, action_id], |row| row.get(0))?;

    entries.collect()
}

/// Get effective delay settings for an account+action (override or default)
/// Optimized: Single query with COALESCE and LEFT JOINs instead of two separate queries
pub fn get_effective_delay(
    conn: &Connection,
    account_id: i64,
    action_id: i64,
) -> Result<(i32, i32)> {
    use crate::constants::{DEFAULT_DELAY_MAX_SECONDS, DEFAULT_DELAY_MIN_SECONDS};

    conn.query_row(
        "SELECT 
            COALESCE(o.min_seconds, d.min_seconds, ?3) as min_seconds,
            COALESCE(o.max_seconds, d.max_seconds, ?4) as max_seconds
         FROM (SELECT 1) AS dummy
         LEFT JOIN delay_overrides o ON o.account_id = ?1 AND o.action_id = ?2
         LEFT JOIN delay_defaults d ON d.action_id = ?2",
        params![
            account_id,
            action_id,
            DEFAULT_DELAY_MIN_SECONDS,
            DEFAULT_DELAY_MAX_SECONDS
        ],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
}

/// Get target pairs for a two-step action
pub fn get_target_pairs(
    conn: &Connection,
    account_id: i64,
    action_id: i64,
) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT target_a, target_b FROM target_pairs 
         WHERE account_id = ?1 AND action_id = ?2 
         ORDER BY order_index",
    )?;

    let pairs = stmt.query_map(params![account_id, action_id], |row| {
        Ok((row.get(0)?, row.get(1)?))
    })?;

    pairs.collect()
}

/// Get action by ID
pub fn get_action(conn: &Connection, action_id: i64) -> Result<Option<Action>> {
    conn.query_row(
        "SELECT id, name, button_type, random_fallback_enabled, is_two_step
         FROM actions WHERE id = ?1",
        params![action_id],
        |row| {
            Ok(Action {
                id: row.get(0)?,
                name: row.get(1)?,
                button_type: row.get(2)?,
                random_fallback_enabled: row.get::<_, i32>(3)? != 0,
                is_two_step: row.get::<_, i32>(4)? != 0,
            })
        },
    )
    .optional()
}

/// Get account by ID
pub fn get_account(conn: &Connection, account_id: i64) -> Result<Option<Account>> {
    conn.query_row(
        "SELECT id, account_name, telegram_name, phone, user_id, status, last_seen_at,
                api_id_override, api_hash_override, join_max_attempts_override,
                join_cooldown_seconds_override, created_at, updated_at
         FROM accounts WHERE id = ?1",
        params![account_id],
        |row| {
            Ok(Account {
                id: row.get(0)?,
                account_name: row.get(1)?,
                telegram_name: row.get(2)?,
                phone: row.get(3)?,
                user_id: row.get(4)?,
                status: row.get(5)?,
                last_seen_at: row.get(6)?,
                api_id_override: row.get(7)?,
                api_hash_override: row.get(8)?,
                join_max_attempts_override: row.get(9)?,
                join_cooldown_seconds_override: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        },
    )
    .optional()
}

/// Update last_seen_at timestamp for an account
pub fn update_last_seen(conn: &Connection, account_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE accounts SET last_seen_at = datetime('now') WHERE id = ?1",
        params![account_id],
    )?;
    Ok(())
}

/// Update phase priority
pub fn update_phase_priority(conn: &Connection, phase_id: i64, priority: i32) -> Result<()> {
    conn.execute(
        "UPDATE phases SET priority = ?1 WHERE id = ?2",
        params![priority, phase_id],
    )?;
    Ok(())
}
