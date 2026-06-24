# Q Manager

[![CI](https://github.com/QMahyar/Q-Manager/actions/workflows/ci.yml/badge.svg)](https://github.com/QMahyar/Q-Manager/actions/workflows/ci.yml)
[![Release](https://github.com/QMahyar/Q-Manager/actions/workflows/release.yml/badge.svg)](https://github.com/QMahyar/Q-Manager/actions/workflows/release.yml)
[![Security](https://github.com/QMahyar/Q-Manager/actions/workflows/security.yml/badge.svg)](https://github.com/QMahyar/Q-Manager/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/QMahyar/Q-Manager)](https://github.com/QMahyar/Q-Manager/releases/latest)

Q Manager automates Werewolf/Mafia game interactions on Telegram. It runs many
accounts at once, detects game phases, and clicks the right buttons / picks
targets based on configurable patterns — with per-account rate limits, proxies,
and a spoofed connection identity to keep accounts healthy.

It ships in **two forms from the same codebase**:

| | Desktop app | Browser app (headless server) |
|---|---|---|
| **What** | Native window (Tauri) | A single binary that serves the UI over HTTP |
| **Run** | launch the app | `q-manager serve` → open the printed `http://localhost` link |
| **Best for** | Windows / macOS / Linux desktops | Headless servers, Raspberry Pi, **Termux/Android**, or driving it from your phone over the LAN |
| **Webview needed?** | yes (system WebView2/WebKitGTK) | **no** — builds and runs anywhere Rust targets |

The browser edition is one self-contained, **webview-free** binary (the UI is
embedded), so it builds for ARM/Termux where a desktop webview isn't available.
Open it from any browser on your network — including your phone — with no APK.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind v4 + shadcn/ui (base-ui)
- **Backend:** Rust + tokio + rusqlite (SQLite, WAL)
- **Desktop shell:** Tauri 2 (optional — `desktop` feature)
- **Browser server:** axum HTTP + WebSocket, embedded UI (`server` feature)
- **Telegram:** Telethon worker (Python), one subprocess per account
- **Transport:** a single frontend shim routes `invoke`/events to Tauri IPC **or**
  HTTP/WebSocket automatically, so the UI is identical in both modes.

## Key features

- Multi-account management with start/stop and batch operations
- Telethon login wizard (phone → code → 2FA)
- Phase detection + action trigger patterns (substring or regex)
- Per-account targets, blacklist, and randomized delay overrides
- Two-step actions (e.g. Cupid) with pair selection
- **Per-account proxy** — SOCKS5/SOCKS4/HTTP **and** MTProto (`mtproto://…` or a
  `tg://proxy?…` link), so accounts don't all egress from one IP
- **Connection identity (device spoofing)** — avoids the tell-tale "Telethon"
  device tag; applied at login and on start
- System tray controls (desktop) / live activity feed + LAN access (browser)

## Download

Grab the latest build from [**Releases**](https://github.com/QMahyar/Q-Manager/releases/latest):

- **Desktop installers** — Windows (`.msi`/`.exe`), macOS (`.dmg`), Linux (`.deb`/`.AppImage`)
- **Browser/server binaries** — `q-manager-<ver>-server-<platform>.{zip,tar.gz}` for
  `linux-x86_64`, `linux-aarch64`, `windows-x86_64`, `macos-x86_64`, `macos-aarch64`

### Run the browser edition

```bash
# unzip/untar, then:
./q-manager serve                 # binds 0.0.0.0:8787 by default
./q-manager serve --port 9000     # custom port
./q-manager serve --host 127.0.0.1 --port 9000
```

It prints a **Local** and a **Network** URL — open either in a browser. Keep
`q-manager` and `telethon-worker` in the same folder.

### Termux / Android

```bash
pkg install proot-distro && proot-distro install ubuntu
proot-distro login ubuntu
# inside Ubuntu: drop in the linux-aarch64 build, then:
./q-manager serve
# open http://localhost:8787 in your Android browser
```

## Build from source

Prerequisites: Node.js 18+, Rust 1.74+, Python 3.11+ (for the Telethon worker).

```bash
npm ci

# Build the Telethon worker (once)
#   Windows: telethon-worker/build-telethon.ps1 -Output dist -Clean
#   Linux/macOS: telethon-worker/build-telethon.sh --output dist --clean

# --- Desktop app ---
npm run tauri dev      # dev
npm run tauri build    # release installers

# --- Browser/server binary (webview-free) ---
npm run build          # builds the UI into dist/ (embedded by the binary)
cargo build --release --no-default-features --features server \
  --manifest-path src-tauri/Cargo.toml
./src-tauri/target/release/q-manager serve
```

> The desktop build needs a system webview; the server build does **not**.
> On Linux desktop you also need: `libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev`
> (Arch: `webkit2gtk gtk3 librsvg libappindicator-gtk3`; Fedora: the `-devel` equivalents).
> The **server** build needs none of these.

## Testing

```bash
npm test                 # frontend (vitest)
npx tsc --noEmit         # typecheck
cargo check                                   # desktop
cargo check --no-default-features --features server   # headless/Termux
```

> On Windows, GUI-linked Rust tests can fail due to system DLL entrypoints; use `cargo check`.

## Project structure

- `src/` — React UI (pages, components, hooks); `src/lib/transport.ts` is the Tauri-or-HTTP shim
- `src-tauri/src/commands/` — backend commands (shared by both modes)
- `src-tauri/src/server.rs` — axum server + command/event bridge (`server` feature)
- `src-tauri/src/db/` — SQLite schema + operations
- `src-tauri/src/workers/` — account worker + detection pipeline
- `telethon-worker/` — Python Telethon worker (bundled alongside the binary)

## Documentation

- **[Deployment Guide](docs/DEPLOYMENT.md)** — building and releasing
- **[Contributing](CONTRIBUTING.md)** — contribution guidelines
- **[Changelog](CHANGELOG.md)** — version history

## License

MIT © Mahyar (Telegram: [@qmahyar](https://t.me/qmahyar))
