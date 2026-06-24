// Tauri API wrapper functions
import { invoke } from "@/lib/transport";
import { withRetry } from "./retry";
import { apiLogger } from "./logger";
import { getBackendError, normalizeError } from "./error-utils";
import { compareStringsNatural } from "./utils";
import { IPC_COMMANDS } from "./ipc";
import type {
  Settings,
  SettingsUpdate,
  Account,
  AccountCreate,
  AccountUpdate,
  SessionRefreshResult,
  Phase,
  PhasePattern,
  PhasePatternCreate,
  PhasePatternUpdate,
  PhasePriorityUpdate,
  Action,
  ActionCreate,
  ActionPattern,
  ActionPatternCreate,
  ActionPatternUpdate,
  TargetDefault,
  TargetOverride,
  TargetBlacklist,
  DelayDefault,
  DelayOverride,
  TargetPair,
  GroupSlot,
  GroupSlotUpdate,
  DiagnosticsSnapshot,
  StartupCheckResult,
  BulkStartReport,
  ExportResult,
  ExportBatchResult,
  ExportFormat,
  ImportResult,
  ImportCandidate,
  ImportConflict,
  ImportPreflight,
  ImportAction,
  ImportResolution,
  PatternExport,
  PatternPhaseRow,
  PatternActionRow,
  PatternImportResult,
  TelegramGroup,
} from "./types";

export type {
  AccountUpdate,
  ExportFormat,
  ImportResult,
  ImportCandidate,
  ImportConflict,
  ImportPreflight,
  ImportAction,
  ImportResolution,
  PatternExport,
  PatternPhaseRow,
  PatternActionRow,
  PatternImportResult,
  GroupSlot,
  GroupSlotUpdate,
  ActionPattern,
  ActionPatternCreate,
  ActionPatternUpdate,
  PhasePatternUpdate,
  PhasePriorityUpdate,
  TelegramGroup,
};

// Check if a Tauri IPC error is worth retrying.
// Tauri errors can be plain strings or objects, not always Error instances.
function isTauriRetryableError(error: unknown): boolean {
  // Never retry deliberate backend errors (validation, not found, etc.)
  const backendError = getBackendError(error);
  if (backendError) return false;
  // Retry on transient errors: Error instances with network-like messages
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("network") ||
      msg.includes("connection") ||
      msg.includes("timeout") ||
      msg.includes("unavailable")
    );
  }
  // For string errors (raw Tauri IPC), retry on timeout/connection hints
  if (typeof error === "string") {
    const msg = error.toLowerCase();
    return msg.includes("timeout") || msg.includes("connection");
  }
  return false;
}

// Retry options for critical operations
const retryOptions = {
  maxAttempts: 3,
  initialDelay: 300,
  isRetryable: isTauriRetryableError,
  onRetry: (attempt: number, error: unknown) => {
    apiLogger.warn(`API retry attempt ${attempt}`, { data: { error } });
  },
};

// Helper for invoking with retry (for read operations and startup checks)
async function invokeWithRetry<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invokeWithRetrySafe(() => invoke<T>(cmd, args));
}

async function invokeWithRetrySafe<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    ...retryOptions,
    onRetry: (attempt: number, error: unknown) => {
      apiLogger.warn(`API retry attempt ${attempt}`, { data: { error: normalizeError(error) } });
    },
  });
}

// Helper for invoking and surfacing backend errors
export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

// ============================================================================
// Settings
// ============================================================================

export async function getSettings(): Promise<Settings> {
  return invokeWithRetry(IPC_COMMANDS.settingsGet);
}

export async function updateSettings(payload: SettingsUpdate): Promise<Settings> {
  return invokeCommand(IPC_COMMANDS.settingsUpdate, { payload });
}

// ============================================================================
// Accounts
// ============================================================================

export async function listAccounts(): Promise<Account[]> {
  const accounts = await invokeWithRetry<Account[]>(IPC_COMMANDS.accountsList);
  return [...accounts].sort((a, b) => compareStringsNatural(a.account_name, b.account_name));
}

export async function createAccount(payload: AccountCreate): Promise<Account> {
  return invokeCommand(IPC_COMMANDS.accountCreate, { payload });
}

export async function deleteAccount(accountId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.accountDelete, { accountId });
}

export async function startAccount(accountId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.accountStart, { accountId });
}

export async function stopAccount(accountId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.accountStop, { accountId });
}

export async function startAllAccounts(): Promise<BulkStartReport[]> {
  return invokeCommand(IPC_COMMANDS.accountsStartAll);
}

export async function stopAllAccounts(): Promise<void> {
  return invokeCommand(IPC_COMMANDS.accountsStopAll);
}

export async function startSelectedAccounts(accountIds: number[]): Promise<BulkStartReport[]> {
  return invokeCommand(IPC_COMMANDS.accountsStartSelected, { accountIds });
}

export async function stopSelectedAccounts(accountIds: number[]): Promise<void> {
  return invokeCommand(IPC_COMMANDS.accountsStopSelected, { accountIds });
}

// ============================================================================
// Phases
// ============================================================================

export async function listPhases(): Promise<Phase[]> {
  return invokeWithRetry(IPC_COMMANDS.phasesList);
}

export async function listPhasePatterns(phaseId: number): Promise<PhasePattern[]> {
  return invokeWithRetry(IPC_COMMANDS.phasePatternsList, { phaseId });
}

export async function createPhasePattern(payload: PhasePatternCreate): Promise<PhasePattern> {
  return invokeCommand(IPC_COMMANDS.phasePatternCreate, { payload });
}

export async function deletePhasePattern(patternId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.phasePatternDelete, { patternId });
}

export async function updatePhasePattern(payload: PhasePatternUpdate): Promise<PhasePattern> {
  return invokeCommand(IPC_COMMANDS.phasePatternUpdate, { payload });
}

export async function updatePhasePriority(payload: PhasePriorityUpdate): Promise<Phase> {
  return invokeCommand(IPC_COMMANDS.phaseUpdatePriority, { payload });
}

export async function reloadAllPatterns(): Promise<void> {
  return invokeCommand(IPC_COMMANDS.patternsReloadAll);
}

export async function reloadPatterns(accountId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.patternsReload, { accountId });
}

// ============================================================================
// Actions
// ============================================================================

export async function listActions(): Promise<Action[]> {
  return invokeWithRetry(IPC_COMMANDS.actionsList);
}

export async function createAction(payload: ActionCreate): Promise<Action> {
  return invokeCommand(IPC_COMMANDS.actionCreate, { payload });
}

export async function deleteAction(actionId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.actionDelete, { actionId });
}

// ============================================================================
// Targets
// ============================================================================

// Target Defaults (global per action)
export async function getTargetDefault(actionId: number): Promise<TargetDefault | null> {
  return invokeCommand(IPC_COMMANDS.targetDefaultsGet, { actionId });
}

export async function setTargetDefault(actionId: number, ruleJson: string): Promise<TargetDefault> {
  return invokeCommand(IPC_COMMANDS.targetDefaultSet, { actionId, ruleJson });
}

// Target Overrides (per account per action)
export async function getTargetOverride(accountId: number, actionId: number): Promise<TargetOverride | null> {
  return invokeCommand(IPC_COMMANDS.targetOverrideGet, { accountId, actionId });
}

export async function setTargetOverride(accountId: number, actionId: number, ruleJson: string): Promise<TargetOverride> {
  return invokeCommand(IPC_COMMANDS.targetOverrideSet, { accountId, actionId, ruleJson });
}

export async function deleteTargetOverride(accountId: number, actionId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.targetOverrideDelete, { accountId, actionId });
}

export async function listTargetOverrides(accountId: number): Promise<TargetOverride[]> {
  return invokeCommand(IPC_COMMANDS.targetOverridesList, { accountId });
}

// Blacklist
export async function listBlacklist(accountId: number, actionId: number): Promise<TargetBlacklist[]> {
  return invokeCommand(IPC_COMMANDS.blacklistList, { accountId, actionId });
}

export async function addBlacklistEntry(accountId: number, actionId: number, buttonText: string): Promise<TargetBlacklist> {
  return invokeCommand(IPC_COMMANDS.blacklistAdd, { accountId, actionId, buttonText });
}

export async function removeBlacklistEntry(entryId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.blacklistRemove, { entryId });
}

// Delay Defaults (global per action)
export async function getDelayDefault(actionId: number): Promise<DelayDefault | null> {
  return invokeCommand(IPC_COMMANDS.delayDefaultGet, { actionId });
}

export async function setDelayDefault(actionId: number, minSeconds: number, maxSeconds: number): Promise<DelayDefault> {
  return invokeCommand(IPC_COMMANDS.delayDefaultSet, { actionId, minSeconds, maxSeconds });
}

// Delay Overrides (per account per action)
export async function getDelayOverride(accountId: number, actionId: number): Promise<DelayOverride | null> {
  return invokeCommand(IPC_COMMANDS.delayOverrideGet, { accountId, actionId });
}

export async function setDelayOverride(accountId: number, actionId: number, minSeconds: number, maxSeconds: number): Promise<DelayOverride> {
  return invokeCommand(IPC_COMMANDS.delayOverrideSet, { accountId, actionId, minSeconds, maxSeconds });
}

export async function deleteDelayOverride(accountId: number, actionId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.delayOverrideDelete, { accountId, actionId });
}

// Target Pairs (for two-step actions like Cupid)
export async function listTargetPairs(accountId: number, actionId: number): Promise<TargetPair[]> {
  return invokeCommand(IPC_COMMANDS.targetPairsList, { accountId, actionId });
}

export async function addTargetPair(accountId: number, actionId: number, targetA: string, targetB: string): Promise<TargetPair> {
  return invokeCommand(IPC_COMMANDS.targetPairAdd, { accountId, actionId, targetA, targetB });
}

export async function removeTargetPair(pairId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.targetPairRemove, { pairId });
}

// Copy/Paste Targets
export async function copyTargets(fromAccountId: number, toAccountIds: number[], actionIds: number[]): Promise<void> {
  return invokeCommand(IPC_COMMANDS.targetsCopy, { fromAccountId, toAccountIds, actionIds });
}

// ============================================================================
// Import/Export
// ============================================================================

export async function importAccountPreflight(candidates: ImportCandidate[]): Promise<ImportPreflight> {
  return invokeCommand(IPC_COMMANDS.accountImportPreflight, { candidates });
}

export async function importAccountResolve(resolutions: ImportResolution[]): Promise<ImportResult[]> {
  return invokeCommand(IPC_COMMANDS.accountImportResolve, { resolutions });
}

export async function exportPhasePatterns(path: string): Promise<PatternExport> {
  return invokeCommand(IPC_COMMANDS.phasePatternsExport, { path });
}

export async function importPhasePatterns(path: string): Promise<PatternImportResult> {
  return invokeCommand(IPC_COMMANDS.phasePatternsImport, { path });
}

export async function exportActionPatterns(path: string): Promise<PatternExport> {
  return invokeCommand(IPC_COMMANDS.actionPatternsExport, { path });
}

export async function importActionPatterns(path: string): Promise<PatternImportResult> {
  return invokeCommand(IPC_COMMANDS.actionPatternsImport, { path });
}

export async function exportAccount(accountId: number, destPath: string, format: ExportFormat): Promise<ExportResult> {
  return invokeCommand(IPC_COMMANDS.accountExport, { accountId, destPath, format });
}

export async function exportAccounts(
  accountIds: number[],
  destPath: string,
  format: ExportFormat
): Promise<ExportBatchResult> {
  return invokeCommand(IPC_COMMANDS.accountsExport, { accountIds, destPath, format });
}

export async function getAccountSessionPath(accountId: number): Promise<string | null> {
  return invokeCommand(IPC_COMMANDS.accountSessionPath, { accountId });
}

// ============================================================================
// Account Management (additional)
// ============================================================================

export async function getAccount(accountId: number): Promise<Account | null> {
  return invokeCommand(IPC_COMMANDS.accountGet, { accountId });
}

/** Check if an account name already exists (case-insensitive) */
export async function checkAccountNameExists(name: string): Promise<boolean> {
  return invokeCommand(IPC_COMMANDS.accountNameExists, { name });
}

/**
 * Refresh an account's phone, user_id and telegram_name by querying the live Telethon session.
 * Useful after importing accounts where session validation was skipped.
 */
export async function refreshAccountSession(accountId: number): Promise<SessionRefreshResult> {
  return invokeCommand(IPC_COMMANDS.accountRefreshSession, { accountId });
}

export type { SessionRefreshResult };

export async function updateAccount(accountId: number, payload: AccountUpdate): Promise<Account> {
  // The Rust command expects a flat AccountUpdate struct with 'id' inside payload
  return invokeCommand(IPC_COMMANDS.accountUpdate, { payload: { id: accountId, ...payload } });
}

// ============================================================================
// Group Slots
// ============================================================================

export async function getGroupSlots(accountId: number): Promise<GroupSlot[]> {
  return invokeWithRetry(IPC_COMMANDS.groupSlotsGet, { accountId });
}

export async function updateGroupSlot(accountId: number, slot: number, payload: GroupSlotUpdate): Promise<GroupSlot> {
  // Backend expects all fields flat in a single GroupSlotUpdate object
  return invokeCommand(IPC_COMMANDS.groupSlotUpdate, { 
    payload: {
      account_id: accountId,
      slot,
      ...payload
    }
  });
}

export async function initGroupSlots(accountId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.groupSlotsInit, { accountId });
}

export async function fetchAccountGroups(accountId: number): Promise<TelegramGroup[]> {
  return invokeCommand(IPC_COMMANDS.accountFetchGroups, { accountId });
}

// ============================================================================
// Action Patterns (additional)
// ============================================================================

export async function listActionPatterns(actionId: number): Promise<ActionPattern[]> {
  return invokeWithRetry(IPC_COMMANDS.actionPatternsList, { actionId });
}

export async function createActionPattern(payload: ActionPatternCreate): Promise<ActionPattern> {
  return invokeCommand(IPC_COMMANDS.actionPatternCreate, { payload });
}

export async function deleteActionPattern(patternId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.actionPatternDelete, { patternId });
}

export async function updateActionPattern(payload: ActionPatternUpdate): Promise<ActionPattern> {
  return invokeCommand(IPC_COMMANDS.actionPatternUpdate, { payload });
}

export async function updateAction(payload: Action): Promise<Action> {
  return invokeCommand(IPC_COMMANDS.actionUpdate, { payload });
}

// ============================================================================
// Startup Checks
// ============================================================================

/** Quick check if Telethon worker exists */
export async function checkTelethonAvailable(): Promise<boolean> {
  return invokeWithRetry(IPC_COMMANDS.checkTelethonAvailable);
}

/** Thorough check if Telethon worker can be used */
export async function checkTelethon(): Promise<StartupCheckResult> {
  return invokeWithRetry(IPC_COMMANDS.checkTelethon);
}

/** Pre-flight check before starting an account */
export async function checkAccountStart(accountId: number): Promise<StartupCheckResult> {
  return invokeWithRetry(IPC_COMMANDS.checkAccountStart, { accountId });
}

/** Pre-flight check before starting login flow */
export async function checkCanLogin(
  apiIdOverride?: number | null,
  apiHashOverride?: string | null
): Promise<StartupCheckResult> {
  return invokeWithRetry(IPC_COMMANDS.checkCanLogin, { apiIdOverride, apiHashOverride });
}

/** System health check for app startup */
export async function checkSystem(): Promise<StartupCheckResult> {
  return invokeWithRetry(IPC_COMMANDS.checkSystem);
}

export async function getDiagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  return invokeWithRetry(IPC_COMMANDS.diagnosticsSnapshot);
}
