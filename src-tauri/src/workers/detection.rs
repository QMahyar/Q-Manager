//! Detection pipeline for Q Manager
//! 
//! Processes incoming messages and detects:
//! - Game phases (JoinTime, Join Confirmation, Game Start, Game End)
//! - Action prompts (Vote, Kill, Eat, etc.)

use regex::Regex;
use once_cell::sync::Lazy;
use lru::LruCache;
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::sync::Arc;
use parking_lot::Mutex;
use crate::db::{PhasePattern, Action};

use crate::constants::REGEX_CACHE_MAX_SIZE;

/// LRU regex cache with Arc for cheap cloning
static REGEX_CACHE: Lazy<Mutex<LruCache<String, Arc<Regex>>>> =
    Lazy::new(|| {
        let capacity = NonZeroUsize::new(REGEX_CACHE_MAX_SIZE).unwrap_or(NonZeroUsize::MIN);
        Mutex::new(LruCache::new(capacity))
    });

/// Get or compile a regex pattern (uses LRU cache for efficient eviction)
fn get_regex(pattern: &str) -> Result<Arc<Regex>, String> {
    if let Some(regex) = REGEX_CACHE.lock().get(pattern) {
        return Ok(Arc::clone(regex));
    }

    // Compile outside the lock to avoid blocking other threads
    let compiled = Arc::new(Regex::new(pattern).map_err(|e| {
        log::warn!("Invalid regex pattern '{}': {}", pattern, e);
        format!("Invalid regex: {}", e)
    })?);

    let mut cache = REGEX_CACHE.lock();
    if let Some(existing) = cache.get(pattern) {
        return Ok(Arc::clone(existing));
    }
    cache.put(pattern.to_string(), Arc::clone(&compiled));
    Ok(compiled)
}

/// Clear regex cache (useful after reloading patterns)
pub fn clear_regex_cache() {
    let mut cache = REGEX_CACHE.lock();
    cache.clear();
}

/// Normalized message event for detection
#[derive(Debug, Clone)]
pub struct MessageEvent {
    pub text: String,
    pub chat_id: i64,
    pub is_private: bool,
    pub sender_id: i64,
    pub buttons: Vec<InlineButton>,
}

/// Inline keyboard button
#[derive(Debug, Clone)]
pub struct InlineButton {
    pub text: String,
    pub callback_data: Option<String>,
    pub url: Option<String>,
}

/// Detection result
#[derive(Debug, Clone)]
pub enum DetectionResult {
    Phase {
        phase_name: String,
        pattern_id: i64,
        priority: i32,
    },
    Action {
        action_id: i64,
        action_name: String,
        pattern_id: i64,
        priority: i32,
        step: i32,
    },
}

/// Detection pipeline
pub struct DetectionPipeline {
    phase_patterns: Vec<CompiledPattern>,
    action_patterns: Vec<CompiledActionPattern>,
}

struct CompiledPattern {
    id: i64,
    phase_name: String,
    pattern: String,
    is_regex: bool,
    priority: i32,
    phase_priority: i32,
}

struct CompiledActionPattern {
    id: i64,
    action_id: i64,
    action_name: String,
    pattern: String,
    is_regex: bool,
    priority: i32,
    step: i32,
}

impl DetectionPipeline {
    /// Create a new detection pipeline
    pub fn new() -> Self {
        DetectionPipeline {
            phase_patterns: Vec::new(),
            action_patterns: Vec::new(),
        }
    }

    /// Load patterns from database
    pub fn load_phase_patterns(&mut self, patterns: Vec<(PhasePattern, String, i32)>) {
        self.phase_patterns = patterns
            .into_iter()
            .filter(|(p, _, _)| p.enabled)
            .map(|(p, phase_name, phase_priority)| CompiledPattern {
                id: p.id,
                phase_name,
                pattern: p.pattern,
                is_regex: p.is_regex,
                priority: p.priority,
                phase_priority,
            })
            .collect();
        
        // Sort by phase priority (desc) then pattern priority (desc)
        self.phase_patterns.sort_by(|a, b| {
            b.phase_priority.cmp(&a.phase_priority)
                .then_with(|| b.priority.cmp(&a.priority))
        });
    }

    /// Load action patterns
    pub fn load_action_patterns(&mut self, actions: Vec<Action>, patterns: Vec<crate::db::ActionPattern>) {
        let action_map: HashMap<i64, &Action> = actions.iter().map(|a| (a.id, a)).collect();
        
        self.action_patterns = patterns
            .into_iter()
            .filter(|p| p.enabled)
            .filter_map(|p| {
                action_map.get(&p.action_id).map(|action| CompiledActionPattern {
                    id: p.id,
                    action_id: p.action_id,
                    action_name: action.name.clone(),
                    pattern: p.pattern,
                    is_regex: p.is_regex,
                    priority: p.priority,
                    step: p.step,
                })
            })
            .collect();
        
        // Sort by priority (desc)
        self.action_patterns.sort_by(|a, b| b.priority.cmp(&a.priority));
    }

    /// Process a message and return all matches
    pub fn process(&self, event: &MessageEvent) -> Vec<DetectionResult> {
        let mut results = Vec::new();
        
        // Check phase patterns
        for pattern in &self.phase_patterns {
            if self.matches(&event.text, &pattern.pattern, pattern.is_regex, Some("phase")) {
                results.push(DetectionResult::Phase {
                    phase_name: pattern.phase_name.clone(),
                    pattern_id: pattern.id,
                    priority: pattern.phase_priority * 1000 + pattern.priority,
                });
                break;
            }
        }
        
        // Check action patterns
        for pattern in &self.action_patterns {
            if self.matches(&event.text, &pattern.pattern, pattern.is_regex, Some("action")) {
                results.push(DetectionResult::Action {
                    action_id: pattern.action_id,
                    action_name: pattern.action_name.clone(),
                    pattern_id: pattern.id,
                    priority: pattern.priority,
                    step: pattern.step,
                });
            }
        }
        
        // Sort all results by priority (already sorted, but combined list needs re-sort)
        results.sort_by(|a, b| {
            let priority_a = match a {
                DetectionResult::Phase { priority, .. } => *priority,
                DetectionResult::Action { priority, .. } => *priority,
            };
            let priority_b = match b {
                DetectionResult::Phase { priority, .. } => *priority,
                DetectionResult::Action { priority, .. } => *priority,
            };
            priority_b.cmp(&priority_a)
        });
        
        results
    }

    /// Check if text matches a pattern
    fn matches(&self, text: &str, pattern: &str, is_regex: bool, scope: Option<&str>) -> bool {
        if is_regex {
            match get_regex(pattern) {
                Ok(regex) => regex.is_match(text),
                Err(err) => {
                    let scope = scope.unwrap_or("unknown");
                    crate::events::emit_regex_validation(scope, pattern, &err);
                    false
                }
            }
        } else {
            text.contains(pattern)
        }
    }
}

impl DetectionPipeline {
    /// Get count of loaded phase patterns
    pub fn phase_pattern_count(&self) -> usize {
        self.phase_patterns.len()
    }
    
    /// Get count of loaded action patterns
    pub fn action_pattern_count(&self) -> usize {
        self.action_patterns.len()
    }
}

impl Default for DetectionPipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_substring_match() {
        let pipeline = DetectionPipeline::new();
        assert!(pipeline.matches("Hello world", "world", false, None));
        assert!(!pipeline.matches("Hello world", "foo", false, None));
    }

    #[test]
    fn test_regex_match() {
        let pipeline = DetectionPipeline::new();
        assert!(pipeline.matches("Hello 123 world", r"\d+", true, None));
        assert!(!pipeline.matches("Hello world", r"\d+", true, None));
    }
}
