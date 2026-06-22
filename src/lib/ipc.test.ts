import { describe, expect, it } from "vitest";
import { IPC_COMMANDS, IPC_EVENTS, type IpcCommandName, type IpcEventName } from "./ipc";

const BACKEND_COMMANDS = new Set<IpcCommandName>([
  "settings_get",
  "settings_update",
  "accounts_list",
  "account_create",
  "account_delete",
  "account_start",
  "account_stop",
  "accounts_start_all",
  "accounts_stop_all",
  "accounts_start_selected",
  "accounts_stop_selected",
  "accounts_export",
  "phases_list",
  "phase_patterns_list",
  "phase_pattern_create",
  "phase_pattern_delete",
  "phase_pattern_update",
  "phase_update_priority",
  "patterns_reload_all",
  "patterns_reload",
  "actions_list",
  "action_create",
  "action_delete",
  "action_update",
  "action_patterns_list",
  "action_pattern_create",
  "action_pattern_delete",
  "action_pattern_update",
  "phase_patterns_export",
  "phase_patterns_import",
  "action_patterns_export",
  "action_patterns_import",
  "target_defaults_get",
  "target_default_set",
  "target_override_get",
  "target_override_set",
  "target_override_delete",
  "target_overrides_list",
  "blacklist_list",
  "blacklist_add",
  "blacklist_remove",
  "delay_default_get",
  "delay_default_set",
  "delay_override_get",
  "delay_override_set",
  "delay_override_delete",
  "target_pairs_list",
  "target_pair_add",
  "target_pair_remove",
  "targets_copy",
  "account_import_preflight",
  "account_import_resolve",
  "account_export",
  "account_session_path",
  "account_get",
  "account_name_exists",
  "account_refresh_session",
  "account_update",
  "group_slots_get",
  "group_slot_update",
  "group_slots_init",
  "account_fetch_groups",
  "check_telethon_available",
  "check_telethon",
  "check_account_start",
  "check_can_login",
  "check_system",
  "diagnostics_snapshot",
  "login_check_telethon",
  "login_start",
  "login_get_state",
  "login_send_phone",
  "login_send_code",
  "login_send_password",
  "login_complete",
  "login_cancel",
]);

const BACKEND_EVENTS = new Set<IpcEventName>([
  "account-status",
  "phase-detected",
  "action-detected",
  "join-attempt",
  "account-log",
  "regex-validation-error",
  "login-progress",
  "tray-start-account",
  "tray-stop-account",
  "tray-start-all",
  "tray-stop-all",
]);

describe("IPC contract", () => {
  it("frontend commands exist in backend list", () => {
    Object.values(IPC_COMMANDS).forEach((cmd) => {
      expect(BACKEND_COMMANDS.has(cmd)).toBe(true);
    });
  });

  it("backend commands are all declared on the frontend", () => {
    const frontendCommands = new Set(Object.values(IPC_COMMANDS));
    BACKEND_COMMANDS.forEach((cmd) => {
      expect(frontendCommands.has(cmd)).toBe(true);
    });
  });

  it("frontend events exist in backend list", () => {
    Object.values(IPC_EVENTS).forEach((event) => {
      expect(BACKEND_EVENTS.has(event)).toBe(true);
    });
  });

  it("backend events are all declared on the frontend", () => {
    const frontendEvents = new Set(Object.values(IPC_EVENTS));
    BACKEND_EVENTS.forEach((event) => {
      expect(frontendEvents.has(event)).toBe(true);
    });
  });
});
