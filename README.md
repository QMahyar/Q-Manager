# Q Manager

[![CI](https://github.com/QMahyar/Q-Manager/actions/workflows/ci.yml/badge.svg)](https://github.com/QMahyar/Q-Manager/actions/workflows/ci.yml)
[![Release](https://github.com/QMahyar/Q-Manager/actions/workflows/release.yml/badge.svg)](https://github.com/QMahyar/Q-Manager/actions/workflows/release.yml)
[![Security](https://github.com/QMahyar/Q-Manager/actions/workflows/security.yml/badge.svg)](https://github.com/QMahyar/Q-Manager/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/QMahyar/Q-Manager)](https://github.com/QMahyar/Q-Manager/releases/latest)
[![GitHub issues](https://img.shields.io/github/issues/QMahyar/Q-Manager)](https://github.com/QMahyar/Q-Manager/issues)

Q Manager is a cross-platform desktop app for automating Werewolf game interactions on Telegram.
It manages multiple accounts, detects game phases, and executes actions based on configurable patterns and targets.
The app combines a React + Vite frontend with a Rust + Tauri backend and a Telethon worker for Telegram connectivity.

## Tech stack

- Frontend: React + Vite + TypeScript + shadcn/ui
- Backend: Rust + Tauri 2 + tokio + rusqlite
- Telegram: Telethon worker (Python)
- Events: Tauri IPC (`invoke`) + backend events for realtime updates

## Purpose

Q Manager helps Werewolf moderators and players automate common Telegram game workflows: joining games, responding to prompts, and selecting targets.
It is designed for multi-account operation with configurable rules and safe rate limits.

## Key features (v1)

- Multi-account management with start/stop and batch operations
- Telethon login wizard (phone → code → 2FA)
- Phase detection and action trigger patterns
- Per-account targets, blacklist, and delay overrides
- Two-step actions (Cupid) with pair selection logic
- Diagnostics snapshot (uptime + worker counts) for health checks
- System tray controls (show/hide, start/stop per account)

## Project structure

- `src/`: React UI (pages, components, hooks)
- `src-tauri/src/`: Rust backend (commands, db, workers)
- `src-tauri/src/db/`: SQLite schema + operations
- `src-tauri/src/workers/`: account worker + detection pipeline
- `telethon-worker/`: Python Telethon worker (bundled alongside the app)

## Usage

1) Launch the app
2) Add accounts via the login wizard (phone → code → 2FA)
3) Configure phase patterns and actions
4) Configure targets per account
5) Start accounts and monitor Activity Feed

## Documentation

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Building and releasing Q-Manager
- **[Testing Linux Packages](docs/TESTING_LINUX_PACKAGES.md)** - Comprehensive Linux package testing
- **[Release Template](docs/RELEASE_TEMPLATE.md)** - Template for creating release notes
- **[Contributing](CONTRIBUTING.md)** - Contribution guidelines
- **[Changelog](CHANGELOG.md)** - Version history

## Development

For GitHub releases: create a `v1.0.0` tag and a GitHub Release named `v1.0.0`. Attach installers when available.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete build and release instructions.


```bash
# UI + Tauri dev
npm run tauri dev

# Build
npm run tauri build
```

## Testing

```bash
# Rust checks
cargo check

# Tests (Linux/macOS)
cargo test
```

> On Windows, GUI-linked tests can fail due to system DLL entrypoints. Use `cargo check` instead.

## Platform Prerequisites

### Windows
- WebView2 Runtime (usually pre-installed on Windows 10/11)
- Microsoft Visual C++ Redistributable (x64)

### Linux
Required system libraries:
```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev

# Arch Linux
sudo pacman -S webkit2gtk gtk3 librsvg libappindicator-gtk3

# Fedora
sudo dnf install gtk3-devel webkit2gtk4.1-devel librsvg2-devel libappindicator-gtk3-devel
```

## Release

Current version: **1.0.0**.

Release assets are generated in `dist-release/` (installer + portable zip).

## Release scripts

```bash
npm run release
npm run release:win
npm run release:linux
npm run release:portable
npm run release:installer
```

## Author

Mahyar (Telegram: @qmahyar)

## Prerequisites

- Node.js 18+
- Rust toolchain (1.70+)
- Telethon worker built via `telethon-worker/build-telethon.{ps1,sh}` and copied by `src-tauri/build.rs`

## IDE setup

- VS Code + Tauri extension + rust-analyzer
