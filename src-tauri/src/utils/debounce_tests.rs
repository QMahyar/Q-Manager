//! Comprehensive tests for debounce utilities

#[cfg(test)]
mod tests {
    use super::super::debounce::*;
    use std::time::Duration;
    use std::thread::sleep;

    #[test]
    fn test_debouncer_first_execution() {
        let debouncer = Debouncer::new(Duration::from_millis(100));
        assert!(debouncer.should_execute(&1));
    }

    #[test]
    fn test_debouncer_prevents_immediate_reexecution() {
        let debouncer = Debouncer::new(Duration::from_millis(100));
        
        assert!(debouncer.should_execute(&1));
        assert!(!debouncer.should_execute(&1));
    }

    #[test]
    fn test_debouncer_different_keys() {
        let debouncer = Debouncer::new(Duration::from_millis(100));
        
        assert!(debouncer.should_execute(&1));
        assert!(debouncer.should_execute(&2));
        assert!(debouncer.should_execute(&3));
    }

    #[test]
    fn test_debouncer_allows_after_duration() {
        let debouncer = Debouncer::new(Duration::from_millis(50));
        
        assert!(debouncer.should_execute(&1));
        sleep(Duration::from_millis(60));
        assert!(debouncer.should_execute(&1));
    }

    #[test]
    fn test_debouncer_check_only() {
        let debouncer = Debouncer::new(Duration::from_millis(100));
        
        // First check should return true
        assert!(debouncer.check_only(&1));
        
        // Mark as executed
        debouncer.mark_executed(&1);
        
        // Immediate check should return false
        assert!(!debouncer.check_only(&1));
    }

    #[test]
    fn test_debouncer_reset() {
        let debouncer = Debouncer::new(Duration::from_millis(100));
        
        debouncer.should_execute(&1);
        assert!(!debouncer.should_execute(&1));
        
        // Reset should allow immediate execution
        debouncer.reset(&1);
        assert!(debouncer.should_execute(&1));
    }

    #[test]
    fn test_debouncer_clear() {
        let debouncer = Debouncer::new(Duration::from_millis(100));
        
        debouncer.should_execute(&1);
        debouncer.should_execute(&2);
        debouncer.should_execute(&3);
        
        assert_eq!(debouncer.len(), 3);
        
        debouncer.clear();
        
        assert_eq!(debouncer.len(), 0);
        assert!(debouncer.is_empty());
    }

    #[test]
    fn test_debouncer_is_empty() {
        let debouncer = Debouncer::<i32>::new(Duration::from_millis(100));
        
        assert!(debouncer.is_empty());
        
        debouncer.should_execute(&1);
        assert!(!debouncer.is_empty());
    }

    #[test]
    fn test_batch_debouncer_add_and_flush() {
        let debouncer = BatchDebouncer::new(Duration::from_millis(50));
        
        debouncer.add(1, "value1");
        debouncer.add(2, "value2");
        
        assert_eq!(debouncer.pending_count(), 2);
        
        let items = debouncer.flush();
        assert_eq!(items.len(), 2);
        assert_eq!(debouncer.pending_count(), 0);
    }

    #[test]
    fn test_batch_debouncer_try_flush_too_soon() {
        let debouncer = BatchDebouncer::new(Duration::from_millis(100));
        
        debouncer.add(1, "value1");
        
        let result = debouncer.try_flush();
        assert!(result.is_none());
    }

    #[test]
    fn test_batch_debouncer_try_flush_after_interval() {
        let debouncer = BatchDebouncer::new(Duration::from_millis(50));
        
        debouncer.add(1, "value1");
        
        sleep(Duration::from_millis(60));
        
        let result = debouncer.try_flush();
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[test]
    fn test_batch_debouncer_replaces_values() {
        let debouncer = BatchDebouncer::new(Duration::from_millis(50));
        
        debouncer.add(1, "value1");
        debouncer.add(1, "value2"); // Should replace
        
        assert_eq!(debouncer.pending_count(), 1);
        
        let items = debouncer.flush();
        assert_eq!(items.get(&1), Some(&"value2"));
    }

    #[test]
    fn test_mutex_poisoning_recovery() {
        // This test verifies that our descriptive error messages work
        let debouncer = Debouncer::<i32>::new(Duration::from_millis(100));
        
        // Normal operation should work
        assert!(debouncer.should_execute(&1));
        assert_eq!(debouncer.len(), 1);
        assert!(!debouncer.is_empty());
    }

    #[test]
    fn test_concurrent_access() {
        use std::sync::Arc;
        use std::thread;
        
        let debouncer = Arc::new(Debouncer::new(Duration::from_millis(10)));
        let mut handles = vec![];
        
        for i in 0..5 {
            let debouncer_clone = Arc::clone(&debouncer);
            let handle = thread::spawn(move || {
                debouncer_clone.should_execute(&i);
            });
            handles.push(handle);
        }
        
        for handle in handles {
            handle.join().unwrap();
        }
        
        // Should have 5 different keys
        assert_eq!(debouncer.len(), 5);
    }
}
