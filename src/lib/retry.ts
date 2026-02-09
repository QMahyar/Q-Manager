/**
 * Retry utility for API calls with exponential backoff.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 500) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 5000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on retry (for logging/UI feedback) */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 2,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Execute an async function with retry logic and exponential backoff.
 * 
 * @example
 * const result = await withRetry(() => fetchData(id), {
 *   maxAttempts: 3,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error)
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= opts.maxAttempts || !opts.isRetryable(error)) {
        throw error;
      }

      // Notify about retry
      opts.onRetry(attempt, error, delay);

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt (exponential backoff with jitter)
      const jitter = Math.random() * 0.3 + 0.85; // 0.85 - 1.15
      delay = Math.min(delay * opts.backoffMultiplier * jitter, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is a network/connection error that's worth retrying.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("fetch") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    );
  }
  return false;
}

/**
 * Create a retryable version of an async function.
 * 
 * @example
 * const fetchWithRetry = makeRetryable(fetchData, { maxAttempts: 3 });
 * const result = await fetchWithRetry(id);
 */
export function makeRetryable<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  options?: RetryOptions
): (...args: Args) => Promise<T> {
  return (...args: Args) => withRetry(() => fn(...args), options);
}
