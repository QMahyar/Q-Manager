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

export class ApiError extends Error {
  code?: string;
  details?: string;

  constructor(message: string, options?: { code?: string; details?: string }) {
    super(message);
    this.name = "ApiError";
    this.code = options?.code;
    this.details = options?.details;
  }
}

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
  // Native JS Error instances are not backend responses
  if (error instanceof Error) return null;
  const candidate = error as BackendErrorResponse;
  if (typeof candidate.message === "string" || typeof candidate.code === "string") {
    return candidate;
  }
  return null;
}

export function normalizeError(error: unknown): ApiError {
  const backendError = getBackendError(error);
  if (backendError?.message) {
    return new ApiError(backendError.message, {
      code: backendError.code,
      details: backendError.details,
    });
  }

  return new ApiError(getErrorMessage(error));
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
