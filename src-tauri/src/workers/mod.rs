//! Account workers for Q Manager
//!
//! Each running account has a dedicated worker task that:
//! - Connects to Telegram via Telethon worker
//! - Subscribes to message updates
//! - Runs the detection pipeline
//! - Executes actions (join, click buttons)

#![allow(dead_code)]

mod account_worker;
mod cache;
mod detection;
mod manager;

#[cfg(test)]
mod account_worker_tests;

pub use account_worker::{AccountWorker, WorkerConfig};
#[allow(unused_imports)]
pub use cache::{shared_cache, CacheStats, WorkerCache};
#[allow(unused_imports)]
pub use detection::DetectionPipeline;
#[allow(unused_imports)]
pub use manager::{WorkerManager, WORKER_MANAGER};
