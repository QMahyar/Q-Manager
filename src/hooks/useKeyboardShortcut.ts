import { useEffect, useRef } from "react";

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * Parse a shortcut string like "ctrl+s" or "escape" into a KeyCombo
 */
function parseShortcut(shortcut: string): KeyCombo {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  
  return {
    key,
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd"),
  };
}

/**
 * Check if an event matches a key combo
 */
function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const key = event.key.toLowerCase();
  
  // Handle special keys
  const eventKey = key === " " ? "space" : key;
  
  return (
    eventKey === combo.key &&
    event.ctrlKey === (combo.ctrl ?? false) &&
    event.altKey === (combo.alt ?? false) &&
    event.shiftKey === (combo.shift ?? false) &&
    event.metaKey === (combo.meta ?? false)
  );
}

/**
 * Hook to register a keyboard shortcut
 * 
 * @example
 * useKeyboardShortcut("ctrl+s", handleSave);
 * useKeyboardShortcut("escape", handleClose);
 * useKeyboardShortcut("ctrl+shift+n", handleNew);
 */
export function useKeyboardShortcut(
  shortcut: string | string[],
  handler: ShortcutHandler,
  options: {
    enabled?: boolean;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    ignoreInputs?: boolean;
  } = {}
) {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    ignoreInputs = true,
  } = options;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];
  const combos = shortcuts.map(parseShortcut);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in inputs (unless explicitly allowed)
      if (ignoreInputs) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          // Allow Escape to work in inputs
          if (event.key.toLowerCase() !== "escape") {
            return;
          }
        }
      }

      // Check if any combo matches
      for (const combo of combos) {
        if (matchesCombo(event, combo)) {
          if (preventDefault) event.preventDefault();
          if (stopPropagation) event.stopPropagation();
          handlerRef.current(event);
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, preventDefault, stopPropagation, ignoreInputs, combos.map(c => JSON.stringify(c)).join(",")]);
}

/**
 * Hook to register multiple keyboard shortcuts at once
 * 
 * @example
 * useKeyboardShortcuts({
 *   "ctrl+s": handleSave,
 *   "escape": handleClose,
 *   "ctrl+n": handleNew,
 * });
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, ShortcutHandler>,
  options: {
    enabled?: boolean;
    preventDefault?: boolean;
    ignoreInputs?: boolean;
  } = {}
) {
  const { enabled = true, preventDefault = true, ignoreInputs = true } = options;

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (ignoreInputs) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          if (event.key.toLowerCase() !== "escape") {
            return;
          }
        }
      }

      for (const [shortcut, handler] of Object.entries(shortcutsRef.current)) {
        const combo = parseShortcut(shortcut);
        if (matchesCombo(event, combo)) {
          if (preventDefault) event.preventDefault();
          handler(event);
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, preventDefault, ignoreInputs]);
}

/**
 * Common keyboard shortcut constants
 */
export const SHORTCUTS = {
  SAVE: "ctrl+s",
  NEW: "ctrl+n",
  DELETE: "delete",
  ESCAPE: "escape",
  ENTER: "enter",
  SEARCH: "ctrl+f",
  REFRESH: "ctrl+r",
  SELECT_ALL: "ctrl+a",
} as const;

export default useKeyboardShortcut;
