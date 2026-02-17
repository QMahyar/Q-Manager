# MainPlan.md — Werewolf Automation App (Final Plan)

> Repo: `q-manager` (version 1.0.0 baseline).

This plan is derived exclusively from the finalized requirements in `agents.md`.

---

## 0) Reference folders (important)

- `shadcn-template/` (in this repo): canonical UI reference project created with shadcn CLI (preset: vega/neutral/sky + Tabler icons + Noto Sans).
- `H:\AI code\Project root\Werewolf (solo)` (external): reference implementation of automation logic (old Telethon bot). Use it to port behaviors (phase/action detection, targeting heuristics) into the new TDLib-based backend.

---

## 1) Final product scope (v1)

The app includes **only** these pages/features:
- **Accounts**
- **Phase Detection** (4 phases)
- **Actions** (global action catalog)
- **Targets** (per-account targeting + QoL copy/paste)
- **Settings**

Not included in v1:
- roles/teams
- self role detection
- other role detection
- logging UI

---

## 2) Final stack (Windows + Linux)

### 2.1 UI
- **Tauri**
- **React + Vite**
- **shadcn/ui** component system
- **shadcn Data Table** patterns for tables (no virtualization needed)
- Theme: **Light + Dark mode toggle**

UI reference:
- This repo contains `shadcn-template/` created with:
  - `npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=vega&baseColor=neutral&theme=sky&iconLibrary=tabler&font=noto-sans&menuAccent=subtle&menuColor=default&radius=default&template=vite" --template vite`
  - Project name: `shadcn-template`
- Use it as the **canonical reference** for components, styling, and configuration.

### 2.2 Backend
- Rust
- `tokio`
- `rusqlite`
- `regex`
- **TDLib** for Telegram connectivity

### 2.3 Distribution
- Provide **both**:
  - installer
  - portable zip

### 2.4 Portable layout (required)
- Single SQLite DB + all sessions live next to the executable.
- TDLib binaries are bundled in:
  - `./tdlib/` next to the executable
- TDLib account sessions live in:
  - `./sessions/<account_id>/tdlib/`

---

## 3) Navigation model (strict)

**Home-only navigation**:
- Home page shows exactly 5 buttons.
- Every page has a **Back** button returning to Home.

Home buttons:
1) Accounts
2) Phase Detection
3) Actions
4) Targets
5) Settings

---

## 4) Data + configuration scope (global vs per-account)

### 4.1 Global-only
- Phase patterns and priorities
- Action catalog and action patterns

### 4.2 Global defaults + per-account overrides
- Action Targets
- Action delays (Settings default; Targets per-account override)

### 4.3 Both global and per-account
- API ID / API Hash (global default; can be overridden per account during login flow)
- Join rules (global default; per-account override optional)

---

## 5) Core behaviors (automation)

### 5.1 Start/Stop semantics
- **Start**: full automation (connect + detect phases/actions + click)
- **Stop**: disconnect Telegram session completely

### 5.2 Delete semantics
- Delete account always removes:
  - DB record
  - session files (TDLib folder)

### 5.3 Export session
- Export supports both:
  - raw session artifact
  - zip bundle

ZIP includes:
- TDLib session folder
- config snapshot for that account (targets/delays/blacklists)

### 5.4 Import session
- File picker
- Import one session bundle at a time
- Strict validation: must connect and fetch Telegram info before saving
- Import conflicts by same user id: reject
- Import creates a full default account profile (same as Create Account):
  - account_name prompt
  - fetch telegram_name/phone/user_id during strict validation
  - initialize default group slots (disabled)
  - initialize per-account overrides empty (targets/delays/blacklists) so imported and created accounts behave identically

---

## 6) Pages and UI requirements

## 6.1 Accounts page

### Accounts table (must support)
- Columns (v1):
  - Name
  - Phone
  - UserID
  - Status
  - Start/Stop
  - Edit
  - Export
  - Delete
  - Last Seen
- Sorting
- Column resizing
- Row selection

### Batch operations (required)
- Select All
- Clear All
- Start All
- Stop All
- Start Selected
- Stop Selected

### Create account (TDLib login wizard modal)
Wizard flow:
1) enter phone
2) enter code
3) enter 2FA password (if required)

Stores:
- user-defined account name
- read-only Telegram name/phone/user_id fetched after validation

### Import account
- Pick a session bundle file (exported by this app)
- Validate it (connect + fetch user info)
- Create new account record

### Edit account
- Configure up to **2 group slots** (optional; can disable each slot)

Each slot:
- enabled toggle
- Fetch Groups button
- Group picker: list + search
- Moderator selection: Main moderator bot or Beta moderator bot

---

## 6.2 Phase Detection page (4 phases)

Phases:
- JoinTime
- Join Confirmation
- Game Start
- Game End

Patterns:
- Each phase supports 1+ patterns
- Pattern types: substring or regex (per pattern)
- Each pattern has:
  - enabled toggle
  - pattern priority

Priority:
- Phase priority + pattern priority
- Multi-match enabled: process all matches in order

JoinTime join rules:
- join with cooldown + retry attempts
- global join rule controls:
  - max attempts (default 5)
  - cooldown (default 5s)
  - stop attempts if:
    1) join confirmation received
    2) ban warning received from moderator bot
    3) game start received

---

## 6.3 Actions page (global action catalog)

Actions page contains ONLY:
- action definitions
- action trigger patterns
- button type

Action properties:
- Name
- Button type:
  - player list
  - yes/no
  - fixed button
- Random fallback enabled: ON by default per action (can disable)

Patterns:
- Each action supports 1+ patterns
- Pattern type: substring or regex
- Priority per pattern

Two-step action support (Cupid lovers):
- Action supports two trigger lists:
  - Trigger list A (target1 prompt patterns)
  - Trigger list B (target2 prompt patterns)

---

## 6.4 Targets page

Targets are per-account with global defaults.

Two views (tabs):
1) Account-first
2) Action-first

Per account + action:
- target rule:
  - player-list: ordered list of preferred names
  - non-player-list: exact button text
- blacklist:
  - per-account + per-action
  - matches button text
  - explicit target overrides blacklist
- delays:
  - per-account + per-action min/max override

Random fallback:
- ON by default per action
- if enabled and no explicit target matches: pick random allowed button (excluding blacklist)

Copy/Paste QoL:
- Copy from account
- choose selected actions
- select destination accounts (checkbox list)
- Paste overwrites

Two-step targets (Cupid):
- stored per account as ordered list of pairs (A,B)
- selection rule:
  1) cache prompt1 available buttons
  2) when prompt2 arrives, find a pair where A and B exist across both prompts
  3) if none found, pick random pair

---

## 6.5 Settings page

Settings includes:
- Global API ID / API Hash
- Moderator bots:
  - Main bot user id + optional username label
  - Beta bot user id + optional username label
- Global join rules defaults:
  - max attempts default 5
  - cooldown default 5s
- Ban warning patterns list (with explanation text):
  - if detected in moderator PMs, stop join attempts
- Default delays per action (min/max)

---

## 7) Backend architecture

### 7.1 Tauri API surface
- The React UI calls Rust via `tauri::invoke` commands.
- Rust sends async updates back to UI via Tauri events:
  - account status changes
  - last seen updates
  - join attempt counters

### 7.2 Account workers
- One tokio task per running account
- Worker responsibilities:
  - connect TDLib
  - subscribe to updates
  - filter by configured group slots + moderator bot identities
  - run detection pipeline
  - execute join/actions by clicking buttons

### 7.3 TDLib session event model (implemented)
- `TdSession` emits:
  - Ready
  - Message
  - MessageEdited (partial; caller can re-fetch message details)
  - Closed
  - Error
- Message parsing extracts:
  - `chat_id`, `sender_id`, `text`, `is_outgoing`
  - inline keyboard rows and button types

### 7.4 Detection pipeline (implemented)
Input normalized event:
- text
- chat_id
- is_private
- sender_id
- inline keyboard buttons

Processing:
1) match phases (global patterns)
2) sort matches by phase priority then pattern priority
3) execute matches in order
4) if JoinTime: attempt join respecting join rules
5) if action prompt: detect action and execute target click rules

Performance notes:
- Regex patterns are cached in a `Lazy<Mutex<HashMap>>` to avoid recompiles.
- Action patterns are only evaluated when buttons exist.

---

## 8) SQLite schema (v1 — detailed)

Single DB file in portable mode, e.g. `./db/app.sqlite`.

### 8.1 Conventions
- Use `INTEGER PRIMARY KEY` for ids.
- Use `TEXT` for strings.
- Use `INTEGER` for booleans (0/1).
- Store timestamps as ISO-8601 strings (`TEXT`) or unix epoch (`INTEGER`). Pick one and stick with it.
- Add indexes for all frequently-filtered foreign keys.

### 8.2 Tables

#### `settings` (singleton row)
Stores global configuration.
- `id` INTEGER PRIMARY KEY (always 1)
- `api_id` INTEGER NULL
- `api_hash` TEXT NULL
- `main_bot_user_id` INTEGER NULL
- `main_bot_username` TEXT NULL
- `beta_bot_user_id` INTEGER NULL
- `beta_bot_username` TEXT NULL
- `join_max_attempts_default` INTEGER NOT NULL DEFAULT 5
- `join_cooldown_seconds_default` INTEGER NOT NULL DEFAULT 5
- `ban_warning_patterns_json` TEXT NOT NULL DEFAULT '[]'
  - JSON array of objects: `{ pattern: string, is_regex: boolean, enabled: boolean, priority: number }`
  - UI note must explain: “If these messages are detected from moderator bot PMs, join attempts stop.”
- `created_at` TEXT
- `updated_at` TEXT

Indexes: none needed.

#### `accounts`
- `id` INTEGER PRIMARY KEY
- `account_name` TEXT NOT NULL            -- user-defined name
- `telegram_name` TEXT NULL               -- read-only (fetched)
- `phone` TEXT NULL
- `user_id` INTEGER NULL
- `status` TEXT NOT NULL DEFAULT 'stopped'  -- stopped | starting | running | stopping | error
- `last_seen_at` TEXT NULL
- `api_id_override` INTEGER NULL
- `api_hash_override` TEXT NULL
- `join_max_attempts_override` INTEGER NULL
- `join_cooldown_seconds_override` INTEGER NULL
- `created_at` TEXT
- `updated_at` TEXT

Indexes:
- `idx_accounts_user_id` on (`user_id`)

#### `account_group_slots`
Up to 2 rows per account (slot=1/2).
- `id` INTEGER PRIMARY KEY
- `account_id` INTEGER NOT NULL
- `slot` INTEGER NOT NULL                  -- 1 or 2
- `enabled` INTEGER NOT NULL DEFAULT 0
- `group_id` INTEGER NULL
- `group_title` TEXT NULL
- `moderator_kind` TEXT NOT NULL DEFAULT 'main'  -- main | beta

Indexes:
- `idx_group_slots_account` on (`account_id`)
- unique constraint on (`account_id`, `slot`)

#### `phases`
Global list of phases. In v1 there are 4 rows.
- `id` INTEGER PRIMARY KEY
- `name` TEXT NOT NULL UNIQUE             -- join_time | join_confirmation | game_start | game_end
- `display_name` TEXT NOT NULL            -- for UI
- `priority` INTEGER NOT NULL             -- larger = earlier

#### `phase_patterns`
Global patterns per phase.
- `id` INTEGER PRIMARY KEY
- `phase_id` INTEGER NOT NULL
- `pattern` TEXT NOT NULL
- `is_regex` INTEGER NOT NULL DEFAULT 0
- `enabled` INTEGER NOT NULL DEFAULT 1
- `priority` INTEGER NOT NULL DEFAULT 0

Indexes:
- `idx_phase_patterns_phase` on (`phase_id`)

#### `actions`
Global action catalog.
- `id` INTEGER PRIMARY KEY
- `name` TEXT NOT NULL UNIQUE
- `display_name` TEXT NOT NULL
- `button_type` TEXT NOT NULL             -- player_list | yes_no | fixed
- `random_fallback_enabled` INTEGER NOT NULL DEFAULT 1
- `is_two_step` INTEGER NOT NULL DEFAULT 0

Indexes:
- `idx_actions_name` on (`name`)

#### `action_patterns`
- `id` INTEGER PRIMARY KEY
- `action_id` INTEGER NOT NULL
- `pattern` TEXT NOT NULL
- `is_regex` INTEGER NOT NULL DEFAULT 0
- `enabled` INTEGER NOT NULL DEFAULT 1
- `priority` INTEGER NOT NULL DEFAULT 0
- `step` INTEGER NOT NULL DEFAULT 0        -- 0=normal, 1=triggerA, 2=triggerB

Indexes:
- `idx_action_patterns_action` on (`action_id`)

#### `target_defaults`
Global default target rule per action.
- `id` INTEGER PRIMARY KEY
- `action_id` INTEGER NOT NULL
- `rule_json` TEXT NOT NULL DEFAULT '{}'  -- JSON schema described below

Indexes:
- unique (`action_id`)

#### `target_overrides`
Per-account override.
- `id` INTEGER PRIMARY KEY
- `account_id` INTEGER NOT NULL
- `action_id` INTEGER NOT NULL
- `rule_json` TEXT NOT NULL DEFAULT '{}'

Indexes:
- unique (`account_id`, `action_id`)

#### `target_blacklist`
Per-account per-action blacklist entries.
- `id` INTEGER PRIMARY KEY
- `account_id` INTEGER NOT NULL
- `action_id` INTEGER NOT NULL
- `button_text` TEXT NOT NULL

Indexes:
- `idx_blacklist_account_action` on (`account_id`, `action_id`)

#### `delay_defaults`
Global per-action default delay range.
- `id` INTEGER PRIMARY KEY
- `action_id` INTEGER NOT NULL
- `min_seconds` INTEGER NOT NULL DEFAULT 2
- `max_seconds` INTEGER NOT NULL DEFAULT 8

Indexes:
- unique (`action_id`)

#### `delay_overrides`
Per-account per-action override delay range.
- `id` INTEGER PRIMARY KEY
- `account_id` INTEGER NOT NULL
- `action_id` INTEGER NOT NULL
- `min_seconds` INTEGER NOT NULL
- `max_seconds` INTEGER NOT NULL

Indexes:
- unique (`account_id`, `action_id`)

#### `target_pairs` (Cupid)
Per-account ordered pairs for a two-step action.
- `id` INTEGER PRIMARY KEY
- `account_id` INTEGER NOT NULL
- `action_id` INTEGER NOT NULL
- `order_index` INTEGER NOT NULL
- `target_a` TEXT NOT NULL
- `target_b` TEXT NOT NULL

Indexes:
- `idx_pairs_account_action` on (`account_id`, `action_id`)

### 8.3 Target Rule JSON (stored in `rule_json`)
A single JSON schema used for both defaults and overrides.

Suggested schema:
- For `button_type=player_list`:
  ```json
  { "type": "player_list", "targets": ["Alice", "Bob"], "random_fallback": true }
  ```
- For `button_type=yes_no`:
  ```json
  { "type": "yes_no", "value": "yes", "random_fallback": true }
  ```
- For `button_type=fixed`:
  ```json
  { "type": "fixed", "button_text": "Confirm", "random_fallback": false }
  ```

Note: `random_fallback` is also stored at action-level; rule-level value can override if needed.

---

## 9) Tauri API surface (detailed)

All UI↔backend calls use **Tauri IPC**:
- Frontend → backend: `invoke()` commands
- Backend → frontend: Tauri events (push updates)

Type-safety:
- Use `specta` + `tauri-specta` (or equivalent) to generate TypeScript types from Rust command signatures.

All UI↔backend calls use `tauri::invoke`.

### 9.1 Core commands

#### Settings
- `settings_get() -> SettingsDto`
- `settings_update(payload: SettingsUpdateDto) -> SettingsDto`

#### Accounts
- `accounts_list() -> Vec<AccountDto>`
- `account_create(payload: AccountCreateDto) -> AccountDto`
- `account_update(payload: AccountUpdateDto) -> AccountDto`
- `account_delete(account_id: i64) -> ()`
- `account_export_raw(account_id: i64, dest_path: String) -> ()`
- `account_export_zip(account_id: i64, dest_path: String) -> ()`
- `account_import_zip(file_path: String) -> AccountDto`
  - Import accepts exactly **one** session bundle file per import operation.

#### Group slots
- `account_group_slots_get(account_id: i64) -> Vec<GroupSlotDto>`
- `account_group_slot_update(payload: GroupSlotUpdateDto) -> GroupSlotDto`

#### Fetch groups/supergroups (requires account running and logged in)
- `account_fetch_groups(account_id: i64) -> Vec<GroupDto>`

#### Phases
- `phases_list() -> Vec<PhaseDto>`
- `phase_update_priority(phase_id: i64, priority: i32) -> PhaseDto`
- `phase_patterns_list(phase_id: i64) -> Vec<PhasePatternDto>`
- `phase_pattern_create(payload: PhasePatternCreateDto) -> PhasePatternDto`
- `phase_pattern_update(payload: PhasePatternUpdateDto) -> PhasePatternDto`
- `phase_pattern_delete(pattern_id: i64) -> ()`

#### Actions
- `actions_list() -> Vec<ActionDto>`
- `action_create(payload: ActionCreateDto) -> ActionDto`
- `action_update(payload: ActionUpdateDto) -> ActionDto`
- `action_delete(action_id: i64) -> ()`
- `action_patterns_list(action_id: i64) -> Vec<ActionPatternDto>`
- `action_pattern_create(payload: ActionPatternCreateDto) -> ActionPatternDto`
- `action_pattern_update(payload: ActionPatternUpdateDto) -> ActionPatternDto`
- `action_pattern_delete(pattern_id: i64) -> ()`

#### Targets
- `targets_get_for_account(account_id: i64) -> AccountTargetsDto`
- `targets_get_for_action(action_id: i64) -> ActionTargetsDto`
- `target_default_set(action_id: i64, rule_json: String) -> ()`
- `target_override_set(account_id: i64, action_id: i64, rule_json: String) -> ()`
- `blacklist_add(account_id: i64, action_id: i64, button_text: String) -> ()`
- `blacklist_remove(blacklist_id: i64) -> ()`
- `delay_default_set(action_id: i64, min_seconds: i32, max_seconds: i32) -> ()`
- `delay_override_set(account_id: i64, action_id: i64, min_seconds: i32, max_seconds: i32) -> ()`
- `target_pairs_list(account_id: i64, action_id: i64) -> Vec<PairDto>`
- `target_pair_add(account_id: i64, action_id: i64, target_a: String, target_b: String) -> ()`
- `target_pair_remove(pair_id: i64) -> ()`

#### Copy/Paste targets (QoL)
- `targets_copy(source_account_id: i64, action_ids: Vec<i64>) -> CopiedTargetsDto`
- `targets_paste(copied: CopiedTargetsDto, dest_account_ids: Vec<i64>) -> ()`  -- overwrite

### 9.2 Runtime control commands
- `account_start(account_id: i64) -> ()`
- `account_stop(account_id: i64) -> ()`
- `accounts_start_all() -> ()`
- `accounts_stop_all() -> ()`
- `accounts_start_selected(account_ids: Vec<i64>) -> ()`
- `accounts_stop_selected(account_ids: Vec<i64>) -> ()`

### 9.3 Events (backend -> UI)
Use `app.emit_all` or per-window emit.
- `account_status_changed` { account_id, status }
- `account_last_seen_updated` { account_id, last_seen_at }
- `account_error` { account_id, message }
- `join_attempt_updated` { account_id, attempts, cooldown_until }

---

## 10) Frontend implementation details (React + shadcn)

### 10.1 State management
- Keep it minimal:
  - `@tanstack/react-query` for server state caching (recommended)
  - or a simple custom hook + `invoke()` calls if you want fewer deps

### 10.2 Home page
- 5 large buttons (shadcn `Button` + `Card`)

### 10.3 Accounts page
- shadcn Data Table:
  - sortable columns
  - resizable columns
  - row selection checkboxes
- Batch operation buttons in a toolbar.
- Row actions:
  - Start/Stop
  - Edit
  - Export (dropdown: raw/zip)
  - Delete (confirm dialog)
- Create/Import buttons:
  - Create triggers TDLib login wizard modal
  - Import triggers file picker

### 10.4 Login wizard modal (Create account)
- Step UI with shadcn `Dialog`, `Input`, `Button`, `Alert`.
- Backend exposes TDLib auth state; UI shows next required input.

### 10.5 Phase Detection page
- Tabs for 4 phases (shadcn `Tabs`)
- Pattern table per tab
- Add/Edit pattern modal
- Priority editor: simple numeric field or drag-and-drop later

### 10.6 Actions page
- Actions list table
- Action editor form
- Patterns editor
- Two-step toggle reveals Trigger A/B pattern lists

### 10.7 Targets page
- Two tabs:
  - Account-first
  - Action-first
- Editor widgets:
  - player-list targets: tag input / ordered list
  - non-player: single input
  - blacklist: list + add/remove
  - delays: min/max number inputs
- Copy/paste panel:
  - choose source account
  - choose actions
  - choose destinations (checkbox list)
  - paste overwrite confirmation
- Cupid pair editor:
  - table of pairs with add/remove

### 10.8 Settings page
- Forms:
  - API ID/hash
  - bot user IDs + optional usernames
  - join rules defaults
  - ban warning patterns list editor
  - default delays per action

---

## 11) TDLib integration details (backend)

**Proxy/VPN:** Not supported in v1 (no proxy configuration UI).

### 11.1 Loading TDLib
- On startup, validate `./tdlib/` exists.
- Load correct dynamic lib per OS.

### 11.2 Auth state machine (Create account wizard)
TDLib typically exposes auth states similar to:
- WaitTdlibParameters
- WaitPhoneNumber
- WaitCode
- WaitPassword
- Ready

Implement a per-account login session object that:
- creates a TDLib client
- drives auth until `Ready`
- then persists session to `./sessions/<account_id>/tdlib/`

### 11.3 Fetch groups
- After login (Ready), call TDLib to list chats.
- Filter to groups/supergroups.
- Return list to UI (id + title + type).

### 11.4 Receiving messages and inline buttons
- Subscribe to updates.
- Normalize incoming messages into the event model.
- Extract inline keyboard buttons:
  - button text
  - callback payload
  - url (if present)

### 11.5 Clicking buttons
- For URL buttons: parse `/start` parameter and send message to bot.
- For callback buttons: send callback query via TDLib.

---

## 12) Context7 Stack Notes (practical implementation guidance)

This section captures the key “how-to” details from Context7-style docs for our chosen stack, to reduce guesswork during implementation.

### 12.1 Tauri (commands, events, bundling resources)

#### Recommended Tauri plugins (v1)
**Required for v1 UX**
- `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog`
  - For file picker (Import/Export paths) and confirmation dialogs.
- `@tauri-apps/plugin-fs` / `tauri-plugin-fs`
  - For reading/writing session bundles and portable folder operations.

**Required desktop UX (your requirements)**
- `tauri-plugin-single-instance`
  - Ensures only one instance runs; second launch focuses the existing window.
- `tauri-plugin-tray`
  - System tray icon with menu:
    - Show/Hide
    - Start ▶ submenu listing stopped accounts (click to start)
    - Stop ■ submenu listing running accounts (click to stop)
    - Exit

**Optional but recommended**
- `tauri-plugin-updater`
  - Recommended if you plan frequent releases.

**Developer tools**
- DevTools is built-in/available in dev mode; no special plugin required.

---

- Frontend calls Rust via `invoke`:
  - Example usage: `invoke('command_name', { args... })`.
- Backend emits events to frontend:
  - Use `app.emit_all("event-name", payload)` or `emit_filter` to target specific windows.
- Bundling native resources (TDLib binaries) in Tauri:
  - Tauri supports bundling resources in `tauri.conf.json` under `bundle.resources`.
  - We should bundle `./tdlib/**` so packaged builds include TDLib in the portable layout.
- Build hooks:
  - `tauri.conf.json` supports `beforeDevCommand` and `beforeBuildCommand` to run Vite.

### 12.2 shadcn/ui (React+Vite) theme + dark mode + recommended frontend packages

**Theme**
- Use the shadcn Vite ThemeProvider pattern (store theme in `localStorage`, toggle `document.documentElement` class).
- Provide a Mode Toggle button (Light/Dark/System) using shadcn `DropdownMenu` + `Button`.

**Recommended frontend packages (pragmatic + common with shadcn)**
- Icons: `lucide-react`
- Toasts/notifications (optional but useful for “Saved”, “Error”, etc.): shadcn `sonner` component
- Forms:
  - Minimal: controlled inputs with React state
  - Recommended when forms grow: `react-hook-form` + `zod` (or TanStack Form)
    - Use `zod` schemas for consistent validation (e.g., API ID must be integer, cooldown must be >= 0, etc.).
- Server-state data fetching/caching:
  - Recommended: `@tanstack/react-query`
    - Use it to cache: accounts list, settings, actions, phase patterns.
    - Refetch after mutations (create/update/delete) for a responsive UI.

**Why it matters for this app**
- Accounts/Targets pages do many CRUD operations; React Query reduces state bugs.
- Settings and pattern editors benefit from Zod validation to prevent invalid configs being saved.

### 12.2.1 Icons / symbols (UI)

**Icon set:** `lucide-react` (literal icons)
- We will use *literal* icons (Play = Start, Square = Stop, etc.) to avoid ambiguity.

#### Icon Map (v1)

> This is the source-of-truth mapping for UI icons.

##### Home buttons
| Page | Label | Lucide icon |
|---|---|---|
| Accounts | Accounts | `Users` |
| Phase Detection | Phase Detection | `ListChecks` |
| Actions | Actions | `MousePointerClick` |
| Targets | Targets | `Target` |
| Settings | Settings | `Settings` |

##### Accounts page toolbar
| Action | Lucide icon |
|---|---|
| Create Account | `UserPlus` |
| Import Account | `Upload` |
| Export (toolbar if any) | `Download` |
| Select All | `CheckSquare` |
| Clear All | `XSquare` |
| Start Selected / Start All | `Play` |
| Stop Selected / Stop All | `Square` |

##### Accounts row actions
| Action | Lucide icon |
|---|---|
| Start | `Play` |
| Stop | `Square` |
| Edit | `Pencil` |
| Export raw/zip | `Download` |
| Delete | `Trash2` |

##### General CRUD buttons
| Action | Lucide icon |
|---|---|
| Add | `Plus` |
| Remove | `Minus` (or `Trash2` when destructive) |
| Save | `Save` |
| Cancel | `X` |
| Back | `ArrowLeft` |
| Search | `Search` |

##### Targets QoL
| Action | Lucide icon |
|---|---|
| Copy | `Copy` |
| Paste | `ClipboardPaste` |

##### Phase/Action pattern editors
| Action | Lucide icon |
|---|---|
| Add pattern | `Plus` |
| Edit pattern | `Pencil` |
| Delete pattern | `Trash2` |
| Enable/Disable | `ToggleLeft` / `ToggleRight` (or use shadcn `Switch`) |

**App/window icon (installer icon):**
- Separate from UI icons.
- We’ll provide app icons as files:
  - Windows: `.ico`
  - Linux: `.png` (multiple sizes)
  - (Tauri supports bundling these via config)

---

### 12.3 shadcn Data Table (built on TanStack Table)
shadcn Data Table examples are typically implemented with `@tanstack/react-table`: 
- Sorting state: `SortingState` + `onSortingChange`.
- Row selection: `rowSelection` state + `onRowSelectionChange`.
- Filtering and column visibility can be added later.

Row selection column pattern (checkboxes):
- Header checkbox toggles select-all for page rows.
- Row checkbox toggles selection per row.

### 12.4 TanStack Table column resizing
TanStack Table supports controlled column sizing:
- Maintain `columnSizing` state and pass to `useReactTable({ state: { columnSizing }, onColumnSizingChange })`.
- Use `columnResizeMode` (`onChange` or `onEnd`).
- Use `header.getResizeHandler()` on a resize handle element.

This aligns with your requirement: **column resizing** in Accounts table.

### 12.5 rusqlite (SQLite access)
- For app-owned SQLite databases, enabling `rusqlite` with feature `bundled` is commonly recommended to avoid dependency on system SQLite versions.
- Use prepared statements + transactions.
- Concurrency: `rusqlite::Connection` is not async; don’t block the async runtime.
  - Run DB work on a dedicated thread / pool, or use `tokio::task::spawn_blocking` for DB operations.

### 12.5.1 Recommended Rust backend crates (pragmatic)
These are not features by themselves; they reduce boilerplate and improve reliability.

**Error handling**
- `anyhow` (application-level errors)
- `thiserror` (typed errors for TDLib/DB layers)

**Serialization & config**
- `serde`, `serde_json`

**Filesystem + bundling**
- `walkdir` (recursive directory copy/export)
- `zip` (zip export/import)

**Time + ids**
- `time` or `chrono` (timestamps for last_seen, created_at)
- `uuid` (optional) if we ever want stable IDs for exports

**Caching / performance**
- `once_cell` (cache compiled regexes / RegexSet)

**Async helpers**
- `tokio-util` (optional: if we need codecs or helpers)

---

### 12.6 tokio (workers + blocking separation)
- Use `tokio::spawn` for per-account workers.
- Use `tokio::task::spawn_blocking` for blocking code (SQLite operations, filesystem zipping, some TDLib FFI waiting loops if needed).
- Use channels (`tokio::sync::mpsc`, `watch`) to propagate state changes to the Tauri event emitter.

### 12.7 regex (performance and caching)
- Compile regex patterns once and reuse them.
- Use `once_cell::sync::Lazy` for static regexes.
- For matching many patterns efficiently, consider `RegexSet` (one-pass match across many patterns). This is relevant for phase/action pattern sets.

### 12.8 TDLib (auth + updates + inline keyboards)
- TDLib requires an auth state machine:
  - wait parameters → wait phone → wait code → wait password → ready
- Once authorized, fetch chats and receive updates.
- Inline keyboards:
  - buttons can be URL buttons (join links) or callback buttons.
  - For callback buttons, send callback query type requests.

---

## 13) Implementation milestones (step-by-step)

(Each milestone is a checklist with acceptance criteria.)

### Milestone 0 — Repo scaffolding (acceptance)
- App runs and shows Home page.
- `./db/`, `./sessions/`, `./tdlib/` paths are created/validated.

### Milestone 1 — DB + core models (acceptance)
- DB schema is created automatically.
- UI can call `settings_get` successfully.

### Milestone 2 — UI shell + theme (acceptance)
- Home-only navigation works.
- Dark/light toggle works.

### Milestone 3 — Accounts (acceptance)
- Accounts table supports sorting/resizing/selection.
- Batch ops buttons exist and call backend.
- Create/import/export/delete buttons exist.

### Milestone 4 — Phase Detection (acceptance)
- User can add/edit/delete patterns.
- Priorities are persisted.

### Milestone 5 — Actions (acceptance)
- User can add/edit/delete actions.
- User can add patterns, set button type, enable random fallback.
- Two-step config exists.

### Milestone 6 — Targets (acceptance)
- Two views exist.
- Targets, blacklist, delays editable.
- Copy/paste workflow works.
- Cupid pairs editable.

### Milestone 7 — TDLib (acceptance)
- Login wizard produces a working session.
- Fetch groups works.

### Milestone 8 — Automation (acceptance)
- JoinTime works.
- Join confirmation and game start/end state transitions work.
- Actions auto-click according to targets.
- Ban-warning patterns stop join attempts.
- Cupid two-step works.

### Milestone 9 — Packaging (acceptance)
- Installer + portable zip produced for Windows.
- Installer + portable zip produced for Linux.
- Both include `./tdlib/`.

---

## 13) Done criteria (v1)
Everything in Milestones 0–9 acceptance is met.

---

## 14) Non-goals / guardrails
- No generic DB browser UI in v1.
- No role detection pages.
- No logging UI.
