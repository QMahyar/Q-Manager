//! Worker-level caching for patterns, actions, and targets.
//! 
//! Provides TTL-based caching to reduce database queries during message processing.
//! NOTE: Currently caches detection patterns and actions; per-account target caching is future work.

use std::sync::Arc;
use std::time::{Duration, Instant};
use std::sync::Mutex;
use std::collections::HashMap;

use crate::db::{Action, ActionPattern, PhasePatternWithInfo};

/// Default cache TTL (5 minutes)
const DEFAULT_CACHE_TTL: Duration = Duration::from_secs(300);

/// Short cache TTL for frequently changing data (1 minute)
#[allow(dead_code)]
const SHORT_CACHE_TTL: Duration = Duration::from_secs(60);

/// Cached item with expiration
#[derive(Debug, Clone)]
struct CachedItem<T> {
    data: T,
    expires_at: Instant,
}

#[derive(Debug, Clone)]
pub struct ActionConfig {
    pub target_pairs: Vec<(String, String)>,
    pub blacklist: Vec<String>,
    pub targets: Vec<String>,
    pub delay_min: i32,
    pub delay_max: i32,
    pub button_type: String,
    pub random_fallback_enabled: bool,
    pub is_two_step: bool,
}

impl<T: Clone> CachedItem<T> {
    fn new(data: T, ttl: Duration) -> Self {
        CachedItem {
            data,
            expires_at: Instant::now() + ttl,
        }
    }

    fn is_expired(&self) -> bool {
        Instant::now() > self.expires_at
    }
    
    fn get_if_valid(&self) -> Option<&T> {
        if self.is_expired() {
            None
        } else {
            Some(&self.data)
        }
    }
}

/// Worker-level cache for detection pipeline data
/// Uses sync Mutex for simplicity (cache operations are fast)
pub struct WorkerCache {
    // Pattern caches
    phase_patterns: Mutex<Option<CachedItem<Vec<PhasePatternWithInfo>>>>,
    actions: Mutex<Option<CachedItem<Vec<Action>>>>,
    action_patterns: Mutex<Option<CachedItem<Vec<ActionPattern>>>>,

    // Per-account action config cache
    action_configs: Mutex<HashMap<(i64, i64), CachedItem<ActionConfig>>>,

    // Cache statistics
    hits: std::sync::atomic::AtomicU64,
    misses: std::sync::atomic::AtomicU64,
}

impl WorkerCache {
    /// Create a new worker cache
    pub fn new() -> Self {
        WorkerCache {
            phase_patterns: Mutex::new(None),
            actions: Mutex::new(None),
            action_patterns: Mutex::new(None),
            action_configs: Mutex::new(HashMap::new()),
            hits: std::sync::atomic::AtomicU64::new(0),
            misses: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// Get cached phase patterns or load from DB
    pub fn get_phase_patterns<F>(&self, loader: F) -> Result<Vec<PhasePatternWithInfo>, String>
    where
        F: FnOnce() -> Result<Vec<PhasePatternWithInfo>, String>,
    {
        if let Some(data) = self.get_cached(&self.phase_patterns)? {
            return Ok(data);
        }

        self.misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let data = loader()?;
        self.set_cached(&self.phase_patterns, data.clone())?;
        Ok(data)
    }

    fn get_cached<T: Clone>(
        &self,
        cache: &Mutex<Option<CachedItem<Vec<T>>>>,
    ) -> Result<Option<Vec<T>>, String> {
        let cache = cache.lock().map_err(|e| e.to_string())?;
        if let Some(ref item) = *cache {
            if let Some(data) = item.get_if_valid() {
                self.hits.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return Ok(Some(data.clone()));
            }
        }
        Ok(None)
    }

    fn set_cached<T: Clone>(
        &self,
        cache: &Mutex<Option<CachedItem<Vec<T>>>>,
        data: Vec<T>,
    ) -> Result<(), String> {
        let mut cache = cache.lock().map_err(|e| e.to_string())?;
        *cache = Some(CachedItem::new(data, DEFAULT_CACHE_TTL));
        Ok(())
    }

    /// Get cached actions or load from DB
    pub fn get_actions<F>(&self, loader: F) -> Result<Vec<Action>, String>
    where
        F: FnOnce() -> Result<Vec<Action>, String>,
    {
        if let Some(data) = self.get_cached(&self.actions)? {
            return Ok(data);
        }

        self.misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let data = loader()?;
        self.set_cached(&self.actions, data.clone())?;
        Ok(data)
    }

    /// Get cached action patterns or load from DB
    pub fn get_action_patterns<F>(&self, loader: F) -> Result<Vec<ActionPattern>, String>
    where
        F: FnOnce() -> Result<Vec<ActionPattern>, String>,
    {
        if let Some(data) = self.get_cached(&self.action_patterns)? {
            return Ok(data);
        }

        self.misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let data = loader()?;
        self.set_cached(&self.action_patterns, data.clone())?;
        Ok(data)
    }

    /// Invalidate all caches (call when config changes)
    pub fn invalidate_all(&self) {
        if let Ok(mut cache) = self.phase_patterns.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.actions.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.action_patterns.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.action_configs.lock() {
            cache.clear();
        }
        log::debug!("Worker cache invalidated");
    }

    /// Invalidate pattern/action caches only
    pub fn invalidate_patterns(&self) {
        if let Ok(mut cache) = self.phase_patterns.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.actions.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.action_patterns.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.action_configs.lock() {
            cache.clear();
        }
        log::debug!("Pattern cache invalidated");
    }

    /// Invalidate target caches for a specific account
    pub fn invalidate_targets(&self, account_id: i64) {
        if let Ok(mut cache) = self.action_configs.lock() {
            cache.retain(|(acct, _), _| *acct != account_id);
        }
        log::debug!("Target cache invalidated for account {}", account_id);
    }

    /// Invalidate action config cache entirely
    pub fn invalidate_action_configs(&self) {
        if let Ok(mut cache) = self.action_configs.lock() {
            cache.clear();
        }
        log::debug!("Action config cache invalidated");
    }

    /// Get cached action config or load from DB
    pub fn get_action_config<F>(&self, account_id: i64, action_id: i64, loader: F) -> Result<ActionConfig, String>
    where
        F: FnOnce() -> Result<ActionConfig, String>,
    {
        if let Some(data) = self.get_cached_config(account_id, action_id)? {
            return Ok(data);
        }

        self.misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let data = loader()?;
        self.set_cached_config(account_id, action_id, data.clone())?;
        Ok(data)
    }

    fn get_cached_config(&self, account_id: i64, action_id: i64) -> Result<Option<ActionConfig>, String> {
        let cache = self.action_configs.lock().map_err(|e| e.to_string())?;
        if let Some(item) = cache.get(&(account_id, action_id)) {
            if let Some(data) = item.get_if_valid() {
                self.hits.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return Ok(Some(data.clone()));
            }
        }
        Ok(None)
    }

    pub fn set_action_config(&self, account_id: i64, action_id: i64, data: ActionConfig) -> Result<(), String> {
        let mut cache = self.action_configs.lock().map_err(|e| e.to_string())?;
        cache.insert((account_id, action_id), CachedItem::new(data, DEFAULT_CACHE_TTL));
        Ok(())
    }

    fn set_cached_config(&self, account_id: i64, action_id: i64, data: ActionConfig) -> Result<(), String> {
        let mut cache = self.action_configs.lock().map_err(|e| e.to_string())?;
        cache.insert((account_id, action_id), CachedItem::new(data, DEFAULT_CACHE_TTL));
        Ok(())
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let hits = self.hits.load(std::sync::atomic::Ordering::Relaxed);
        let misses = self.misses.load(std::sync::atomic::Ordering::Relaxed);
        let total = hits + misses;
        let hit_rate = if total > 0 {
            (hits as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        
        CacheStats {
            hits,
            misses,
            hit_rate,
        }
    }
}

impl Default for WorkerCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}

/// Global shared cache for all workers (for immutable data like patterns)
pub static SHARED_CACHE: once_cell::sync::Lazy<Arc<WorkerCache>> = 
    once_cell::sync::Lazy::new(|| Arc::new(WorkerCache::new()));

/// Get the shared worker cache
pub fn shared_cache() -> Arc<WorkerCache> {
    Arc::clone(&SHARED_CACHE)
}
