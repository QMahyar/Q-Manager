//! Debouncing utilities for rate-limiting operations.
//!
//! Provides debouncing for frequent database updates like last_seen_at
//! and event emissions to reduce system load.

#![allow(dead_code)]

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Debouncer for last_seen_at updates (per account)
pub static LAST_SEEN_DEBOUNCER: Lazy<Debouncer<i64>> =
    Lazy::new(|| Debouncer::new(Duration::from_secs(30)));

/// Debouncer for account status events
pub static STATUS_EVENT_DEBOUNCER: Lazy<Debouncer<i64>> =
    Lazy::new(|| Debouncer::new(Duration::from_millis(500)));

/// Generic debouncer that tracks last execution time per key
pub struct Debouncer<K: std::hash::Hash + Eq + Clone> {
    last_execution: Mutex<HashMap<K, Instant>>,
    debounce_duration: Duration,
}

impl<K: std::hash::Hash + Eq + Clone> Debouncer<K> {
    /// Create a new debouncer with the specified duration
    pub fn new(debounce_duration: Duration) -> Self {
        Debouncer {
            last_execution: Mutex::new(HashMap::new()),
            debounce_duration,
        }
    }

    /// Check if the operation should be executed for the given key.
    /// Returns true if enough time has passed since last execution.
    /// Automatically updates the last execution time if returning true.
    pub fn should_execute(&self, key: &K) -> bool {
        let mut map = self.last_execution.lock().expect(
            "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
        );
        let now = Instant::now();

        if let Some(last) = map.get(key) {
            if now.duration_since(*last) < self.debounce_duration {
                return false;
            }
        }

        map.insert(key.clone(), now);
        true
    }

    /// Check if the operation should be executed without updating state.
    /// Use this when you need to check but may not actually execute.
    pub fn check_only(&self, key: &K) -> bool {
        let map = self.last_execution.lock().expect(
            "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
        );
        let now = Instant::now();

        if let Some(last) = map.get(key) {
            now.duration_since(*last) >= self.debounce_duration
        } else {
            true
        }
    }

    /// Mark that an operation was executed for the given key.
    /// Use this when you used check_only() and then decided to execute.
    pub fn mark_executed(&self, key: &K) {
        let mut map = self.last_execution.lock().expect(
            "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
        );
        map.insert(key.clone(), Instant::now());
    }

    /// Force reset the debounce timer for a key (allows immediate execution)
    pub fn reset(&self, key: &K) {
        let mut map = self.last_execution.lock().expect(
            "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
        );
        map.remove(key);
    }

    /// Clear all tracked keys
    pub fn clear(&self) {
        let mut map = self.last_execution.lock().expect(
            "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
        );
        map.clear();
    }

    /// Get the number of tracked keys
    pub fn len(&self) -> usize {
        self.last_execution
            .lock()
            .expect(
                "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
            )
            .len()
    }

    /// Check if the debouncer is empty
    pub fn is_empty(&self) -> bool {
        self.last_execution
            .lock()
            .expect(
                "Debouncer mutex poisoned - this indicates a panic occurred while holding the lock",
            )
            .is_empty()
    }
}

/// Batch debouncer that collects items and flushes them periodically
pub struct BatchDebouncer<K: std::hash::Hash + Eq + Clone, V> {
    pending: Mutex<HashMap<K, V>>,
    last_flush: Mutex<Instant>,
    flush_interval: Duration,
}

impl<K: std::hash::Hash + Eq + Clone, V> BatchDebouncer<K, V> {
    /// Create a new batch debouncer
    pub fn new(flush_interval: Duration) -> Self {
        BatchDebouncer {
            pending: Mutex::new(HashMap::new()),
            last_flush: Mutex::new(Instant::now()),
            flush_interval,
        }
    }

    /// Add an item to the pending batch
    pub fn add(&self, key: K, value: V) {
        let mut pending = self
            .pending
            .lock()
            .expect("BatchDebouncer pending mutex poisoned");
        pending.insert(key, value);
    }

    /// Check if it's time to flush and return pending items if so
    pub fn try_flush(&self) -> Option<HashMap<K, V>> {
        let now = Instant::now();

        {
            let last = self
                .last_flush
                .lock()
                .expect("BatchDebouncer last_flush mutex poisoned");
            if now.duration_since(*last) < self.flush_interval {
                return None;
            }
        }

        // Time to flush
        let mut pending = self
            .pending
            .lock()
            .expect("BatchDebouncer pending mutex poisoned");
        let mut last = self
            .last_flush
            .lock()
            .expect("BatchDebouncer last_flush mutex poisoned");

        if pending.is_empty() {
            *last = now;
            return None;
        }

        let items = std::mem::take(&mut *pending);
        *last = now;
        Some(items)
    }

    /// Force flush all pending items
    pub fn flush(&self) -> HashMap<K, V> {
        let mut pending = self
            .pending
            .lock()
            .expect("BatchDebouncer pending mutex poisoned");
        let mut last = self
            .last_flush
            .lock()
            .expect("BatchDebouncer last_flush mutex poisoned");
        *last = Instant::now();
        std::mem::take(&mut *pending)
    }

    /// Get the number of pending items
    pub fn pending_count(&self) -> usize {
        self.pending
            .lock()
            .expect("BatchDebouncer pending mutex poisoned")
            .len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn test_debouncer_basic() {
        let debouncer = Debouncer::new(Duration::from_millis(50));

        // First call should execute
        assert!(debouncer.should_execute(&1));

        // Immediate second call should be debounced
        assert!(!debouncer.should_execute(&1));

        // Different key should execute
        assert!(debouncer.should_execute(&2));

        // Wait for debounce period
        sleep(Duration::from_millis(60));

        // Now should execute again
        assert!(debouncer.should_execute(&1));
    }

    #[test]
    fn test_debouncer_reset() {
        let debouncer = Debouncer::new(Duration::from_millis(100));

        assert!(debouncer.should_execute(&1));
        assert!(!debouncer.should_execute(&1));

        debouncer.reset(&1);

        // Should execute immediately after reset
        assert!(debouncer.should_execute(&1));
    }

    #[test]
    fn test_debouncer_check_only() {
        let debouncer = Debouncer::new(Duration::from_millis(50));

        // check_only should return true initially (no state change)
        assert!(debouncer.check_only(&1));
        assert!(debouncer.check_only(&1)); // Still true, no state change

        // After marking executed, check_only should return false
        debouncer.mark_executed(&1);
        assert!(!debouncer.check_only(&1));

        // Wait for debounce period
        sleep(Duration::from_millis(60));
        assert!(debouncer.check_only(&1));
    }

    #[test]
    fn test_debouncer_clear() {
        let debouncer = Debouncer::new(Duration::from_millis(100));

        debouncer.should_execute(&1);
        debouncer.should_execute(&2);
        debouncer.should_execute(&3);

        assert_eq!(debouncer.len(), 3);
        assert!(!debouncer.is_empty());

        debouncer.clear();

        assert_eq!(debouncer.len(), 0);
        assert!(debouncer.is_empty());

        // All keys should execute again
        assert!(debouncer.should_execute(&1));
        assert!(debouncer.should_execute(&2));
    }

    #[test]
    fn test_debouncer_with_string_keys() {
        let debouncer = Debouncer::new(Duration::from_millis(50));

        assert!(debouncer.should_execute(&"account_1".to_string()));
        assert!(!debouncer.should_execute(&"account_1".to_string()));
        assert!(debouncer.should_execute(&"account_2".to_string()));
    }

    #[test]
    fn test_batch_debouncer_basic() {
        let debouncer: BatchDebouncer<i64, String> = BatchDebouncer::new(Duration::from_millis(50));

        debouncer.add(1, "value1".to_string());
        debouncer.add(2, "value2".to_string());

        assert_eq!(debouncer.pending_count(), 2);

        // Not enough time passed
        assert!(debouncer.try_flush().is_none());

        // Wait for flush interval
        sleep(Duration::from_millis(60));

        let flushed = debouncer.try_flush();
        assert!(flushed.is_some());

        let items = flushed.unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items.get(&1), Some(&"value1".to_string()));

        // After flush, pending should be empty
        assert_eq!(debouncer.pending_count(), 0);
    }

    #[test]
    fn test_batch_debouncer_overwrites() {
        let debouncer: BatchDebouncer<i64, String> =
            BatchDebouncer::new(Duration::from_millis(100));

        debouncer.add(1, "first".to_string());
        debouncer.add(1, "second".to_string());
        debouncer.add(1, "third".to_string());

        // Only one item because same key
        assert_eq!(debouncer.pending_count(), 1);

        let items = debouncer.flush();
        assert_eq!(items.get(&1), Some(&"third".to_string())); // Last value wins
    }

    #[test]
    fn test_batch_debouncer_force_flush() {
        let debouncer: BatchDebouncer<i64, i32> = BatchDebouncer::new(Duration::from_secs(100));

        debouncer.add(1, 100);
        debouncer.add(2, 200);

        // Force flush even though interval hasn't passed
        let items = debouncer.flush();
        assert_eq!(items.len(), 2);
        assert_eq!(debouncer.pending_count(), 0);
    }

    #[test]
    fn test_batch_debouncer_empty_flush() {
        let debouncer: BatchDebouncer<i64, i32> = BatchDebouncer::new(Duration::from_millis(10));

        sleep(Duration::from_millis(20));

        // Should return None for empty batch
        assert!(debouncer.try_flush().is_none());

        // Force flush returns empty map
        let items = debouncer.flush();
        assert!(items.is_empty());
    }
}
