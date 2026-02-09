/**
 * Error utility functions for consistent error handling across the app.
 */

/**
 * Extract a user-friendly error message from an unknown error.
 * Use this in catch blocks instead of `any` typing.
 */
export type BackendErrorResponse = {
  code?: string;
  message?: string;
  details?: string;
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as BackendErrorResponse).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return String(error);
}

export function getBackendError(error: unknown): BackendErrorResponse | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as BackendErrorResponse;
  if (typeof candidate.message === "string" || typeof candidate.code === "string") {
    return candidate;
  }
  return null;
}

/**
 * Check if an error is an abort error (e.g., from AbortController).
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Check if an error is a network error.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    error.name === "NetworkError"
  );
}
