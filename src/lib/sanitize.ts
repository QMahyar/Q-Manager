/**
 * Input sanitization utilities for XSS prevention and data cleaning.
 *
 * While Tauri apps are less vulnerable to XSS than web apps (no URL-based injection),
 * it's still good practice to sanitize user inputs, especially for data that will
 * be displayed or stored.
 */

/**
 * HTML entity map for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
	"/": "&#x2F;",
	"`": "&#x60;",
	"=": "&#x3D;",
};

/**
 * Escape HTML special characters to prevent XSS
 * Use this when displaying user-provided content in the UI
 */
export function escapeHtml(str: string): string {
	return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Unescape HTML entities back to their original characters.
 * Uses DOMParser when available (safe, no innerHTML),
 * falls back to a manual entity map for non-DOM environments.
 */
export function unescapeHtml(str: string): string {
	if (typeof DOMParser !== "undefined") {
		const doc = new DOMParser().parseFromString(
			`<textarea>${str}</textarea>`,
			"text/html",
		);
		return (
			(doc.querySelector("textarea") as HTMLTextAreaElement | null)
				?.textContent ?? str
		);
	}
	// Fallback for non-DOM environments
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, "/")
		.replace(/&#x60;/g, "`")
		.replace(/&#x3D;/g, "=");
}

/**
 * Remove all HTML tags from a string
 */
export function stripHtml(str: string): string {
	return str.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize a string for safe display
 * Combines HTML escaping with trimming and normalizing whitespace
 */
export function sanitizeForDisplay(str: string): string {
	return escapeHtml(str.trim()).replace(/\s+/g, " ");
}

// Windows reserved filenames that cannot be used as file/directory names
const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;

/**
 * Sanitize a string for use as a filename
 * Removes or replaces characters that are invalid in filenames
 */
export function sanitizeFilename(filename: string): string {
	// Remove path separators and null bytes
	let sanitized = filename.replace(/[/\\:\0]/g, "");

	// Replace other problematic characters with underscores
	sanitized = sanitized.replace(/[<>"|?*]/g, "_");

	// Remove leading/trailing dots and spaces
	sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");

	// Limit length (most filesystems have 255 char limit)
	if (sanitized.length > 200) {
		const dotIndex = sanitized.lastIndexOf(".");
		if (dotIndex > 0) {
			// Has an extension: preserve it, truncate the base name
			const base = sanitized.slice(0, dotIndex);
			const ext = sanitized.slice(dotIndex); // includes the dot
			sanitized = base.slice(0, 200 - ext.length) + ext;
		} else {
			// No extension (or leading-dot hidden file): just truncate
			sanitized = sanitized.slice(0, 200);
		}
	}

	// Replace Windows reserved filenames
	if (WINDOWS_RESERVED_NAMES.test(sanitized)) {
		sanitized = `_${sanitized}`;
	}

	// Fallback for empty result
	return sanitized || "unnamed";
}

/**
 * Sanitize a phone number by removing all non-digit characters except leading +
 */
export function sanitizePhoneNumber(phone: string): string {
	const hasPlus = phone.startsWith("+");
	const digits = phone.replace(/\D/g, "");
	return hasPlus ? "+" + digits : digits;
}

/**
 * Sanitize a pattern string for regex use
 * Note: This doesn't validate the regex, just cleans the input
 */
export function sanitizePatternInput(pattern: string): string {
	// Trim whitespace
	return pattern.trim();
}

/**
 * Sanitize a username/account name
 * Allows alphanumeric, spaces, underscores, and hyphens
 */
export function sanitizeAccountName(name: string): string {
	return name
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, " ")
		.slice(0, 100);
}

/**
 * Sanitize a JSON string input
 * Returns the sanitized string or throws if invalid JSON
 */
export function sanitizeJsonInput(json: string): string {
	const trimmed = json.trim();
	if (!trimmed) return "";

	// Parse and re-stringify to ensure valid JSON and remove any extraneous content
	try {
		const parsed = JSON.parse(trimmed);
		return JSON.stringify(parsed);
	} catch {
		throw new Error("Invalid JSON format");
	}
}

/**
 * Sanitize a number input from a string
 * Returns the number or NaN if invalid
 */
export function sanitizeNumberInput(value: string): number {
	const sanitized = value.trim().replace(/[^\d.-]/g, "");
	return parseFloat(sanitized);
}

/**
 * Sanitize an integer input from a string
 * Returns the integer or NaN if invalid
 */
export function sanitizeIntegerInput(value: string): number {
	// Use parseInt directly so "123.99" → 123 (not 12399 from stripping the dot)
	return parseInt(value.trim(), 10);
}

/**
 * Check if a string contains any potentially dangerous patterns
 * Useful for logging or alerting on suspicious input
 */
export function containsSuspiciousPatterns(str: string): boolean {
	const suspiciousPatterns = [
		/<script/i,
		/javascript:/i,
		/vbscript:/i,
		/on\w+\s*=/i, // onclick=, onerror=, etc.
		/data:\s*text\/html/i,
		/expression\s*\(/i, // CSS expression
		/url\s*\(\s*["']?\s*javascript:/i,
	];

	return suspiciousPatterns.some((pattern) => pattern.test(str));
}

/**
 * Create a safe string for use in CSS
 * Removes any potentially dangerous CSS patterns
 */
export function sanitizeForCss(str: string): string {
	return str
		.replace(/expression\s*\(/gi, "")
		.replace(/url\s*\(/gi, "")
		.replace(/javascript:/gi, "")
		.replace(/[;{}]/g, "");
}
