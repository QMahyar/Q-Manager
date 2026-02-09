//! Database module for Q Manager
//! Handles SQLite database initialization and operations with connection pooling.

mod operations;
mod schema;

#[cfg(test)]
mod operations_tests;

pub use operations::*;
pub use schema::init_db;

use once_cell::sync::Lazy;
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;
use std::time::Duration;

/// Type alias for the connection pool
pub type DbPool = Pool<SqliteConnectionManager>;
pub type PooledConn = PooledConnection<SqliteConnectionManager>;

/// Connection pool configuration
const POOL_SIZE: u32 = 10;
const POOL_MIN_IDLE: u32 = 2;
const POOL_CONNECTION_TIMEOUT_SECS: u64 = 30;

/// Global database connection pool for concurrent access
pub static DB_POOL: Lazy<DbPool> = Lazy::new(|| {
    let db_path = get_db_path();
    log::info!("Initializing database at: {:?}", db_path);

    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn| {
        // Enable WAL mode for better concurrency
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 PRAGMA foreign_keys = ON;
                 PRAGMA cache_size = -64000;
                 PRAGMA temp_store = MEMORY;
                 PRAGMA mmap_size = 268435456;
                 PRAGMA busy_timeout = 5000;",
        )?;
        Ok(())
    });

    let pool = Pool::builder()
        .max_size(POOL_SIZE)
        .min_idle(Some(POOL_MIN_IDLE))
        .connection_timeout(Duration::from_secs(POOL_CONNECTION_TIMEOUT_SECS))
        .build(manager)
        .unwrap_or_else(|e| {
            log::error!("FATAL: Failed to create database pool: {}", e);
            log::error!("Database path: {:?}", db_path);
            log::error!("This is a critical error. The application cannot continue.");
            panic!("Failed to create database pool: {}. Check logs and ensure database directory is writable.", e);
        });

    // Initialize schema on first connection
    {
        let conn = pool.get().unwrap_or_else(|e| {
            log::error!("FATAL: Failed to get initial database connection: {}", e);
            log::error!("This usually means the database file is locked or corrupted.");
            panic!("Failed to get initial database connection: {}. Try closing other instances or deleting the database.", e);
        });

        init_db(&conn).unwrap_or_else(|e| {
            log::error!("FATAL: Failed to initialize database schema: {}", e);
            log::error!("The database might be corrupted. Consider deleting it and restarting.");
            panic!(
                "Failed to initialize database schema: {}. Database may be corrupted.",
                e
            );
        });
    }

    log::info!(
        "Database pool initialized with {} max connections",
        POOL_SIZE
    );
    pool
});

/// Get a connection from the pool
pub fn get_conn() -> Result<PooledConn, r2d2::Error> {
    DB_POOL.get()
}

/// Legacy compatibility: Get the database path (next to executable for portable mode)
fn get_db_path() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let db_dir = exe_dir.join("db");
    std::fs::create_dir_all(&db_dir).ok();
    db_dir.join("app.sqlite")
}

// Legacy compatibility layer removed - use get_conn() for all database access
