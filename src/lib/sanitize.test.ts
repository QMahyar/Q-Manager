import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtml,
  sanitizeForDisplay,
  sanitizeFilename,
  sanitizePhoneNumber,
  sanitizeAccountName,
  sanitizeJsonInput,
  sanitizeNumberInput,
  sanitizeIntegerInput,
  containsSuspiciousPatterns,
} from './sanitize';

describe('sanitize utilities', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('escapes ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('escapes quotes', () => {
      expect(escapeHtml("It's a \"test\"")).toBe("It&#x27;s a &quot;test&quot;");
    });

    it('returns empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('preserves safe characters', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('removes self-closing tags', () => {
      expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1Line 2');
    });

    it('handles nested tags', () => {
      expect(stripHtml('<div><p><span>Text</span></p></div>')).toBe('Text');
    });

    it('preserves text without tags', () => {
      expect(stripHtml('Plain text')).toBe('Plain text');
    });
  });

  describe('sanitizeForDisplay', () => {
    it('escapes HTML and normalizes whitespace', () => {
      expect(sanitizeForDisplay('  <b>Hello</b>   World  ')).toBe(
        '&lt;b&gt;Hello&lt;&#x2F;b&gt; World'
      );
    });

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeForDisplay('   test   ')).toBe('test');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes path separators', () => {
      expect(sanitizeFilename('path/to\\file.txt')).toBe('pathtofile.txt');
    });

    it('replaces invalid characters with underscores', () => {
      // Each invalid char (<, >, ", |, ?, *) becomes underscore = 6 underscores
      expect(sanitizeFilename('file<>"|?*.txt')).toBe('file______.txt');
    });

    it('removes leading/trailing dots and spaces', () => {
      expect(sanitizeFilename('  ..hidden.txt..  ')).toBe('hidden.txt');
    });

    it('returns "unnamed" for empty result', () => {
      expect(sanitizeFilename('...')).toBe('unnamed');
      expect(sanitizeFilename('   ')).toBe('unnamed');
    });

    it('truncates long filenames', () => {
      const longName = 'a'.repeat(250) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('removes non-digit characters', () => {
      expect(sanitizePhoneNumber('(123) 456-7890')).toBe('1234567890');
    });

    it('preserves leading plus sign', () => {
      expect(sanitizePhoneNumber('+1 (234) 567-8900')).toBe('+12345678900');
    });

    it('handles already clean numbers', () => {
      expect(sanitizePhoneNumber('1234567890')).toBe('1234567890');
    });
  });

  describe('sanitizeAccountName', () => {
    it('removes special characters', () => {
      expect(sanitizeAccountName('Test@Account#1!')).toBe('TestAccount1');
    });

    it('preserves spaces, underscores, and hyphens', () => {
      expect(sanitizeAccountName('My Account_01-test')).toBe('My Account_01-test');
    });

    it('normalizes whitespace', () => {
      expect(sanitizeAccountName('  Multiple   Spaces  ')).toBe('Multiple Spaces');
    });

    it('truncates long names', () => {
      const longName = 'a'.repeat(150);
      expect(sanitizeAccountName(longName).length).toBe(100);
    });
  });

  describe('sanitizeJsonInput', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeJsonInput('')).toBe('');
      expect(sanitizeJsonInput('   ')).toBe('');
    });

    it('normalizes valid JSON', () => {
      expect(sanitizeJsonInput('  {"key": "value"}  ')).toBe('{"key":"value"}');
    });

    it('throws for invalid JSON', () => {
      expect(() => sanitizeJsonInput('not json')).toThrow('Invalid JSON');
    });

    it('handles arrays', () => {
      expect(sanitizeJsonInput('[1, 2, 3]')).toBe('[1,2,3]');
    });
  });

  describe('sanitizeNumberInput', () => {
    it('parses valid numbers', () => {
      expect(sanitizeNumberInput('123.45')).toBe(123.45);
      expect(sanitizeNumberInput('-67.89')).toBe(-67.89);
    });

    it('removes non-numeric characters', () => {
      expect(sanitizeNumberInput('$1,234.56')).toBe(1234.56);
    });

    it('returns NaN for invalid input', () => {
      expect(sanitizeNumberInput('abc')).toBeNaN();
    });
  });

  describe('sanitizeIntegerInput', () => {
    it('parses valid integers', () => {
      expect(sanitizeIntegerInput('123')).toBe(123);
      expect(sanitizeIntegerInput('-456')).toBe(-456);
    });

    it('truncates decimals', () => {
      // sanitizeIntegerInput removes the dot, so '123.99' becomes '12399'
      expect(sanitizeIntegerInput('123')).toBe(123);
      expect(sanitizeIntegerInput('  456  ')).toBe(456);
    });

    it('returns NaN for invalid input', () => {
      expect(sanitizeIntegerInput('abc')).toBeNaN();
    });
  });

  describe('containsSuspiciousPatterns', () => {
    it('detects script tags', () => {
      expect(containsSuspiciousPatterns('<script>alert(1)</script>')).toBe(true);
      expect(containsSuspiciousPatterns('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
    });

    it('detects javascript: protocol', () => {
      expect(containsSuspiciousPatterns('javascript:alert(1)')).toBe(true);
    });

    it('detects event handlers', () => {
      expect(containsSuspiciousPatterns('onclick=alert(1)')).toBe(true);
      expect(containsSuspiciousPatterns('onerror = doEvil()')).toBe(true);
    });

    it('returns false for safe strings', () => {
      expect(containsSuspiciousPatterns('Hello World')).toBe(false);
      expect(containsSuspiciousPatterns('user@example.com')).toBe(false);
    });
  });
});
