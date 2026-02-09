/**
 * Accessibility utilities for Q Manager
 * 
 * Provides helpers for ARIA attributes, focus management, and keyboard navigation.
 */

import { useCallback, useEffect, useRef } from 'react';

// ============================================================================
// ARIA Helpers
// ============================================================================

/**
 * Generate a unique ID for ARIA relationships
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Create ARIA props for a loading state
 */
export function ariaLoading(isLoading: boolean) {
  return {
    'aria-busy': isLoading,
    'aria-live': 'polite' as const,
  };
}

/**
 * Create ARIA props for an expanded/collapsed element
 */
export function ariaExpanded(isExpanded: boolean, controlsId?: string) {
  return {
    'aria-expanded': isExpanded,
    ...(controlsId && { 'aria-controls': controlsId }),
  };
}

/**
 * Create ARIA props for a selected item
 */
export function ariaSelected(isSelected: boolean) {
  return {
    'aria-selected': isSelected,
  };
}

/**
 * Create ARIA props for describing an element
 */
export function ariaDescribedBy(...ids: (string | undefined)[]) {
  const validIds = ids.filter(Boolean);
  return validIds.length > 0
    ? { 'aria-describedby': validIds.join(' ') }
    : {};
}

/**
 * Create ARIA props for labeling an element
 */
export function ariaLabelledBy(...ids: (string | undefined)[]) {
  const validIds = ids.filter(Boolean);
  return validIds.length > 0
    ? { 'aria-labelledby': validIds.join(' ') }
    : {};
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Focus trap hook - keeps focus within a container (useful for modals)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element
    const focusableElements = getFocusableElements(containerRef.current);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous element
      previousFocusRef.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to manage focus on mount
 */
export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    // Small delay to ensure element is rendered
    const timer = setTimeout(() => {
      ref.current?.focus();
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  return ref;
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

export type KeyboardHandler = (event: KeyboardEvent) => void;

export interface KeyboardHandlers {
  onEnter?: KeyboardHandler;
  onEscape?: KeyboardHandler;
  onArrowUp?: KeyboardHandler;
  onArrowDown?: KeyboardHandler;
  onArrowLeft?: KeyboardHandler;
  onArrowRight?: KeyboardHandler;
  onTab?: KeyboardHandler;
  onSpace?: KeyboardHandler;
  onHome?: KeyboardHandler;
  onEnd?: KeyboardHandler;
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation(handlers: KeyboardHandlers) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const keyHandlers: Record<string, KeyboardHandler | undefined> = {
        Enter: handlers.onEnter,
        Escape: handlers.onEscape,
        ArrowUp: handlers.onArrowUp,
        ArrowDown: handlers.onArrowDown,
        ArrowLeft: handlers.onArrowLeft,
        ArrowRight: handlers.onArrowRight,
        Tab: handlers.onTab,
        ' ': handlers.onSpace,
        Home: handlers.onHome,
        End: handlers.onEnd,
      };

      const handler = keyHandlers[event.key];
      if (handler) {
        handler(event.nativeEvent);
      }
    },
    [handlers]
  );

  return { onKeyDown: handleKeyDown };
}

/**
 * Hook for roving tabindex pattern (for lists, menus, etc.)
 */
export function useRovingTabIndex<T extends HTMLElement>(
  items: T[],
  initialIndex: number = 0
) {
  const currentIndexRef = useRef(initialIndex);

  const setCurrentIndex = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    currentIndexRef.current = clampedIndex;
    items[clampedIndex]?.focus();
  }, [items]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          setCurrentIndex(currentIndexRef.current + 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          setCurrentIndex(currentIndexRef.current - 1);
          break;
        case 'Home':
          event.preventDefault();
          setCurrentIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setCurrentIndex(items.length - 1);
          break;
      }
    },
    [items.length, setCurrentIndex]
  );

  return {
    currentIndex: currentIndexRef.current,
    setCurrentIndex,
    handleKeyDown,
    getTabIndex: (index: number) => (index === currentIndexRef.current ? 0 : -1),
  };
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  
  document.body.appendChild(announcement);
  
  // Delay to ensure screen reader picks it up
  setTimeout(() => {
    announcement.textContent = message;
  }, 100);
  
  // Clean up after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Hook for announcing status changes
 */
export function useAnnounce() {
  return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announce(message, priority);
  }, []);
}
