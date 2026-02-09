import { describe, it, expect, vi } from 'vitest';
import { withRetry, isNetworkError, makeRetryable } from './retry';

describe('retry utilities', () => {
  describe('withRetry', () => {
    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      const result = await withRetry(fn, { maxAttempts: 3, onRetry, initialDelay: 5 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
    }, 1000);

    it('throws after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      
      await expect(
        withRetry(fn, { maxAttempts: 2, initialDelay: 5 })
      ).rejects.toThrow('always fails');
      
      expect(fn).toHaveBeenCalledTimes(2);
    }, 1000);

    it('respects isRetryable option', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));
      
      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          isRetryable: () => false,
          initialDelay: 5,
        })
      ).rejects.toThrow('non-retryable');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback', async () => {
      const error = new Error('test error');
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      await withRetry(fn, { 
        maxAttempts: 3, 
        onRetry,
        initialDelay: 5
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry.mock.calls[0][0]).toBe(1); // attempt number
      expect(onRetry.mock.calls[0][1]).toBe(error); // error
    }, 1000);

    it('uses default options when none provided', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
    });
  });

  describe('isNetworkError', () => {
    it('returns true for network-related errors', () => {
      expect(isNetworkError(new Error('Network error'))).toBe(true);
      expect(isNetworkError(new Error('Connection refused'))).toBe(true);
      expect(isNetworkError(new Error('Request timeout'))).toBe(true);
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isNetworkError(new Error('ENOTFOUND'))).toBe(true);
    });

    it('returns false for non-network errors', () => {
      expect(isNetworkError(new Error('Validation failed'))).toBe(false);
      expect(isNetworkError(new Error('Not found'))).toBe(false);
      expect(isNetworkError(new Error('Permission denied'))).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isNetworkError('string error')).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
      expect(isNetworkError({ message: 'Network error' })).toBe(false);
    });
  });

  describe('makeRetryable', () => {
    it('creates a retryable function', async () => {
      const originalFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const retryableFn = makeRetryable(originalFn, { maxAttempts: 2, initialDelay: 5 });
      const result = await retryableFn('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    }, 1000);

    it('passes arguments correctly', async () => {
      const originalFn = vi.fn().mockResolvedValue('result');
      const retryableFn = makeRetryable(originalFn);
      
      await retryableFn(1, 'two', { three: 3 });
      
      expect(originalFn).toHaveBeenCalledWith(1, 'two', { three: 3 });
    });
  });
});
