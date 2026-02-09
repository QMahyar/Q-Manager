/**
 * Form validation utilities with inline error support
 */

export type ValidationRule<T = string> = {
  validate: (value: T) => boolean;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validate a value against a set of rules
 */
export function validate<T>(value: T, rules: ValidationRule<T>[]): ValidationResult {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      return { valid: false, error: rule.message };
    }
  }
  return { valid: true };
}

/**
 * Common validation rules
 */
export const rules = {
  required: (message = "This field is required"): ValidationRule<string> => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length <= max,
    message: message || `Must be at most ${max} characters`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value) => regex.test(value),
    message,
  }),

  numeric: (message = "Must be a number"): ValidationRule<string> => ({
    validate: (value) => !isNaN(Number(value)),
    message,
  }),

  integer: (message = "Must be a whole number"): ValidationRule<string> => ({
    validate: (value) => Number.isInteger(Number(value)),
    message,
  }),

  min: (min: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value >= min,
    message: message || `Must be at least ${min}`,
  }),

  max: (max: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value <= max,
    message: message || `Must be at most ${max}`,
  }),

  range: (min: number, max: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value >= min && value <= max,
    message: message || `Must be between ${min} and ${max}`,
  }),

  phone: (message = "Invalid phone number"): ValidationRule<string> => ({
    validate: (value) => /^\+?[1-9]\d{6,14}$/.test(value.replace(/\s/g, "")),
    message,
  }),

  regex: (message = "Invalid regex pattern"): ValidationRule<string> => ({
    validate: (value) => {
      try {
        new RegExp(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  notEmpty: <T>(message = "Please select an option"): ValidationRule<T[]> => ({
    validate: (value) => value.length > 0,
    message,
  }),

  custom: <T>(fn: (value: T) => boolean, message: string): ValidationRule<T> => ({
    validate: fn,
    message,
  }),
};

/**
 * Validate delay range (min <= max)
 */
export function validateDelayRange(min: number, max: number): ValidationResult {
  if (min < 0) {
    return { valid: false, error: "Min delay cannot be negative" };
  }
  if (max < 0) {
    return { valid: false, error: "Max delay cannot be negative" };
  }
  if (min > max) {
    return { valid: false, error: "Min delay must be less than or equal to max delay" };
  }
  return { valid: true };
}

/**
 * Test if a string is a valid regex pattern
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get regex error message if pattern is invalid
 */
export function getRegexError(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid regex pattern";
  }
}

// ============================================================================
// Constants (matching backend validation limits)
// ============================================================================

export const VALIDATION_LIMITS = {
  MAX_PATTERN_LENGTH: 1000,
  MAX_ACCOUNT_NAME_LENGTH: 100,
  MAX_ACTION_NAME_LENGTH: 100,
  MAX_DISPLAY_NAME_LENGTH: 200,
  MAX_PHONE_LENGTH: 20,
  MIN_DELAY_SECONDS: 0,
  MAX_DELAY_SECONDS: 300,
  MIN_PRIORITY: -10000,
  MAX_PRIORITY: 10000,
  MAX_JOIN_ATTEMPTS: 100,
  MAX_COOLDOWN_SECONDS: 300,
  MIN_PHONE_DIGITS: 7,
  API_HASH_LENGTH: 32,
} as const;

// ============================================================================
// Domain-Specific Validators
// ============================================================================

/**
 * Validate a pattern (regex or substring)
 */
export function validatePattern(pattern: string, isRegex: boolean): ValidationResult {
  if (!pattern || pattern.trim() === "") {
    return { valid: false, error: "Pattern cannot be empty" };
  }

  if (pattern.length > VALIDATION_LIMITS.MAX_PATTERN_LENGTH) {
    return { valid: false, error: `Pattern exceeds maximum length of ${VALIDATION_LIMITS.MAX_PATTERN_LENGTH} characters` };
  }

  if (isRegex) {
    const regexError = getRegexError(pattern);
    if (regexError) {
      return { valid: false, error: `Invalid regex: ${regexError}` };
    }
  }

  return { valid: true };
}

/**
 * Validate delay values (min/max seconds)
 */
export function validateDelay(minSeconds: number, maxSeconds: number): ValidationResult {
  if (minSeconds < VALIDATION_LIMITS.MIN_DELAY_SECONDS) {
    return { valid: false, error: `Minimum delay cannot be less than ${VALIDATION_LIMITS.MIN_DELAY_SECONDS} seconds` };
  }

  if (maxSeconds < VALIDATION_LIMITS.MIN_DELAY_SECONDS) {
    return { valid: false, error: `Maximum delay cannot be less than ${VALIDATION_LIMITS.MIN_DELAY_SECONDS} seconds` };
  }

  if (minSeconds > VALIDATION_LIMITS.MAX_DELAY_SECONDS) {
    return { valid: false, error: `Minimum delay cannot exceed ${VALIDATION_LIMITS.MAX_DELAY_SECONDS} seconds` };
  }

  if (maxSeconds > VALIDATION_LIMITS.MAX_DELAY_SECONDS) {
    return { valid: false, error: `Maximum delay cannot exceed ${VALIDATION_LIMITS.MAX_DELAY_SECONDS} seconds` };
  }

  if (minSeconds > maxSeconds) {
    return { valid: false, error: "Minimum delay cannot be greater than maximum delay" };
  }

  return { valid: true };
}

/**
 * Validate priority value
 */
export function validatePriority(priority: number): ValidationResult {
  if (!Number.isInteger(priority)) {
    return { valid: false, error: "Priority must be an integer" };
  }

  if (priority < VALIDATION_LIMITS.MIN_PRIORITY) {
    return { valid: false, error: `Priority cannot be less than ${VALIDATION_LIMITS.MIN_PRIORITY}` };
  }

  if (priority > VALIDATION_LIMITS.MAX_PRIORITY) {
    return { valid: false, error: `Priority cannot exceed ${VALIDATION_LIMITS.MAX_PRIORITY}` };
  }

  return { valid: true };
}

/**
 * Validate account name
 */
export function validateAccountName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Account name cannot be empty" };
  }

  if (trimmed.length > VALIDATION_LIMITS.MAX_ACCOUNT_NAME_LENGTH) {
    return { valid: false, error: `Account name exceeds maximum length of ${VALIDATION_LIMITS.MAX_ACCOUNT_NAME_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Validate action name (internal identifier)
 */
export function validateActionName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Action name cannot be empty" };
  }

  if (trimmed.length > VALIDATION_LIMITS.MAX_ACTION_NAME_LENGTH) {
    return { valid: false, error: `Action name exceeds maximum length of ${VALIDATION_LIMITS.MAX_ACTION_NAME_LENGTH} characters` };
  }

  // Action names should be lowercase alphanumeric with underscores
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: "Action name must contain only lowercase letters, numbers, and underscores" };
  }

  return { valid: true };
}

/**
 * Validate display name
 */
export function validateDisplayName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Display name cannot be empty" };
  }

  if (trimmed.length > VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH) {
    return { valid: false, error: `Display name exceeds maximum length of ${VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const trimmed = phone.trim();

  if (!trimmed) {
    return { valid: false, error: "Phone number cannot be empty" };
  }

  if (trimmed.length > VALIDATION_LIMITS.MAX_PHONE_LENGTH) {
    return { valid: false, error: `Phone number exceeds maximum length of ${VALIDATION_LIMITS.MAX_PHONE_LENGTH} characters` };
  }

  // Phone should contain only digits, spaces, dashes, plus sign, and parentheses
  if (!/^[0-9+\-\s()]+$/.test(trimmed)) {
    return { valid: false, error: "Phone number contains invalid characters" };
  }

  // Must contain at least some digits
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount < VALIDATION_LIMITS.MIN_PHONE_DIGITS) {
    return { valid: false, error: `Phone number must contain at least ${VALIDATION_LIMITS.MIN_PHONE_DIGITS} digits` };
  }

  return { valid: true };
}

/**
 * Validate Telegram API ID
 */
export function validateApiId(apiId: number | string): ValidationResult {
  const numericId = typeof apiId === "string" ? parseInt(apiId, 10) : apiId;

  if (isNaN(numericId)) {
    return { valid: false, error: "API ID must be a number" };
  }

  if (numericId <= 0) {
    return { valid: false, error: "API ID must be a positive number" };
  }

  return { valid: true };
}

/**
 * Validate Telegram API Hash
 */
export function validateApiHash(apiHash: string): ValidationResult {
  const trimmed = apiHash.trim();

  if (!trimmed) {
    return { valid: false, error: "API Hash cannot be empty" };
  }

  if (trimmed.length !== VALIDATION_LIMITS.API_HASH_LENGTH) {
    return { valid: false, error: `API Hash must be exactly ${VALIDATION_LIMITS.API_HASH_LENGTH} characters` };
  }

  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    return { valid: false, error: "API Hash must contain only hexadecimal characters" };
  }

  return { valid: true };
}

/**
 * Validate join rules
 */
export function validateJoinRules(maxAttempts: number, cooldownSeconds: number): ValidationResult {
  if (!Number.isInteger(maxAttempts)) {
    return { valid: false, error: "Maximum attempts must be an integer" };
  }

  if (maxAttempts < 1) {
    return { valid: false, error: "Maximum join attempts must be at least 1" };
  }

  if (maxAttempts > VALIDATION_LIMITS.MAX_JOIN_ATTEMPTS) {
    return { valid: false, error: `Maximum join attempts cannot exceed ${VALIDATION_LIMITS.MAX_JOIN_ATTEMPTS}` };
  }

  if (!Number.isInteger(cooldownSeconds)) {
    return { valid: false, error: "Cooldown must be an integer" };
  }

  if (cooldownSeconds < 0) {
    return { valid: false, error: "Cooldown cannot be negative" };
  }

  if (cooldownSeconds > VALIDATION_LIMITS.MAX_COOLDOWN_SECONDS) {
    return { valid: false, error: `Cooldown cannot exceed ${VALIDATION_LIMITS.MAX_COOLDOWN_SECONDS} seconds` };
  }

  return { valid: true };
}

/**
 * Valid button types
 */
export const VALID_BUTTON_TYPES = ["player_list", "yes_no", "fixed"] as const;
export type ButtonType = typeof VALID_BUTTON_TYPES[number];

/**
 * Validate button type string
 */
export function validateButtonType(buttonType: string): ValidationResult {
  if (!VALID_BUTTON_TYPES.includes(buttonType as ButtonType)) {
    return { valid: false, error: `Invalid button type '${buttonType}'. Must be one of: ${VALID_BUTTON_TYPES.join(", ")}` };
  }
  return { valid: true };
}

/**
 * Validate bot user ID (optional field)
 */
export function validateBotUserId(userId: number | string | null | undefined): ValidationResult {
  if (userId === null || userId === undefined || userId === "") {
    return { valid: true }; // Bot ID is optional
  }

  const numericId = typeof userId === "string" ? parseInt(userId, 10) : userId;

  if (isNaN(numericId)) {
    return { valid: false, error: "Bot User ID must be a number" };
  }

  if (numericId <= 0) {
    return { valid: false, error: "Bot User ID must be a positive number" };
  }

  return { valid: true };
}

/**
 * Validate group/chat ID (optional field)
 */
export function validateGroupId(groupId: number | string | null | undefined): ValidationResult {
  if (groupId === null || groupId === undefined || groupId === "") {
    return { valid: true }; // Group ID is optional
  }

  const numericId = typeof groupId === "string" ? parseInt(groupId, 10) : groupId;

  if (isNaN(numericId)) {
    return { valid: false, error: "Group ID must be a number" };
  }

  // Group IDs can be negative (supergroups/channels) or positive
  return { valid: true };
}

/**
 * Check if all fields in validation state are valid
 */
export function isFormValid(validationState: Record<string, string | undefined>): boolean {
  return Object.values(validationState).every((error) => error === undefined);
}
