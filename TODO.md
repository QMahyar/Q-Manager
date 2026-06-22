# Codebase Review Fix Tasks

- [ ] Fix listener leak in useAccountEvents - setupListeners() is not awaited, causing listener leak on early unmount
- [ ] Fix duplicate 'stopped' event emission in stop_account/worker cleanup (manager.rs emits stopped twice)
- [ ] Use last_insert_rowid() in account CRUD instead of full list scans (accounts.rs account_create, account_update, account_get)
- [ ] Unify WorkerConfig construction - remove dead config_from_account or make it the single source used by manager
- [ ] Add graceful shutdown wait before child.kill() in TelethonClient::shutdown (telethon/mod.rs)
- [ ] Scope Tauri FS capability more tightly in capabilities/default.json
- [ ] Fix WorkerCache TOCTOU race in get_cached_with_version/set_cached_with_version
- [ ] Fix invokeWithRetry - retry predicate isNetworkError won't trigger for Tauri IPC errors (api.ts)
- [ ] Fix misleading updateAccount TypeScript signature passing Partial<Account> instead of AccountUpdate type
- [ ] Remove duplicate get_sessions_dir function (defined in both accounts.rs and manager.rs)
- [ ] Remove duplicate set_cached_config / set_action_config in cache.rs
- [ ] Fix dual WorkerCommand enum definitions in manager.rs and account_worker.rs
- [ ] Fix invokeWithRetry vs invokeWithRetryCommand confusing two-level indirection in api.ts
- [ ] Update Cargo.toml authors field from placeholder 'you'
