/**
 * SOVEREIGN MATRIX — Lightweight Error Reporter
 *
 * Self-hosted error monitoring — no external services needed.
 * Captures unhandled errors and promise rejections,
 * stores last 50 errors in memory, and exposes getErrorLog()
 * for the dashboard.
 */

export interface ErrorEntry {
  timestamp: string;
  message: string;
  stack: string | undefined;
  pageUrl: string;
  context?: string;
}

const MAX_ERRORS = 50;
const errorLog: ErrorEntry[] = [];

/**
 * Report an error manually (agents, API routes, components).
 */
export function reportError(
  error: unknown,
  context?: string
): void {
  const entry: ErrorEntry = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    pageUrl: typeof window !== "undefined" ? window.location.href : "server",
    context,
  };

  errorLog.push(entry);

  // Keep only the last MAX_ERRORS entries
  if (errorLog.length > MAX_ERRORS) {
    errorLog.splice(0, errorLog.length - MAX_ERRORS);
  }
}

/**
 * Return the current error log (most recent last).
 */
export function getErrorLog(): ErrorEntry[] {
  return [...errorLog];
}

/**
 * Clear the error log (for testing or manual reset).
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

/**
 * Initialize global error listeners (call once on the client).
 * Safe to call on the server — it no-ops.
 */
export function initErrorListeners(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, "unhandled-error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandled-rejection");
  });
}
