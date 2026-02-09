// Login wizard API functions
import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "./ipc";
import { getBackendError, getErrorMessage } from "./error-utils";

async function invokeLogin<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    const backendError = getBackendError(error);
    if (backendError) {
      const details = backendError.details ? `\n${backendError.details}` : "";
      const code = backendError.code ? `[${backendError.code}] ` : "";
      throw new Error(`${code}${backendError.message ?? "Unknown error"}${details}`);
    }
    throw new Error(getErrorMessage(error));
  }
}

// Auth state types matching Rust backend
export type AuthState = 
  | { state: "not_started" }
  | { state: "waiting_phone_number" }
  | { state: "waiting_code"; phone_number: string }
  | { state: "waiting_password"; password_hint: string }
  | { state: "ready"; user_id: number; first_name: string; last_name: string; phone: string }
  | { state: "error"; message: string }
  | { state: "closed" };

export interface LoginStartResult {
  token: string;
  state: AuthState;
}

export interface Account {
  id: number;
  account_name: string;
  telegram_name: string | null;
  phone: string | null;
  user_id: number | null;
  status: string;
}

// Check if Telethon worker is available
export async function checkTelethon(): Promise<boolean> {
  return invokeLogin(IPC_COMMANDS.loginCheckTelethon);
}

// Start login session
export async function loginStart(apiId?: number, apiHash?: string): Promise<LoginStartResult> {
  return invokeLogin(IPC_COMMANDS.loginStart, { apiId, apiHash });
}

// Get current login state
export async function loginGetState(token: string): Promise<AuthState> {
  return invokeLogin(IPC_COMMANDS.loginGetState, { token });
}

// Send phone number
export async function loginSendPhone(token: string, phone: string): Promise<AuthState> {
  return invokeLogin(IPC_COMMANDS.loginSendPhone, { token, phone });
}

// Send verification code
export async function loginSendCode(token: string, code: string): Promise<AuthState> {
  return invokeLogin(IPC_COMMANDS.loginSendCode, { token, code });
}

// Send 2FA password
export async function loginSendPassword(token: string, password: string): Promise<AuthState> {
  return invokeLogin(IPC_COMMANDS.loginSendPassword, { token, password });
}

// Complete login and create account
export async function loginComplete(
  token: string,
  accountName: string,
  apiIdOverride?: number | null,
  apiHashOverride?: string | null
): Promise<Account> {
  return invokeLogin(IPC_COMMANDS.loginComplete, { token, accountName, apiIdOverride, apiHashOverride });
}

// Cancel login
export async function loginCancel(token: string): Promise<void> {
  return invokeLogin(IPC_COMMANDS.loginCancel, { token });
}
