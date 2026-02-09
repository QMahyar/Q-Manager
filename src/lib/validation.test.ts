import { describe, it, expect } from 'vitest';
import { validate, rules } from './validation';

describe('validation', () => {
  describe('validate function', () => {
    it('returns valid for empty rules', () => {
      const result = validate('test', []);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns first failing rule error', () => {
      const result = validate('', [
        rules.required('Field is required'),
        rules.minLength(5, 'Too short'),
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('passes all rules', () => {
      const result = validate('hello world', [
        rules.required(),
        rules.minLength(5),
        rules.maxLength(20),
      ]);
      expect(result.valid).toBe(true);
    });
  });

  describe('rules.required', () => {
    it('fails for empty string', () => {
      expect(rules.required().validate('')).toBe(false);
    });

    it('fails for whitespace only', () => {
      expect(rules.required().validate('   ')).toBe(false);
    });

    it('passes for non-empty string', () => {
      expect(rules.required().validate('hello')).toBe(true);
    });

    it('uses custom message', () => {
      expect(rules.required('Custom message').message).toBe('Custom message');
    });
  });

  describe('rules.minLength', () => {
    it('fails for string shorter than min', () => {
      expect(rules.minLength(5).validate('abc')).toBe(false);
    });

    it('passes for string equal to min', () => {
      expect(rules.minLength(5).validate('abcde')).toBe(true);
    });

    it('passes for string longer than min', () => {
      expect(rules.minLength(5).validate('abcdefgh')).toBe(true);
    });
  });

  describe('rules.maxLength', () => {
    it('fails for string longer than max', () => {
      expect(rules.maxLength(5).validate('abcdefgh')).toBe(false);
    });

    it('passes for string equal to max', () => {
      expect(rules.maxLength(5).validate('abcde')).toBe(true);
    });

    it('passes for string shorter than max', () => {
      expect(rules.maxLength(5).validate('abc')).toBe(true);
    });
  });

  describe('rules.pattern', () => {
    it('fails for non-matching pattern', () => {
      expect(rules.pattern(/^[a-z]+$/, 'Only lowercase letters').validate('ABC')).toBe(false);
    });

    it('passes for matching pattern', () => {
      expect(rules.pattern(/^[a-z]+$/, 'Only lowercase letters').validate('abc')).toBe(true);
    });
  });

  describe('rules.numeric', () => {
    it('passes for numeric strings', () => {
      expect(rules.numeric().validate('123')).toBe(true);
      expect(rules.numeric().validate('12.34')).toBe(true);
      expect(rules.numeric().validate('-5')).toBe(true);
    });

    it('fails for non-numeric strings', () => {
      expect(rules.numeric().validate('abc')).toBe(false);
      expect(rules.numeric().validate('12abc')).toBe(false);
    });
  });

  describe('rules.integer', () => {
    it('passes for integer strings', () => {
      expect(rules.integer().validate('123')).toBe(true);
      expect(rules.integer().validate('-5')).toBe(true);
    });

    it('fails for decimal strings', () => {
      expect(rules.integer().validate('12.34')).toBe(false);
    });

    it('fails for non-numeric strings', () => {
      expect(rules.integer().validate('abc')).toBe(false);
    });
  });

  describe('rules.min', () => {
    it('fails for values below min', () => {
      expect(rules.min(5).validate(3)).toBe(false);
    });

    it('passes for values equal to min', () => {
      expect(rules.min(5).validate(5)).toBe(true);
    });

    it('passes for values above min', () => {
      expect(rules.min(5).validate(10)).toBe(true);
    });
  });

  describe('rules.max', () => {
    it('fails for values above max', () => {
      expect(rules.max(5).validate(10)).toBe(false);
    });

    it('passes for values equal to max', () => {
      expect(rules.max(5).validate(5)).toBe(true);
    });

    it('passes for values below max', () => {
      expect(rules.max(5).validate(3)).toBe(true);
    });
  });

  describe('rules.range', () => {
    it('fails for values outside range', () => {
      expect(rules.range(5, 10).validate(3)).toBe(false);
      expect(rules.range(5, 10).validate(12)).toBe(false);
    });

    it('passes for values at boundaries', () => {
      expect(rules.range(5, 10).validate(5)).toBe(true);
      expect(rules.range(5, 10).validate(10)).toBe(true);
    });

    it('passes for values inside range', () => {
      expect(rules.range(5, 10).validate(7)).toBe(true);
    });
  });

  describe('rules.phone', () => {
    it('passes for valid phone numbers', () => {
      expect(rules.phone().validate('+1234567890')).toBe(true);
      expect(rules.phone().validate('1234567890')).toBe(true);
      expect(rules.phone().validate('+12 345 678 90')).toBe(true);
    });

    it('fails for invalid phone numbers', () => {
      expect(rules.phone().validate('123')).toBe(false); // too short
      expect(rules.phone().validate('abcdefghij')).toBe(false);
    });
  });

  describe('rules.regex', () => {
    it('passes for valid regex patterns', () => {
      expect(rules.regex().validate('hello.*world')).toBe(true);
      expect(rules.regex().validate('^[a-z]+$')).toBe(true);
    });

    it('fails for invalid regex patterns', () => {
      expect(rules.regex().validate('[invalid')).toBe(false);
      expect(rules.regex().validate('(?')).toBe(false);
    });
  });

  describe('rules.notEmpty', () => {
    it('fails for empty array', () => {
      expect(rules.notEmpty().validate([])).toBe(false);
    });

    it('passes for non-empty array', () => {
      expect(rules.notEmpty().validate([1, 2, 3])).toBe(true);
    });
  });

  describe('rules.custom', () => {
    it('uses custom validation function', () => {
      const isEven = rules.custom<number>((n) => n % 2 === 0, 'Must be even');
      expect(isEven.validate(4)).toBe(true);
      expect(isEven.validate(5)).toBe(false);
      expect(isEven.message).toBe('Must be even');
    });
  });
});
