# Changelog

All notable changes to Q Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-09

### Added
- Initial release of Q Manager
- Multi-account management with start/stop controls
- Telethon login wizard (phone → code → 2FA)
- Phase detection system (JoinTime, Join Confirmation, Game Start, Game End)
- Action automation with configurable patterns and triggers
- Per-account target configuration with blacklist support
- Random fallback for target selection
- Two-step actions support (Cupid lover selection)
- Batch operations (Start All, Stop All, Start Selected, Stop Selected)
- System tray integration with per-account controls
- Diagnostics and health monitoring
- Cross-platform support (Windows + Linux)
- Tauri + React + Rust architecture
- SQLite database for local storage
- Telethon worker for Telegram connectivity

### Technical Stack
- Frontend: React 19 + Vite 7 + TypeScript + shadcn/ui
- Backend: Rust + Tauri 2 + tokio + rusqlite
- Telegram: Telethon (Python) worker
- Database: SQLite with connection pooling

[1.0.0]: https://github.com/QMahyar/Q-Manager/releases/tag/v1.0.0
