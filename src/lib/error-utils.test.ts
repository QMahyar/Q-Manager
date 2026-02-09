import { describe, it, expect } from 'vitest';
import { getErrorMessage, isAbortError, isNetworkError } from './error-utils';

describe('error-utils', () => {
  describe('getErrorMessage', () => {
    it('extracts message from Error object', () => {
      const error = new Error('Something went wrong');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('returns string errors as-is', () => {
      expect(getErrorMessage('Plain string error')).toBe('Plain string error');
    });

    it('extracts message from object with message property', () => {
      const error = { message: 'Object error message' };
      expect(getErrorMessage(error)).toBe('Object error message');
    });

    it('converts other types to string', () => {
      expect(getErrorMessage(42)).toBe('42');
      expect(getErrorMessage(null)).toBe('null');
      expect(getErrorMessage(undefined)).toBe('undefined');
      expect(getErrorMessage({ foo: 'bar' })).toBe('[object Object]');
    });
  });

  describe('isAbortError', () => {
    it('returns true for AbortError', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      expect(isAbortError(error)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isAbortError(new Error('Regular error'))).toBe(false);
      expect(isAbortError('string')).toBe(false);
      expect(isAbortError(null)).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('returns true for network-related errors', () => {
      expect(isNetworkError(new Error('Network error occurred'))).toBe(true);
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isNetworkError(new Error('Connection refused'))).toBe(true);
      
      const networkError = new Error('');
      networkError.name = 'NetworkError';
      expect(isNetworkError(networkError)).toBe(true);
    });

    it('returns false for non-network errors', () => {
      expect(isNetworkError(new Error('Regular error'))).toBe(false);
      expect(isNetworkError('string')).toBe(false);
      expect(isNetworkError(null)).toBe(false);
    });
  });
});
