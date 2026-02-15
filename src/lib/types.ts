// TypeScript types matching Rust backend DTOs

// ============================================================================
// Settings
// ============================================================================

export interface Settings {
  api_id: number | null;
  api_hash: string | null;
  main_bot_user_id: number | null;
  main_bot_username: string | null;
  beta_bot_user_id: number | null;
  beta_bot_username: string | null;
  join_max_attempts_default: number;
  join_cooldown_seconds_default: number;
  ban_warning_patterns_json: string;
  theme_mode: ThemeMode;
  theme_palette: ThemePalette;
  theme_variant: ThemeVariant;
  created_at: string | null;
  updated_at: string | null;
}

export type ThemeMode = "system" | "light" | "dark";
export type ThemePalette = "zinc" | "slate" | "gray" | "stone" | "sky" | "indigo" | "emerald" | "rose";
export type ThemeVariant = "subtle" | "vibrant" | "contrast";

export interface SettingsUpdate {
  api_id?: number | null;
  api_hash?: string | null;
  main_bot_user_id?: number | null;
  main_bot_username?: string | null;
  beta_bot_user_id?: number | null;
  beta_bot_username?: string | null;
  join_max_attempts_default?: number;
  join_cooldown_seconds_default?: number;
  ban_warning_patterns_json?: string;
  theme_mode?: ThemeMode;
  theme_palette?: ThemePalette;
  theme_variant?: ThemeVariant;
}

export interface BanWarningPattern {
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
}

// ============================================================================
// Accounts
// ============================================================================

export interface Account {
  id: number;
  account_name: string;
  telegram_name: string | null;
  phone: string | null;
  user_id: number | null;
  status: AccountStatus;
  last_seen_at: string | null;
  api_id_override: number | null;
  api_hash_override: string | null;
  join_max_attempts_override: number | null;
  join_cooldown_seconds_override: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export type AccountStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'reconnecting' | 'error';

// ============================================================================
// Startup Check Types
// ============================================================================

export interface StartupCheckError {
  code: string;
  message: string;
  details: string | null;
  is_blocking: boolean;
}

export interface StartupCheckResult {
  can_proceed: boolean;
  errors: StartupCheckError[];
}

export interface BulkStartReport {
  account_id: number;
  account_name: string;
  started: boolean;
  errors: StartupCheckError[];
}

export interface DiagnosticsSnapshot {
  timestamp_ms: number;
  uptime_ms: number;
  total_workers: number;
  running_workers: number;
}

export interface ExportResult {
  success: boolean;
  path: string;
  message: string;
}

export interface ExportBatchItem {
  account_id: number;
  account_name: string;
  success: boolean;
  message: string;
}

export interface ExportBatchResult {
  success: boolean;
  path: string;
  message: string;
  items: ExportBatchItem[];
}

export type ExportFormat = "zip" | "folder";

export interface AccountCreate {
  account_name: string;
  telegram_name?: string | null;
  phone?: string | null;
  user_id?: number | null;
  api_id_override?: number | null;
  api_hash_override?: string | null;
}

export interface GroupSlot {
  id: number;
  account_id: number;
  slot: number;
  enabled: boolean;
  group_id: number | null;
  group_title: string | null;
  moderator_kind: 'main' | 'beta';
}

// ============================================================================
// Phases
// ============================================================================

export interface Phase {
  id: number;
  name: string;
  display_name: string;
  priority: number;
}

export interface PhasePattern {
  id: number;
  phase_id: number;
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
}

export interface PhasePatternCreate {
  phase_id: number;
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
}

// ============================================================================
// Actions
// ============================================================================

export interface Action {
  id: number;
  name: string;
  button_type: ButtonType;
  random_fallback_enabled: boolean;
  is_two_step: boolean;
}

export type ButtonType = 'player_list' | 'yes_no' | 'fixed';

export interface ActionCreate {
  name: string;
  button_type: ButtonType;
  random_fallback_enabled: boolean;
  is_two_step: boolean;
}

export interface ActionPattern {
  id: number;
  action_id: number;
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
  step: number; // 0=normal, 1=triggerA, 2=triggerB
}

export interface ActionPatternCreate {
  action_id: number;
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
  step: number;
}

// ============================================================================
// Targets
// ============================================================================

export interface TargetRule {
  type: 'player_list' | 'yes_no' | 'fixed';
  targets?: string[]; // for player_list
  value?: string; // for yes_no
  button_text?: string; // for fixed
  random_fallback?: boolean;
}

export interface TargetDefault {
  id: number;
  action_id: number;
  rule_json: string;
}

export interface TargetOverride {
  id: number;
  account_id: number;
  action_id: number;
  rule_json: string;
}

export interface TargetBlacklist {
  id: number;
  account_id: number;
  action_id: number;
  button_text: string;
}

export interface DelayDefault {
  id: number;
  action_id: number;
  min_seconds: number;
  max_seconds: number;
}

export interface DelayOverride {
  id: number;
  account_id: number;
  action_id: number;
  min_seconds: number;
  max_seconds: number;
}

export interface TargetPair {
  id: number;
  account_id: number;
  action_id: number;
  order_index: number;
  target_a: string;
  target_b: string;
}

// ============================================================================
// Action Mutation Payloads (for type-safe mutations)
// ============================================================================

export interface ActionUpdate {
  id: number;
  name?: string;
  button_type?: ButtonType;
  random_fallback_enabled?: boolean;
  is_two_step?: boolean;
}

export interface ActionPatternUpdate {
  id: number;
  pattern?: string;
  is_regex?: boolean;
  enabled?: boolean;
  priority?: number;
  step?: number;
}
