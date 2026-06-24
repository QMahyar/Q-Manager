/**
 * Transport abstraction: run the same UI as a Tauri desktop app OR as a plain
 * browser app talking to the headless `q-manager serve` web server.
 *
 * - In Tauri (a `__TAURI_INTERNALS__` global is present) we use the native IPC.
 * - In a browser we use HTTP for commands and a WebSocket for events.
 *
 * Every other module imports `invoke` / `listen` / `getVersion` / dialog helpers
 * from here instead of from `@tauri-apps/*`, so the rest of the app is unaware
 * of which mode it's running in.
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import { getVersion as tauriGetVersion } from "@tauri-apps/api/app";
import { open as tauriOpen, save as tauriSave, type OpenDialogOptions, type SaveDialogOptions } from "@tauri-apps/plugin-dialog";

/** True when running inside the Tauri desktop shell. */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ----------------------------------------------------------------------------
// invoke
// ----------------------------------------------------------------------------

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(command, args);
  }

  const res = await fetch(`/api/invoke/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });

  // Match Tauri's reject semantics: a failed command rejects with the parsed
  // backend error object ({ code, message, details }) so existing error
  // handling (getBackendError / normalizeError) works unchanged.
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = `Request failed (${res.status})`;
    }
    throw body;
  }

  // 204 / empty body → undefined; otherwise the JSON result.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ----------------------------------------------------------------------------
// events (listen)
// ----------------------------------------------------------------------------

/** Tauri-compatible event shape delivered to handlers. */
export interface TransportEvent<T> {
  event: string;
  payload: T;
  id: number;
}

type Handler = (event: TransportEvent<unknown>) => void;

const wsListeners = new Map<string, Set<Handler>>();
let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function ensureWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/api/events`);

  ws.onmessage = (msg) => {
    try {
      const { event, payload } = JSON.parse(msg.data as string);
      const handlers = wsListeners.get(event);
      if (handlers) {
        const evt: TransportEvent<unknown> = { event, payload, id: 0 };
        handlers.forEach((h) => {
          try {
            h(evt);
          } catch (err) {
            console.error(`[transport] event handler for "${event}" threw:`, err);
          }
        });
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  ws.onclose = () => {
    ws = null;
    // Reconnect while there are active listeners.
    if (wsListeners.size > 0 && !wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        ensureWebSocket();
      }, 1000);
    }
  };

  ws.onerror = () => {
    try {
      ws?.close();
    } catch {
      /* noop */
    }
  };
}

export async function listen<T>(
  event: string,
  handler: (event: TransportEvent<T>) => void,
): Promise<UnlistenFn> {
  if (isTauri) {
    return tauriListen<T>(event, handler as never);
  }

  let set = wsListeners.get(event);
  if (!set) {
    set = new Set();
    wsListeners.set(event, set);
  }
  set.add(handler as Handler);
  ensureWebSocket();

  return () => {
    const handlers = wsListeners.get(event);
    if (handlers) {
      handlers.delete(handler as Handler);
      if (handlers.size === 0) wsListeners.delete(event);
    }
  };
}

export type { UnlistenFn };

// ----------------------------------------------------------------------------
// app version
// ----------------------------------------------------------------------------

export async function getVersion(): Promise<string> {
  if (isTauri) {
    return tauriGetVersion();
  }
  try {
    const res = await fetch("/api/version");
    const data = await res.json();
    return data.version ?? "";
  } catch {
    return "";
  }
}

// ----------------------------------------------------------------------------
// file dialogs
// ----------------------------------------------------------------------------
//
// In the browser there are no native file pickers that return a filesystem
// path, but the server reads/writes paths on its own machine — so we fall back
// to prompting for a path. This keeps import/export usable when running the
// server locally. (A future upload/download flow can replace this.)

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  if (isTauri) {
    return tauriOpen(options);
  }
  const label = options?.directory ? "folder" : "file";
  const input = window.prompt(`Enter the full path to the ${label} on the machine running Q Manager:`, "");
  return input && input.trim() ? input.trim() : null;
}

export async function save(options?: SaveDialogOptions): Promise<string | null> {
  if (isTauri) {
    return tauriSave(options);
  }
  const suggested = options?.defaultPath ?? "";
  const input = window.prompt("Enter the full destination path (on the machine running Q Manager):", suggested);
  return input && input.trim() ? input.trim() : null;
}
