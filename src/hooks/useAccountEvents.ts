// Hook for listening to real-time account events from the backend
import { useEffect, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { startAccount, stopAccount, startAllAccounts, stopAllAccounts } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-utils";
import { eventLogger, uiLogger } from "@/lib/logger";

// Debounce configuration
const STATUS_DEBOUNCE_MS = 150; // Debounce status updates to prevent UI thrashing
const QUERY_INVALIDATE_DEBOUNCE_MS = 750; // Debounce query invalidation for bulk status updates

// Event types matching the Rust backend
export interface AccountStatusEvent {
  account_id: number;
  status: "stopped" | "starting" | "running" | "stopping" | "error";
  message: string | null;
}

export interface PhaseDetectedEvent {
  account_id: number;
  account_name: string;
  phase_name: string;
  timestamp: string;
}

export interface ActionDetectedEvent {
  account_id: number;
  account_name: string;
  action_name: string;
  button_clicked: string | null;
  timestamp: string;
}

export interface JoinAttemptEvent {
  account_id: number;
  account_name: string;
  attempt: number;
  max_attempts: number;
  success: boolean;
  timestamp: string;
}

export interface LogEvent {
  account_id: number;
  account_name: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
}

export interface RegexValidationEvent {
  scope: string;
  pattern: string;
  error: string;
}

export interface AccountEventHandlers {
  onStatusChange?: (event: AccountStatusEvent) => void;
  onPhaseDetected?: (event: PhaseDetectedEvent) => void;
  onActionDetected?: (event: ActionDetectedEvent) => void;
  onJoinAttempt?: (event: JoinAttemptEvent) => void;
  onLog?: (event: LogEvent) => void;
  onRegexValidation?: (event: RegexValidationEvent) => void;
}

/**
 * Hook to subscribe to real-time account events from the backend.
 * Automatically invalidates account queries when status changes.
 * Uses debouncing to prevent UI thrashing from rapid status updates.
 */
export function useAccountEvents(handlers?: AccountEventHandlers) {
  const queryClient = useQueryClient();
  
  // Use refs to avoid re-subscribing when handlers change
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  
  // Debounce refs for batching updates
  const statusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryInvalidateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStatusUpdates = useRef<Map<number, AccountStatusEvent>>(new Map());

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Account status changes - with debouncing
      const unlistenStatus = await listen<AccountStatusEvent>(
        "account-status",
        (event) => {
          // Store the latest status for each account
          pendingStatusUpdates.current.set(event.payload.account_id, event.payload);
          
          // Debounce the handler calls
          if (statusDebounceRef.current) {
            clearTimeout(statusDebounceRef.current);
          }
          statusDebounceRef.current = setTimeout(() => {
            // Process all pending status updates
            pendingStatusUpdates.current.forEach((payload) => {
              eventLogger.debug("Account status update", {
                source: "useAccountEvents",
                accountId: payload.account_id,
                data: payload as unknown as Record<string, unknown>,
              });
              handlersRef.current?.onStatusChange?.(payload);
            });
            pendingStatusUpdates.current.clear();
          }, STATUS_DEBOUNCE_MS);
          
          // Debounce query invalidation separately (can be slightly longer)
          if (queryInvalidateRef.current) {
            clearTimeout(queryInvalidateRef.current);
          }
          queryInvalidateRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
          }, QUERY_INVALIDATE_DEBOUNCE_MS);
        }
      );
      unlisteners.push(unlistenStatus);

      // Phase detected
      const unlistenPhase = await listen<PhaseDetectedEvent>(
        "phase-detected",
        (event) => {
          eventLogger.info("Phase detected", {
            source: "useAccountEvents",
            accountId: event.payload.account_id,
            data: event.payload as unknown as Record<string, unknown>,
          });
          handlersRef.current?.onPhaseDetected?.(event.payload);
        }
      );
      unlisteners.push(unlistenPhase);

      // Action detected
      const unlistenAction = await listen<ActionDetectedEvent>(
        "action-detected",
        (event) => {
          eventLogger.info("Action detected", {
            source: "useAccountEvents",
            accountId: event.payload.account_id,
            data: event.payload as unknown as Record<string, unknown>,
          });
          handlersRef.current?.onActionDetected?.(event.payload);
        }
      );
      unlisteners.push(unlistenAction);

      // Join attempt
      const unlistenJoin = await listen<JoinAttemptEvent>(
        "join-attempt",
        (event) => {
          eventLogger.info("Join attempt", {
            source: "useAccountEvents",
            accountId: event.payload.account_id,
            data: event.payload as unknown as Record<string, unknown>,
          });
          handlersRef.current?.onJoinAttempt?.(event.payload);
        }
      );
      unlisteners.push(unlistenJoin);

      // Log messages
      const unlistenLog = await listen<LogEvent>("account-log", (event) => {
        eventLogger.info("Account log", {
          source: "useAccountEvents",
          accountId: event.payload.account_id,
          data: event.payload as unknown as Record<string, unknown>,
        });
        handlersRef.current?.onLog?.(event.payload);
      });
      unlisteners.push(unlistenLog);

      // Regex validation errors
      const unlistenRegex = await listen<RegexValidationEvent>("regex-validation-error", (event) => {
        uiLogger.warn("Regex validation error", {
          source: "useAccountEvents",
          data: event.payload as unknown as Record<string, unknown>,
        });
        toast.error("Invalid regex detected", {
          description: `${event.payload.scope}: ${event.payload.pattern} — ${event.payload.error}`,
        });
        handlersRef.current?.onRegexValidation?.(event.payload);
      });
      unlisteners.push(unlistenRegex);

      // Tray menu events - Start specific account
      const unlistenTrayStart = await listen<number>("tray-start-account", async (event) => {
        eventLogger.info("Tray start account", {
          source: "useAccountEvents",
          accountId: event.payload,
        });
        try {
          await startAccount(event.payload);
        } catch (err) {
          uiLogger.logError(err, "Failed to start account from tray", {
            source: "useAccountEvents",
            accountId: event.payload,
          });
          toast.error("Failed to start account", { description: getErrorMessage(err) });
        }
      });
      unlisteners.push(unlistenTrayStart);

      // Tray menu events - Stop specific account
      const unlistenTrayStop = await listen<number>("tray-stop-account", async (event) => {
        eventLogger.info("Tray stop account", {
          source: "useAccountEvents",
          accountId: event.payload,
        });
        try {
          await stopAccount(event.payload);
        } catch (err) {
          uiLogger.logError(err, "Failed to stop account from tray", {
            source: "useAccountEvents",
            accountId: event.payload,
          });
          toast.error("Failed to stop account", { description: getErrorMessage(err) });
        }
      });
      unlisteners.push(unlistenTrayStop);

      // Tray menu events - Start all accounts
      const unlistenTrayStartAll = await listen("tray-start-all", async () => {
        eventLogger.info("Tray start all accounts", { source: "useAccountEvents" });
        try {
          await startAllAccounts();
        } catch (err) {
          uiLogger.logError(err, "Failed to start all accounts from tray", {
            source: "useAccountEvents",
          });
          toast.error("Failed to start all accounts", { description: getErrorMessage(err) });
        }
      });
      unlisteners.push(unlistenTrayStartAll);

      // Tray menu events - Stop all accounts
      const unlistenTrayStopAll = await listen("tray-stop-all", async () => {
        eventLogger.info("Tray stop all accounts", { source: "useAccountEvents" });
        try {
          await stopAllAccounts();
        } catch (err) {
          uiLogger.logError(err, "Failed to stop all accounts from tray", {
            source: "useAccountEvents",
          });
          toast.error("Failed to stop all accounts", { description: getErrorMessage(err) });
        }
      });
      unlisteners.push(unlistenTrayStopAll);
    };

    setupListeners();

    // Cleanup on unmount
    return () => {
      // Clear any pending debounced calls
      if (statusDebounceRef.current) {
        clearTimeout(statusDebounceRef.current);
      }
      if (queryInvalidateRef.current) {
        clearTimeout(queryInvalidateRef.current);
      }
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [queryClient]); // Removed handlers from deps - using ref instead
}

