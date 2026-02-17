# AGENTS.md - AI Agent Guidance for Q Manager

**Last Updated:** 2026-02-18  
**Project:** Q Manager - Werewolf Game Automation  
**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Vite, Telethon (Python)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Code Organization](#code-organization)
4. [Key Patterns and Conventions](#key-patterns-and-conventions)
5. [Development Workflow](#development-workflow)
6. [Testing Strategy](#testing-strategy)
7. [Common Tasks](#common-tasks)
8. [Gotchas and Known Issues](#gotchas-and-known-issues)
9. [Security Considerations](#security-considerations)
10. [Performance Guidelines](#performance-guidelines)

---

## Project Overview

Q Manager is a desktop application for automating Werewolf game interactions on Telegram. It uses:

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4 + shadcn/ui
- **Backend:** Rust with Tauri v2 framework
- **Database:** SQLite with r2d2 connection pooling
- **External Worker:** Python Telethon for Telegram API integration
- **State Management:** TanStack React Query (no Redux/Zustand)
- **Build System:** Vite (frontend), Cargo (Rust), PyInstaller (Telethon worker)

### Core Features

1. **Multi-account management** - Run multiple Telegram accounts simultaneously
2. **Game phase detection** - Regex-based pattern matching for game states
3. **Action automation** - Automated button clicking and message responses
4. **Target selection** - Smart targeting with blacklists, overrides, and two-step actions
5. **Import/Export** - Session and pattern portability

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (Vite)                                      │
│  - Pages, Components, Hooks                                 │
│  - React Query for state                                    │
│  - Tauri IPC for backend calls                              │
└──────────────────┬──────────────────────────────────────────┘
                   │ IPC Commands/Events
┌──────────────────▼──────────────────────────────────────────┐
│  Tauri Rust Backend                                         │
│  - Commands (IPC handlers)                                  │
│  - DB Operations (SQLite + r2d2)                            │
│  - Worker Manager (Tokio runtime)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │ Spawns/Controls
┌──────────────────▼──────────────────────────────────────────┐
│  Account Workers (per-account Tokio tasks)                  │
│  - Spawn Telethon client                                    │
│  - Event polling loop                                       │
│  - Detection pipeline                                       │
│  - Action execution                                         │
└──────────────────┬──────────────────────────────────────────┘
                   │ stdin/stdout JSON
┌──────────────────▼──────────────────────────────────────────┐
│  Telethon Worker (Python subprocess)                        │
│  - Telegram MTProto client                                  │
│  - Event streaming (messages, edits)                        │
│  - Button clicking, message sending                         │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
q-manager/
├── src/                      # React frontend
│   ├── components/           # UI components (organized by domain)
│   │   ├── ui/               # shadcn primitives
│   │   ├── accounts/         # Account-specific components
│   │   ├── actions/          # Action config components
│   │   ├── targets/          # Target config components
│   │   ├── phases/           # Phase detection components
│   │   └── motion/           # Animation wrappers
│   ├── pages/                # Route-level page components
│   ├── hooks/                # Custom React hooks (data, events, utilities)
│   ├── lib/                  # Utilities, API, types, validation
│   └── test/                 # Test setup and utilities
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri IPC command handlers
│   │   ├── db/               # Database (schema, operations, pool)
│   │   ├── workers/          # Account worker logic
│   │   ├── telethon/         # Telethon client wrapper
│   │   ├── utils/            # Shared utilities (fs, debounce)
│   │   ├── events.rs         # Event emission
│   │   ├── ipc.rs            # Shared IPC command/event names
│   │   ├── validation.rs     # Input validation
│   │   └── startup_checks.rs # Pre-flight health checks
│   ├── capabilities/         # Tauri v2 permissions definitions
│   ├── tests/                # Rust integration tests
│   └── Cargo.toml
├── telethon-worker/          # Python Telethon subprocess
│   ├── telethon_worker.py    # Main worker script
│   └── build-telethon.ps1/sh # Build scripts
├── scripts/                  # Build and release automation
├── docs/                     # Documentation (deployment, testing)
└── .github/workflows/        # CI/CD pipelines
```

---

## Code Organization

### Frontend

#### Component Structure

- **Domain-driven:** Components grouped by feature (`accounts/`, `actions/`, `targets/`)
- **Shared UI:** Primitive components in `src/components/ui/` (buttons, dialogs, tables)
- **Motion:** Animation wrappers in `src/components/motion/`
- **Lazy loading:** Pages use `React.lazy` with `Suspense` fallback

#### State Management

- **Server state:** TanStack React Query
  - All backend data fetching via `useQuery`
  - Mutations via `useMutation` with cache invalidation
  - Query keys: `["settings"]`, `["accounts"]`, `["actions"]`, `["phases"]`, etc.
- **UI state:** React `useState` and Context API
  - Theme: `ThemeProvider` context
  - No global state manager (no Redux/Zustand)

#### Data Hooks

Custom hooks in `src/hooks/`:
- `useAccountsData.ts` - Account CRUD operations
- `useActionsData.ts` - Action CRUD operations
- `useTargetsData.ts` - Target config operations
- `useSettingsData.ts` - Global settings
- `useAccountEvents.ts` - Real-time event listeners

#### API Layer

- **`src/lib/api.ts`** - All Tauri IPC invocations
  - Centralized error handling with `normalizeError`
  - Retry logic for network-like errors
  - Type-safe wrappers around `invoke`

- **`src/lib/ipc.ts`** - Shared IPC command/event names
  - Must match `src-tauri/src/ipc.rs` exactly
  - Contract tested in `src/lib/ipc.test.ts`

#### Types

- **`src/lib/types.ts`** - All TypeScript types matching Rust DTOs
  - Settings, Account, Action, Phase, Target, etc.
  - Must mirror Rust serde structures exactly

### Backend

#### Commands

All Tauri IPC handlers live in `src-tauri/src/commands/`:
- `settings.rs` - Global settings CRUD
- `accounts.rs` - Account management
- `login.rs` - Login wizard orchestration
- `actions.rs` - Action/pattern CRUD
- `phases.rs` - Phase/pattern CRUD
- `targets.rs` - Target config, blacklist, delays, pairs
- `group_slots.rs` - Per-account group slot management
- `import_export.rs` - Session and pattern import/export
- `startup_checks.rs` - Pre-flight validation commands

**Command Pattern:**
```rust
#[command]
pub fn my_command(payload: MyPayload) -> CommandResult<MyResponse> {
    let conn = db::get_conn().map_err(error_response)?;
    // ... business logic
    db::do_something(&conn, &payload).map_err(error_response)
}
```

All commands return `CommandResult<T>` where `T: Serialize`.

#### Database

- **Pool:** Global `DB_POOL` (r2d2) with 10 max connections
- **Schema:** `src-tauri/src/db/schema.rs` - All table definitions
- **Operations:** `src-tauri/src/db/operations.rs` - CRUD helpers
- **Access:** Always use `db::get_conn()` to get pooled connection
- **WAL mode:** Enabled for better concurrency
- **Pragmas:** Foreign keys ON, cache 64MB, busy timeout 5s

#### Workers

- **Manager:** `src-tauri/src/workers/manager.rs`
  - Global `WORKER_MANAGER` singleton
  - Dedicated Tokio runtime (2 threads)
  - Manages worker lifecycle (start/stop/reload)

- **Account Worker:** `src-tauri/src/workers/account_worker.rs`
  - One per running account
  - Long-running async task
  - Spawns Telethon subprocess
  - Polls events, runs detection, executes actions
  - Emits Tauri events to frontend

**Worker Lifecycle:**
1. `WORKER_MANAGER.start_account(id)` validates config and spawns task
2. Worker spawns Telethon subprocess via `TelethonClient::spawn`
3. Main loop: poll events → detect → act → sleep
4. Stop signal triggers graceful shutdown
5. Worker removes itself from manager on exit

#### Telethon Integration

- **Wrapper:** `src-tauri/src/telethon/mod.rs`
  - `TelethonClient` - stdin/stdout JSON communication
  - Request/response pattern with timeouts
  - Event queue for async message streaming

- **Python Worker:** `telethon-worker/telethon_worker.py`
  - Standalone executable (PyInstaller)
  - Commands: `state`, `send_phone`, `send_code`, `send_password`, `get_dialogs`, `click_button`, etc.
  - Event streaming: new messages, edits

**Communication Protocol:**
```json
// Request (Rust → Python)
{"id": "req_uuid", "command": "click_button", "payload": {...}}

// Response (Python → Rust)
{"id": "req_uuid", "ok": true, "payload": {...}}

// Event (Python → Rust)
{"event": {"type": "message", "message": {...}}}
```

#### Events

- **Emission:** `src-tauri/src/events.rs`
  - Typed event structs (AccountStatusEvent, PhaseDetectedEvent, etc.)
  - Global emitter via `init_global_emitter`
  - Events trigger frontend re-renders and UI updates

- **Frontend Listeners:** `src/hooks/useAccountEvents.ts`
  - React hooks wrap `listen` from `@tauri-apps/api/event`
  - Auto-cleanup on unmount

#### Validation

- **Input validation:** `src-tauri/src/validation.rs`
  - Regex compilation checks
  - API credential format validation
  - Priority/delay range checks
  - Pattern JSON structure validation

- **Startup checks:** `src-tauri/src/startup_checks.rs`
  - Telethon worker availability
  - API credentials configured
  - Session directory exists
  - Database accessible

---

## Key Patterns and Conventions

### Naming Conventions

- **Rust:**
  - Snake_case for functions, variables, modules
  - PascalCase for types, structs, enums
  - SCREAMING_SNAKE_CASE for constants
  - Commands: `verb_noun` (e.g., `account_start`, `patterns_reload_all`)

- **TypeScript:**
  - camelCase for functions, variables
  - PascalCase for components, types, interfaces
  - UPPER_SNAKE_CASE for constants
  - Hooks: `use*` prefix
  - API functions: `verb + Noun` (e.g., `listAccounts`, `startAccount`)

### File Naming

- **React components:** PascalCase (e.g., `AccountsPage.tsx`, `TargetConfigDialog.tsx`)
- **Hooks:** camelCase with `.ts` (e.g., `useAccountsData.ts`)
- **Rust modules:** snake_case (e.g., `account_worker.rs`, `import_export.rs`)
- **Tests:** Same name with `.test.ts` or `_tests.rs` suffix

### Error Handling

#### Frontend

```typescript
// API calls always use normalizeError
try {
  await startAccount(accountId);
} catch (error) {
  toastError("Failed to start account", error);
}
```

#### Backend

```rust
// Commands use CommandResult and error_response
#[command]
pub fn my_command() -> CommandResult<Data> {
    let conn = db::get_conn().map_err(error_response)?;
    db::operation(&conn).map_err(error_response)
}
```

### IPC Contract

**Critical:** Frontend `IPC_COMMANDS` and `IPC_EVENTS` in `src/lib/ipc.ts` **must** match backend `src-tauri/src/ipc.rs` exactly.

- Contract test: `src/lib/ipc.test.ts`
- When adding a new command:
  1. Add to `src-tauri/src/ipc.rs`
  2. Add to `src/lib/ipc.ts`
  3. Implement command handler in `src-tauri/src/commands/`
  4. Register in `src-tauri/src/lib.rs` `invoke_handler!` macro
  5. Add frontend API wrapper in `src/lib/api.ts`
  6. Run contract test: `npm test src/lib/ipc.test.ts`

### Database Patterns

#### Schema Changes

1. Update `src-tauri/src/db/schema.rs` with new table/column
2. Database auto-migrates on app start (via `init_db`)
3. **No formal migrations** - schema is declarative with `CREATE TABLE IF NOT EXISTS`
4. For breaking changes: increment app version, document in CHANGELOG

#### CRUD Operations

- All DB operations go through `src-tauri/src/db/operations.rs`
- Use connection pool: `db::get_conn()?`
- Release locks early: `drop(conn)`
- Transactions: Use `conn.transaction()`
- Version bumps: Call `bump_phase_version` or `bump_action_version` after pattern changes

### Worker Patterns

#### Starting an Account

```rust
// Validate → Build config → Spawn task
WORKER_MANAGER.start_account(account_id).await?;
```

**Checklist before starting:**
- API credentials configured (global or per-account override)
- Session directory exists
- Telethon worker binary available
- At least one group slot enabled (warning only)

#### Stopping an Account

```rust
// Send shutdown signal → Wait for graceful exit → Cleanup
WORKER_MANAGER.stop_account(account_id).await?;
```

Timeout: 10 seconds (configurable in `constants.rs`)

#### Reloading Patterns

```rust
// Send reload signal to running worker
WORKER_MANAGER.reload_patterns(account_id).await?;
```

Workers cache patterns and only reload when signaled or version changes.

---

## Development Workflow

### Prerequisites

- **Node.js:** v20+ (for frontend)
- **Rust:** 1.70+ (for backend)
- **Python:** 3.10+ (for Telethon worker)
- **Platform-specific:**
  - Windows: MSVC toolchain
  - Linux: `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`

### Setup

```bash
# Install frontend dependencies
npm install

# Install Rust dependencies (handled by Cargo)
cd src-tauri && cargo build

# Build Telethon worker
cd telethon-worker
pip install -r requirements.txt
pyinstaller --onefile telethon_worker.py
```

### Running Dev Server

```bash
# Start Vite + Tauri dev mode
npm run dev
```

This starts:
1. Vite dev server on `http://localhost:61146`
2. Tauri window with hot-reload enabled
3. Rust backend with debug logging

### Building for Production

```bash
# Windows
npm run release:win

# Linux
npm run release:linux

# Both use scripts/build-release.ps1 or .sh
```

Build artifacts go to `dist-release/`:
- Windows: `.msi`, `.exe` (NSIS), portable `.zip`
- Linux: `.deb`, `.rpm`, `.AppImage`, portable `.tar.gz`

### Testing

#### Frontend Tests

```bash
# Run all Vitest tests
npm test

# Run with coverage
npm run test:coverage

# Check coverage threshold (70% lines)
npm run test:coverage:check
```

#### Rust Tests

```bash
# Unit tests
cd src-tauri && cargo test

# Integration tests
cargo test --test integration_tests

# Coverage (Linux only)
cargo llvm-cov
```

**Note:** Rust tests are disabled on Windows due to DLL entrypoint issues in `Cargo.toml`.

### Linting and Formatting

```bash
# Frontend
npm run lint        # ESLint check
npm run format      # Prettier write
npm run format:check # Prettier check

# Rust
cargo fmt --check   # Format check
cargo clippy        # Lint check
```

---

## Testing Strategy

### Frontend Tests

- **Unit tests:** Vitest + @testing-library/react
- **Coverage target:** 70% line coverage (enforced in CI)
- **Mock Tauri:** `src/test/setup.ts` mocks `window.__TAURI__`
- **Query utilities:** `src/test/query-test-utils.tsx` wraps components with QueryClient

**Example:**
```typescript
import { render, screen } from '@testing-library/react';
import { createWrapper } from '@/test/query-test-utils';

it('renders account list', () => {
  render(<AccountsPage />, { wrapper: createWrapper() });
  expect(screen.getByText('Accounts')).toBeInTheDocument();
});
```

### Rust Tests

- **Unit tests:** Inline `#[test]` modules
- **Integration tests:** `src-tauri/tests/integration_tests.rs`
- **Worker tests:** `src-tauri/src/workers/account_worker_tests.rs`

**Example:**
```rust
#[test]
fn test_worker_creation() {
    let config = create_test_config();
    let worker = AccountWorker::new(config.clone());
    assert_eq!(worker.account_id(), config.account_id);
}
```

### IPC Contract Test

- **Location:** `src/lib/ipc.test.ts`
- **Purpose:** Ensure frontend/backend command names match
- **Runs in:** `npm test`

### Manual Testing

- **Session import/export:** Test with real Telegram sessions
- **Worker lifecycle:** Start/stop/reload multiple accounts
- **Pattern detection:** Use real game messages or mock events
- **Login wizard:** Full flow with 2FA

---

## Common Tasks

### Adding a New IPC Command

1. **Define in shared constants:**
   ```rust
   // src-tauri/src/ipc.rs
   pub const CMD_MY_NEW_COMMAND: &str = "my_new_command";
   ```

2. **Add to frontend:**
   ```typescript
   // src/lib/ipc.ts
   export const IPC_COMMANDS = {
     // ...
     myNewCommand: "my_new_command",
   };
   ```

3. **Implement handler:**
   ```rust
   // src-tauri/src/commands/my_module.rs
   #[command]
   pub fn my_new_command(payload: MyPayload) -> CommandResult<MyResponse> {
     // implementation
   }
   ```

4. **Register in invoke_handler:**
   ```rust
   // src-tauri/src/lib.rs
   .invoke_handler(tauri::generate_handler![
     // ...
     my_new_command,
   ])
   ```

5. **Add frontend wrapper:**
   ```typescript
   // src/lib/api.ts
   export async function myNewCommand(data: MyPayload): Promise<MyResponse> {
     return invokeCommand(IPC_COMMANDS.myNewCommand, { payload: data });
   }
   ```

6. **Update contract test:**
   ```typescript
   // src/lib/ipc.test.ts
   const BACKEND_COMMANDS = new Set([
     // ...
     "my_new_command",
   ]);
   ```

### Adding a Database Table

1. **Define schema:**
   ```rust
   // src-tauri/src/db/schema.rs
   conn.execute(
     "CREATE TABLE IF NOT EXISTS my_table (
       id INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       created_at TEXT
     )",
     [],
   )?;
   ```

2. **Add operations:**
   ```rust
   // src-tauri/src/db/operations.rs
   pub fn list_my_items(conn: &Connection) -> Result<Vec<MyItem>> {
     let mut stmt = conn.prepare("SELECT * FROM my_table")?;
     // ...
   }
   ```

3. **Add TypeScript type:**
   ```typescript
   // src/lib/types.ts
   export interface MyItem {
     id: number;
     name: string;
     created_at: string | null;
   }
   ```

### Adding a New Frontend Page

1. **Create page component:**
   ```tsx
   // src/pages/MyNewPage.tsx
   export default function MyNewPage() {
     return <PageTransition><div>Content</div></PageTransition>;
   }
   ```

2. **Add route:**
   ```tsx
   // src/App.tsx
   const MyNewPage = lazy(() => import("@/pages/MyNewPage"));

   <Route path="/my-new-page" element={<MyNewPage />} />
   ```

3. **Add navigation:**
   ```tsx
   // Update sidebar/menu component
   <Link to="/my-new-page">My New Page</Link>
   ```

### Modifying Tauri Permissions

Edit `src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    {
      "identifier": "fs:scope",
      "allow": ["**/*"]
    }
  ]
}
```

**Current config:** Full filesystem access granted. Reduce scope for tighter security if needed.

---

## Gotchas and Known Issues

### Tauri-Specific

1. **CSP restrictions:** Custom fonts/images require `asset:` protocol or data URIs
2. **IPC serialization:** Complex nested types may fail; flatten where possible
3. **Window lifecycle:** Commands can fail if window is closing
4. **Single instance:** Plugin prevents multiple app instances

### Database

1. **Busy database:** WAL mode helps, but long-running transactions can still block
2. **Foreign keys:** Must be enabled per connection (done in pool init)
3. **No migrations:** Schema changes are append-only; breaking changes need version bump

### Workers

1. **Telethon timeouts:** Default 30s; long operations may timeout
2. **Event queue drops:** Telethon worker drops oldest events when queue is full (now logged to stderr)
3. **Reconnection:** Workers auto-reconnect with exponential backoff (max 5 attempts)
4. **Session locking:** Only one worker can use a session at a time

### Frontend

1. **Query stale time:** Default 0; adjust if refetching too often
2. **Lazy loading:** Suspense fallback required for `React.lazy`
3. **Theme flash:** Theme loads async; may flash default theme on first render

### Build

1. **Windows portable:** Telethon worker must be in same directory as exe
2. **Linux AppImage:** May need `--no-sandbox` flag on some distros
3. **Icon generation:** Icons must be regenerated if changed

---

## Security Considerations

### API Credentials

- **Storage:** SQLite database (cleartext)
- **Export:** Session exports include credentials in Telethon session files
- **Recommendation:** Warn users to secure exported files (implemented)

### Permissions

- **Tauri capabilities:** Currently grants full filesystem access via `fs:scope: ["**/*"]`
- **IPC:** All commands require app to be running (no external IPC)
- **CSP:** Configured in `tauri.conf.json`

### Session Security

- **Session files:** Stored in `sessions/account_{id}` or `sessions/account_{user_id}`
- **Encryption:** Telethon handles session encryption internally
- **Access:** Only app has access (no web server, no remote API)

### Input Validation

- **Frontend:** Client-side validation in forms
- **Backend:** Rust validation layer (`validation.rs`) for all user input
- **Regex:** Validated for compilation errors before storage

---

## Performance Guidelines

### Frontend

1. **Use React Query caching** - Don't refetch unnecessarily
2. **Lazy load routes** - Faster initial load
3. **Debounce user input** - Use `useDebounce` for search/filter
4. **Virtualize long lists** - Consider react-window for 100+ items

### Backend

1. **Release DB locks early** - `drop(conn)` after read
2. **Use connection pool** - Never create new connections
3. **Batch operations** - Prefer single query over multiple
4. **Index queries** - Add indexes for frequent WHERE clauses

### Workers

1. **Cache patterns** - Workers cache detection patterns; reload only on version bump
2. **Sleep on idle** - Exponential backoff when no events
3. **Limit reconnects** - Max 5 reconnect attempts before error
4. **Queue size** - Telethon event queue capped at 100

---

## Technical Deep Dives

### Tauri v2 Permissions System

**Location:** `src-tauri/capabilities/default.json`

Tauri v2 uses a capability-based permission system. Each capability defines:
- `identifier`: Unique name for the capability set
- `windows`: Which windows can use these permissions
- `permissions`: Array of permission identifiers

**Current permissions:**
```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",           // Core Tauri APIs
    "opener:default",         // Open URLs/files
    "core:tray:default",      // System tray base
    "core:tray:allow-set-icon",
    "core:tray:allow-set-menu",
    "core:tray:allow-set-tooltip",
    "dialog:default",         // File/folder dialogs
    "fs:default",             // Filesystem base
    "fs:allow-read",          // Read files
    "fs:allow-write",         // Write files
    {
      "identifier": "fs:scope",
      "allow": ["**/*"]       // Full filesystem access
    }
  ]
}
```

**Permission identifiers follow pattern:** `plugin:action` or `plugin:allow-action`

**Available fs permissions:**
- `fs:allow-read` - Read file contents
- `fs:allow-write` - Write file contents
- `fs:allow-read-dir` - List directory contents
- `fs:allow-mkdir` - Create directories
- `fs:allow-remove` - Delete files/directories
- `fs:allow-rename` - Rename/move files
- `fs:allow-copy` - Copy files
- `fs:allow-exists` - Check file existence
- `fs:allow-stat` - Get file metadata
- `fs:allow-open` - Low-level file handle
- `fs:allow-create` - Create new files
- `fs:allow-watch` - Watch for file changes

**Scoping:**
- `fs:scope` with `allow: ["**/*"]` grants access to entire filesystem
- For tighter security, scope to specific directories:
  ```json
  {
    "identifier": "fs:scope",
    "allow": [
      "$APPDATA/**/*",
      "$RESOURCE/**/*"
    ],
    "deny": [
      "$APPDATA/sensitive.txt"
    ]
  }
  ```

### React Query Configuration

**Query Client Setup:** `src/main.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,           // Data immediately stale
      refetchOnWindowFocus: true,
      retry: 1,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

**Key settings:**
- `staleTime: 0` - Always refetch on component mount (ensures fresh data)
- `refetchOnWindowFocus: true` - Refetch when window gains focus
- `retry: 1` for queries, `0` for mutations

**Query invalidation pattern:**
```typescript
const mutation = useMutation({
  mutationFn: updateSettings,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Settings saved");
  },
});
```

**Query keys structure:**
- Simple: `["settings"]`, `["accounts"]`
- With params: `["actionPatterns", actionId]`
- Nested: `["targetOverrides", accountId, actionId]`

**Best practices:**
- Always invalidate related queries after mutations
- Use `queryKey` arrays for easier invalidation
- Prefer `invalidateQueries` over manual refetch
- Use `useQuery` for reads, `useMutation` for writes

### Database Schema Details

**Connection Pool Configuration:** `src-tauri/src/db/mod.rs`

```rust
const POOL_SIZE: u32 = 10;
const POOL_MIN_IDLE: u32 = 2;
const POOL_CONNECTION_TIMEOUT_SECS: u64 = 30;
```

**SQLite Pragmas:**
```sql
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;         -- Balance safety/speed
PRAGMA foreign_keys = ON;            -- Enforce constraints
PRAGMA busy_timeout = 5000;          -- 5s lock wait
PRAGMA cache_size = -64000;          -- 64MB cache
PRAGMA temp_store = MEMORY;          -- Temp tables in RAM
PRAGMA mmap_size = 268435456;        -- 256MB memory-mapped I/O
```

**Table Relationships:**
```
settings (singleton)
  ↓
accounts
  ├── account_group_slots (FK: account_id)
  ├── target_overrides (FK: account_id, action_id)
  ├── delay_overrides (FK: account_id, action_id)
  ├── target_blacklist (FK: account_id, action_id)
  └── target_pairs (FK: account_id, action_id)

phases
  └── phase_patterns (FK: phase_id)

actions
  ├── action_patterns (FK: action_id)
  ├── target_defaults (FK: action_id)
  └── delay_defaults (FK: action_id)

pattern_versions (singleton, for cache invalidation)
```

**Index Strategy:**
- Primary keys automatically indexed
- Foreign key columns indexed: `account_id`, `phase_id`, `action_id`
- Unique constraints on: `account_name`, `action_name`, `phase_name`
- Composite indexes: `(account_id, action_id)` for overrides

**Version Bumping:**
```rust
// Increment phase_version when phase patterns change
db::bump_phase_version(&conn)?;

// Increment action_version when action patterns change
db::bump_action_version(&conn)?;
```

Workers check versions and reload patterns only when changed.

### Worker Manager Internals

**Architecture:** `src-tauri/src/workers/manager.rs`

```rust
pub struct WorkerManager {
    workers: Arc<RwLock<HashMap<i64, WorkerHandle>>>,
    worker_runtime: Arc<Runtime>,
}
```

**Dedicated Tokio Runtime:**
```rust
let worker_runtime = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(2)        // 2 OS threads
    .enable_all()             // Enable I/O and timers
    .build()?;
```

**Worker Handle:**
```rust
pub struct WorkerHandle {
    pub account_id: i64,
    pub account_name: String,
    command_tx: mpsc::Sender<WorkerCommand>,
    task_handle: tokio::task::JoinHandle<()>,
}
```

**Command Channel:**
- Unbounded MPSC channel for control messages
- Commands: `Shutdown`, `ReloadPatterns`
- Non-blocking send from manager to worker

**Worker Spawning Flow:**
1. Validate account exists in DB
2. Load settings and group slots
3. Validate API credentials
4. Check session directory
5. Build `WorkerConfig`
6. Update DB status to "starting"
7. Create command channel
8. Spawn async task in dedicated runtime
9. Task spawns Telethon client
10. Enter main event loop
11. On exit, cleanup and update status

**Graceful Shutdown:**
```rust
// Send shutdown signal
command_tx.send(WorkerCommand::Shutdown).await;

// Wait up to 10 seconds
let timeout = Duration::from_secs(10);
loop {
    if worker_removed { break; }
    if elapsed > timeout { break; }
    sleep(100ms).await;
}
```

### Telethon Client Protocol

**Request/Response Format:**

Request (Rust → Python):
```json
{
  "id": "req_550e8400-e29b-41d4-a716-446655440000",
  "command": "click_button",
  "payload": {
    "chat_id": -1001234567890,
    "message_id": 12345,
    "button_data": "abc123"
  }
}
```

Response (Python → Rust):
```json
{
  "id": "req_550e8400-e29b-41d4-a716-446655440000",
  "ok": true,
  "payload": {
    "success": true
  }
}
```

Event (Python → Rust):
```json
{
  "event": {
    "type": "message",
    "message": {
      "id": 12345,
      "chat_id": -1001234567890,
      "sender_id": 777000,
      "text": "Game starting in 5 minutes",
      "is_outgoing": false,
      "buttons": [[{"text": "Join", "type": "callback", "data": "join_123"}]]
    }
  }
}
```

**Timeout Handling:**
```rust
const TELETHON_REQUEST_TIMEOUT_MS: u64 = 30000; // 30 seconds

match rx.recv_timeout(Duration::from_millis(TELETHON_REQUEST_TIMEOUT_MS)) {
    Ok(response) => Ok(response),
    Err(RecvTimeoutError::Timeout) => {
        pending.remove(&request_id);
        Err("Telethon worker timeout")
    }
}
```

**Event Queue:**
- Python side: `asyncio.Queue(maxsize=100)`
- When full: drops oldest event, logs to stderr
- Rust side: polls via `poll_events()`, drains queue

### Pattern Detection Pipeline

**Location:** `src-tauri/src/workers/detection.rs`

**Two-phase detection:**

1. **Phase Detection:**
   - Checks message against all enabled phase patterns
   - Matches in priority order (highest first)
   - Uses regex or exact string match
   - Returns first matching phase

2. **Action Detection:**
   - For detected phase, checks enabled actions
   - Matches button text against action patterns
   - Supports two-step actions (step 0, step 1)
   - Returns action ID and matched buttons

**Caching:**
```rust
pub struct WorkerCache {
    phase_patterns: LruCache<i64, Vec<CachedPattern>>,
    action_configs: LruCache<i64, ActionConfig>,
}
```

- LRU cache with capacity 100
- Invalidated on version bump
- Shared across all workers via `Arc<WorkerCache>`

**Pattern Matching:**
```rust
if pattern.is_regex {
    let re = Regex::new(&pattern.pattern)?;
    re.is_match(text)
} else {
    text.contains(&pattern.pattern)
}
```

**Button Selection:**
1. Get all buttons from message
2. Filter by action patterns
3. Apply blacklist
4. Apply target overrides or defaults
5. Select based on rule (first, random, specific)
6. Return selected button(s)

### Event System

**Event Types:** `src-tauri/src/events.rs`

```rust
pub struct AccountStatusEvent {
    pub account_id: i64,
    pub status: String,      // "stopped", "starting", "running", "stopping", "error"
    pub error_message: Option<String>,
}

pub struct PhaseDetectedEvent {
    pub account_id: i64,
    pub phase_name: String,
    pub message_text: String,
}

pub struct ActionDetectedEvent {
    pub account_id: i64,
    pub action_name: String,
    pub selected_target: Option<String>,
}

pub struct JoinAttemptEvent {
    pub account_id: i64,
    pub attempt_number: i32,
    pub success: bool,
    pub error_message: Option<String>,
}

pub struct AccountLogEvent {
    pub account_id: i64,
    pub level: String,       // "info", "warn", "error"
    pub message: String,
}

pub struct RegexValidationEvent {
    pub pattern: String,
    pub error: String,
}
```

**Emission from Workers:**
```rust
emit_account_status(account_id, "running", None);
emit_phase_detected(account_id, "join_time", "Join the game!");
emit_action_detected(account_id, "join", Some("Player1"));
```

**Frontend Listeners:**
```typescript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('account-status', (event) => {
    const payload = event.payload as AccountStatusEvent;
    // Update UI
  });
  
  return () => { unlisten.then(fn => fn()); };
}, []);
```

### Login Flow State Machine

**States:** `src-tauri/src/telethon/login_session.rs`

```rust
pub enum AuthState {
    NotStarted,
    WaitingPhoneNumber,
    WaitingCode { phone_number: String },
    WaitingPassword { password_hint: String },
    Ready { user_id: i64, first_name: String, last_name: String, phone: String },
    Error { message: String },
    Closed,
}
```

**Transition Flow:**
```
NotStarted
    ↓ login_start()
WaitingPhoneNumber
    ↓ send_phone()
WaitingCode
    ↓ send_code()
    ├─→ WaitingPassword (if 2FA enabled)
    └─→ Ready (if no 2FA)
WaitingPassword
    ↓ send_password()
Ready
    ↓ login_complete()
[Create account in DB, move session to permanent location]
```

**Session Management:**
```
Temp location: sessions/{token}/telethon.session
Permanent location: sessions/account_{user_id}/telethon.session

On login_complete():
  1. Move temp session to permanent location
  2. Create account record in DB
  3. Cleanup temp directory
  4. Return created account
```

### Build & Release Pipeline

**CI/CD:** `.github/workflows/`

**ci.yml** (on push/PR to main/develop):
- Frontend: TypeScript check, tests, coverage check, build
- Rust: fmt check, clippy, check, test (Linux only)
- Lint: Prettier check

**coverage.yml** (on push/PR to main/develop):
- Frontend: Generate coverage, upload to Codecov, create badge
- Rust: Generate lcov, upload to Codecov

**release.yml** (on tag push `v*`):
- Create GitHub release
- Build Windows: MSI, NSIS installer, portable ZIP
- Build Linux: DEB, RPM, AppImage, portable tar.gz
- Upload all artifacts to release

**security.yml** (on push/PR + weekly):
- npm audit, cargo audit
- Dependency review (PRs only)
- CodeQL (JS + Python)
- Secret scanning (TruffleHog)
- License check

**Build Scripts:**

Windows (`scripts/build-release.ps1`):
```powershell
# Build Telethon worker
cd telethon-worker
pip install -r requirements.txt
pyinstaller --onefile telethon_worker.py

# Build Tauri app
cd ..
npm run build
cargo build --release

# Package artifacts
# MSI from target/release/bundle/msi/
# NSIS from target/release/bundle/nsis/
# Portable ZIP with exe + worker
```

Linux (`scripts/build-release.sh`):
```bash
# Build Telethon worker
cd telethon-worker
pip3 install -r requirements.txt
pyinstaller --onefile telethon_worker.py

# Build Tauri app
cd ..
npm run build
cargo build --release

# Package artifacts
# DEB from target/release/bundle/deb/
# RPM from target/release/bundle/rpm/
# AppImage from target/release/bundle/appimage/
# Portable tar.gz with binary + worker
```

### Error Handling Patterns

**Backend Error Response:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub message: String,
    pub code: Option<String>,
    pub details: Option<String>,
}

pub fn error_response<E: std::fmt::Display>(err: E) -> ErrorResponse {
    ErrorResponse {
        message: err.to_string(),
        code: None,
        details: None,
    }
}
```

**Frontend Error Handling:**
```typescript
export class ApiError extends Error {
  code?: string;
  details?: string;
}

function normalizeError(error: unknown): ApiError {
  const backendError = getBackendError(error);
  if (backendError) {
    return new ApiError(backendError.message, {
      code: backendError.code,
      details: backendError.details,
    });
  }
  return new ApiError(getErrorMessage(error));
}

// Usage
try {
  await startAccount(id);
} catch (error) {
  const normalized = normalizeError(error);
  toast.error(normalized.message);
  if (normalized.details) {
    console.error(normalized.details);
  }
}
```

**Toast Utilities:** `src/lib/toast-utils.ts`
```typescript
export function toastError(message: string, error: unknown) {
  const normalized = normalizeError(error);
  toast.error(message, {
    description: normalized.message,
    duration: 5000,
  });
}
```

### Performance Optimizations

**Database:**
- WAL mode for concurrent reads/writes
- Connection pooling (10 max, 2 min idle)
- Indexes on foreign keys
- Early lock release with `drop(conn)`
- Batch operations where possible

**Frontend:**
- Lazy route loading with `React.lazy`
- React Query caching (staleTime: 0, but caches until invalidated)
- Debounced search inputs (300ms delay)
- Memoized expensive computations
- Virtual scrolling for large lists (not yet implemented)

**Workers:**
- Pattern caching with version-based invalidation
- Exponential backoff on idle (base 100ms, max 5s)
- Event batching (drain entire queue each cycle)
- Reconnect backoff (base 1s, max 60s, 5 attempts)

**Telethon:**
- Event queue size limit (100 events)
- Drop oldest on overflow (prevents memory leak)
- Request timeout (30s)
- Reuse client connection (no reconnect per command)

### Deployment Considerations

**Portable Mode:**
- Database: `{exe_dir}/db/app.sqlite`
- Sessions: `{exe_dir}/sessions/account_{id}/`
- Telethon worker: `{exe_dir}/telethon-worker.exe`
- No installer, just unzip and run

**Installed Mode:**
- Database: Same as portable
- Sessions: Same as portable
- Telethon worker: In `resources/` subdirectory
- Auto-update support (future)

**Platform-Specific:**

Windows:
- MSVC runtime required (bundled in installer)
- Code signing recommended (not configured)
- WebView2 automatically installed
- Portable ZIP includes all dependencies

Linux:
- DEB for Debian/Ubuntu
- RPM for Fedora/RHEL
- AppImage for universal
- System dependencies: webkit2gtk, openssl
- Desktop entry created by installer

**First-Run Setup:**
1. App checks for Telethon worker
2. Initializes database
3. Creates default settings
4. Creates sessions directory
5. Shows settings page if API credentials missing

### Debugging Tips

**Frontend:**
```bash
# Open React DevTools
# Open browser DevTools (F12)
# Check React Query DevTools (bottom of app)
# View Tauri IPC calls in console
```

**Backend:**
```bash
# Run with Rust logs
RUST_LOG=debug npm run dev

# View worker logs
RUST_LOG=q_manager=debug npm run dev

# Tauri console logs
log::info!("message");
log::warn!("warning");
log::error!("error");
```

**Telethon Worker:**
```python
# Logs go to stderr
sys.stderr.write("[telethon-worker] message\n")
sys.stderr.flush()

# View in console when running dev server
```

**Database:**
```bash
# Open database with SQLite CLI
sqlite3 db/app.sqlite

# View tables
.tables

# View schema
.schema accounts

# Query data
SELECT * FROM accounts;
```

---

## Summary

This document provides a comprehensive guide for AI agents working on Q Manager. Key points:

- **Architecture:** Tauri + Rust backend, React frontend, Python Telethon worker
- **IPC Contract:** Frontend/backend command names must match exactly
- **Database:** SQLite with connection pooling; no formal migrations
- **Workers:** Per-account async tasks managed by global WorkerManager
- **Testing:** Vitest (frontend), Cargo test (Rust), coverage enforced in CI
- **Security:** API credentials in cleartext DB; session exports contain secrets

When in doubt:
- Check existing patterns in similar files
- Run tests after changes
- Validate IPC contracts
- Test worker lifecycle manually

For questions or clarifications, refer to:
- `MainPlan.md` - Original project plan
- `CONTRIBUTING.md` - Contribution guidelines
- `docs/DEPLOYMENT.md` - Release process
- `docs/TESTING_LINUX_PACKAGES.md` - Linux-specific testing

---

**End of AGENTS.md**
