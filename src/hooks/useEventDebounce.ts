import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface DebouncedEventOptions {
  /** Debounce delay in milliseconds */
  delay?: number;
  /** If true, call handler immediately on first event, then debounce subsequent ones */
  leading?: boolean;
}

/**
 * Listen to a Tauri event with debouncing to prevent UI thrashing from rapid updates.
 * 
 * Useful for events like account status updates, last_seen changes, etc.
 */
export function useDebouncedEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
  options: DebouncedEventOptions = {}
): void {
  const { delay = 100, leading = false } = options;
  const handlerRef = useRef(handler);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallRef = useRef<number>(0);
  const pendingPayloadRef = useRef<T | null>(null);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        const now = Date.now();
        const payload = event.payload;

        // Leading edge: call immediately if enough time has passed
        if (leading && now - lastCallRef.current >= delay) {
          lastCallRef.current = now;
          handlerRef.current(payload);
          return;
        }

        // Store the latest payload
        pendingPayloadRef.current = payload;

        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set new timeout for trailing edge
        timeoutRef.current = setTimeout(() => {
          if (pendingPayloadRef.current !== null) {
            lastCallRef.current = Date.now();
            handlerRef.current(pendingPayloadRef.current);
            pendingPayloadRef.current = null;
          }
        }, delay);
      });
    };

    setupListener();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, delay, leading]);
}

/**
 * Listen to a Tauri event with batching - collects multiple events and delivers them as an array.
 */
export function useBatchedEvent<T>(
  eventName: string,
  handler: (payloads: T[]) => void,
  batchInterval: number = 100
): void {
  const handlerRef = useRef(handler);
  const batchRef = useRef<T[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        batchRef.current.push(event.payload);

        // Reset flush timer
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (batchRef.current.length > 0) {
            const batch = [...batchRef.current];
            batchRef.current = [];
            handlerRef.current(batch);
          }
        }, batchInterval);
      });
    };

    setupListener();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, batchInterval]);
}

/**
 * Listen to a Tauri event with throttling - ensures handler is called at most once per interval.
 */
export function useThrottledEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
  interval: number = 100
): void {
  const handlerRef = useRef(handler);
  const lastCallRef = useRef<number>(0);
  const pendingRef = useRef<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallRef.current;

        if (timeSinceLastCall >= interval) {
          // Enough time has passed, call immediately
          lastCallRef.current = now;
          handlerRef.current(event.payload);
        } else {
          // Store for later and schedule
          pendingRef.current = event.payload;

          if (!timeoutRef.current) {
            timeoutRef.current = setTimeout(() => {
              timeoutRef.current = null;
              if (pendingRef.current !== null) {
                lastCallRef.current = Date.now();
                handlerRef.current(pendingRef.current);
                pendingRef.current = null;
              }
            }, interval - timeSinceLastCall);
          }
        }
      });
    };

    setupListener();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, interval]);
}
