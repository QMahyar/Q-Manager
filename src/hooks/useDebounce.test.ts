import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedState } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('does not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('initial');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'update1' });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender({ value: 'update2' });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Should still be initial because timer was reset
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Now should have the final value
    expect(result.current).toBe('update2');
  });
});

describe('useDebouncedState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial values', () => {
    const { result } = renderHook(() => useDebouncedState('initial', 500));
    const [value, debouncedValue] = result.current;
    
    expect(value).toBe('initial');
    expect(debouncedValue).toBe('initial');
  });

  it('updates value immediately but debounces debouncedValue', () => {
    const { result } = renderHook(() => useDebouncedState('initial', 500));

    act(() => {
      const [, , setValue] = result.current;
      setValue('updated');
    });

    const [value, debouncedValue] = result.current;
    expect(value).toBe('updated');
    expect(debouncedValue).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const [, finalDebouncedValue] = result.current;
    expect(finalDebouncedValue).toBe('updated');
  });

  it('only updates debouncedValue with final value after rapid changes', () => {
    const { result } = renderHook(() => useDebouncedState('initial', 500));

    act(() => {
      const [, , setValue] = result.current;
      setValue('update1');
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    act(() => {
      const [, , setValue] = result.current;
      setValue('update2');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const [value, debouncedValue] = result.current;
    expect(value).toBe('update2');
    expect(debouncedValue).toBe('update2');
  });
});
