//! Database schema initialization for Q Manager
//! Creates all tables according to MainPlan.md specification.

use rusqlite::{Connection, Result};

fn ensure_settings_column(conn: &Connection, column_name: &str, column_def: &str) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(settings)")?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut exists = false;
    for column in columns {
        if column? == column_name {
            exists = true;
            break;
        }
    }
    if !exists {
        let sql = format!(
            "ALTER TABLE settings ADD COLUMN {} {}",
            column_name, column_def
        );
        conn.execute(&sql, [])?;
    }
    Ok(())
}

/// Initialize the database schema
pub fn init_db(conn: &Connection) -> Result<()> {
    // ========================================================================
    // Database Configuration (Performance & Reliability)
    // ========================================================================
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;           -- Write-Ahead Logging for better concurrency
        PRAGMA synchronous = NORMAL;         -- Good balance of safety and performance
        PRAGMA foreign_keys = ON;            -- Enforce referential integrity
        PRAGMA busy_timeout = 5000;          -- 5 second timeout on lock contention
        PRAGMA cache_size = -64000;          -- 64MB page cache
        PRAGMA temp_store = MEMORY;          -- Store temp tables in memory
    ",
    )?;

    // Schema version table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL,
            updated_at TEXT
        )",
        [],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO schema_version (id, version, updated_at)
         VALUES (1, 1, datetime('now'))",
        [],
    )?;

    // Settings table (singleton row)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            api_id INTEGER,
            api_hash TEXT,
            main_bot_user_id INTEGER,
            main_bot_username TEXT,
            beta_bot_user_id INTEGER,
            beta_bot_username TEXT,
            join_max_attempts_default INTEGER NOT NULL DEFAULT 5,
            join_cooldown_seconds_default INTEGER NOT NULL DEFAULT 5,
            ban_warning_patterns_json TEXT NOT NULL DEFAULT '[]',
            theme_mode TEXT NOT NULL DEFAULT 'system',
            theme_palette TEXT NOT NULL DEFAULT 'zinc',
            theme_variant TEXT NOT NULL DEFAULT 'subtle',
            created_at TEXT,
            updated_at TEXT
        )",
        [],
    )?;

    // Insert default settings row if not exists
    conn.execute(
        "INSERT OR IGNORE INTO settings (id, created_at, updated_at) 
         VALUES (1, datetime('now'), datetime('now'))",
        [],
    )?;

    // Lightweight migration for theme settings columns
    ensure_settings_column(conn, "theme_mode", "TEXT NOT NULL DEFAULT 'system'")?;
    ensure_settings_column(conn, "theme_palette", "TEXT NOT NULL DEFAULT 'zinc'")?;
    ensure_settings_column(conn, "theme_variant", "TEXT NOT NULL DEFAULT 'subtle'")?;
    conn.execute(
        "UPDATE settings SET theme_mode = 'system' WHERE theme_mode IS NULL",
        [],
    )?;
    conn.execute(
        "UPDATE settings SET theme_palette = 'zinc' WHERE theme_palette IS NULL",
        [],
    )?;
    conn.execute(
        "UPDATE settings SET theme_variant = 'subtle' WHERE theme_variant IS NULL",
        [],
    )?;

    // Accounts table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY,
            account_name TEXT NOT NULL,
            telegram_name TEXT,
            phone TEXT,
            user_id INTEGER,
            status TEXT NOT NULL DEFAULT 'stopped',
            last_seen_at TEXT,
            api_id_override INTEGER,
            api_hash_override TEXT,
            join_max_attempts_override INTEGER,
            join_cooldown_seconds_override INTEGER,
            created_at TEXT,
            updated_at TEXT
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)",
        [],
    )?;
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_name_unique ON accounts(account_name COLLATE NOCASE)",
        [],
    )?;

    // Account group slots (up to 2 per account)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS account_group_slots (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            slot INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 0,
            group_id INTEGER,
            group_title TEXT,
            moderator_kind TEXT NOT NULL DEFAULT 'main',
            UNIQUE(account_id, slot),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_group_slots_account ON account_group_slots(account_id)",
        [],
    )?;

    // Phases table (4 phases in v1)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS phases (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            priority INTEGER NOT NULL
        )",
        [],
    )?;

    // Insert default phases if not exists
    conn.execute(
        "INSERT OR IGNORE INTO phases (id, name, display_name, priority) VALUES
            (1, 'join_time', 'Join Time', 100),
            (2, 'join_confirmation', 'Join Confirmation', 90),
            (3, 'game_start', 'Game Start', 80),
            (4, 'game_end', 'Game End', 70)",
        [],
    )?;

    // Phase patterns
    conn.execute(
        "CREATE TABLE IF NOT EXISTS phase_patterns (
            id INTEGER PRIMARY KEY,
            phase_id INTEGER NOT NULL,
            pattern TEXT NOT NULL,
            is_regex INTEGER NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phase_patterns_phase ON phase_patterns(phase_id)",
        [],
    )?;

    // Actions table (global action catalog)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            button_type TEXT NOT NULL,
            random_fallback_enabled INTEGER NOT NULL DEFAULT 1,
            is_two_step INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_actions_name ON actions(name)",
        [],
    )?;

    // Action patterns
    conn.execute(
        "CREATE TABLE IF NOT EXISTS action_patterns (
            id INTEGER PRIMARY KEY,
            action_id INTEGER NOT NULL,
            pattern TEXT NOT NULL,
            is_regex INTEGER NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 0,
            step INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_action_patterns_action ON action_patterns(action_id)",
        [],
    )?;

    // Target defaults (global per action)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS target_defaults (
            id INTEGER PRIMARY KEY,
            action_id INTEGER NOT NULL UNIQUE,
            rule_json TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Target overrides (per account per action)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS target_overrides (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            action_id INTEGER NOT NULL,
            rule_json TEXT NOT NULL DEFAULT '{}',
            UNIQUE(account_id, action_id),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Target blacklist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS target_blacklist (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            action_id INTEGER NOT NULL,
            button_text TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_blacklist_account_action ON target_blacklist(account_id, action_id)",
        [],
    )?;

    // Delay defaults (global per action)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS delay_defaults (
            id INTEGER PRIMARY KEY,
            action_id INTEGER NOT NULL UNIQUE,
            min_seconds INTEGER NOT NULL DEFAULT 2,
            max_seconds INTEGER NOT NULL DEFAULT 8,
            CHECK (min_seconds <= max_seconds),
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Delay overrides (per account per action)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS delay_overrides (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            action_id INTEGER NOT NULL,
            min_seconds INTEGER NOT NULL,
            max_seconds INTEGER NOT NULL,
            CHECK (min_seconds <= max_seconds),
            UNIQUE(account_id, action_id),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Target pairs for two-step actions (Cupid)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS target_pairs (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            action_id INTEGER NOT NULL,
            order_index INTEGER NOT NULL,
            target_a TEXT NOT NULL,
            target_b TEXT NOT NULL,
            UNIQUE(account_id, action_id, order_index),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_pairs_account_action ON target_pairs(account_id, action_id)",
        [],
    )?;

    // ========================================================================
    // Additional Performance Indexes
    // ========================================================================

    // Target overrides: frequently queried by account_id for listing
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_target_overrides_account ON target_overrides(account_id)",
        [],
    )?;

    // Delay overrides: composite index for effective delay lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_delay_overrides_account_action ON delay_overrides(account_id, action_id)",
        [],
    )?;

    // Accounts: status filtering for batch operations (start all stopped, etc.)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)",
        [],
    )?;

    // Phase patterns: optimized for detection pipeline loading (enabled patterns by priority)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phase_patterns_enabled ON phase_patterns(enabled, priority DESC)",
        [],
    )?;

    // Action patterns: optimized for detection pipeline loading
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_action_patterns_enabled ON action_patterns(enabled, priority DESC)",
        [],
    )?;

    // Blacklist: unique constraint to prevent duplicate entries
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_unique ON target_blacklist(account_id, action_id, button_text)",
        [],
    )?;

    Ok(())
}
