/**
 * SOVEREIGN MATRIX — Production Error Reporter
 *
 * Dual-write: in-memory buffer for fast dashboard access + database persistence.
 * Captures server-side errors from agent routes, webhooks, and API endpoints.
 * Client-side errors captured via global listeners.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("error-reporter");

export interface ErrorEntry {
  timestamp: string;
  message: string;
  stack: string | undefined;
  pageUrl: string;
  context?: string;
  severity?: "low" | "medium" | "high" | "critical";
  userId?: string;
  agentId?: string;
}

const MAX_ERRORS = 100;
const errorLog: ErrorEntry[] = [];

/**
 * Report an error. Writes to in-memory buffer AND persists to database.
 */
export function reportError(
  error: unknown,
  context?: string,
  meta?: { userId?: string; agentId?: string; severity?: ErrorEntry["severity"] }
): void {
  const entry: ErrorEntry = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    pageUrl: typeof window !== "undefined" ? window.location.href : "server",
    context,
    severity: meta?.severity || "medium",
    userId: meta?.userId,
    agentId: meta?.agentId,
  };

  errorLog.push(entry);
  if (errorLog.length > MAX_ERRORS) {
    errorLog.splice(0, errorLog.length - MAX_ERRORS);
  }

  // Persist to database (non-blocking, fire-and-forget)
  persistError(entry).catch(() => {});
}

/**
 * Persist error to the error_logs table in the database.
 */
async function persistError(entry: ErrorEntry): Promise<void> {
  try {
    // Dynamic import to avoid circular deps and allow server-only usage
    const { db } = await import("@/db");
    const { errorLogs } = await import("@/db/schema");
    await db.insert(errorLogs).values({
      message: entry.message,
      stack: entry.stack || "",
      context: entry.context || "",
      severity: entry.severity || "medium",
      userId: entry.userId || null,
      agentId: entry.agentId || null,
      url: entry.pageUrl,
    });
  } catch (err) {
    // If DB write fails, log but don't throw — error reporting should never break the app
    log.error("Failed to persist error to database", { message: (err as Error).message });
  }
}

/**
 * Return the current error log (most recent last).
 */
export function getErrorLog(): ErrorEntry[] {
  return [...errorLog];
}

/**
 * Get error counts by severity for the dashboard.
 */
export function getErrorSummary(): { total: number; critical: number; high: number; medium: number; low: number } {
  return {
    total: errorLog.length,
    critical: errorLog.filter(e => e.severity === "critical").length,
    high: errorLog.filter(e => e.severity === "high").length,
    medium: errorLog.filter(e => e.severity === "medium").length,
    low: errorLog.filter(e => e.severity === "low").length,
  };
}

/**
 * Clear the error log.
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

/**
 * Initialize global error listeners (call once on the client).
 */
export function initErrorListeners(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, "unhandled-error", { severity: "high" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandled-rejection", { severity: "high" });
  });
}
