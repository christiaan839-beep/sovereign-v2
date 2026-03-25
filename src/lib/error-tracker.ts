/**
 * SOVEREIGN MATRIX — Error Tracker
 *
 * Silent, non-blocking error tracking that logs to the globalTelemetry table.
 * Rate-limited to max 100 errors per minute to prevent flooding.
 *
 * Usage:
 *   import { trackError, withErrorTracking } from "@/lib/error-tracker";
 *
 *   // Direct usage
 *   await trackError(new Error("Something broke"), { agent: "seo-dominator" });
 *
 *   // Route wrapper
 *   export const POST = withErrorTracking(async (req: Request) => { ... });
 */

import { db } from "@/db";
import { globalTelemetry } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("error-tracker");

// ─── Rate Limiter ───
let errorCount = 0;
let windowStart = Date.now();
const MAX_ERRORS_PER_MINUTE = 100;

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    // Reset window
    errorCount = 0;
    windowStart = now;
  }
  errorCount++;
  return errorCount > MAX_ERRORS_PER_MINUTE;
}

/**
 * Track an error to the globalTelemetry table.
 * Silent — never throws, never blocks the caller.
 * Rate-limited to max 100 errors per minute.
 */
export async function trackError(
  error: Error | string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    if (isRateLimited()) {
      return; // Silently drop — rate limit exceeded
    }

    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;

    const payload = JSON.stringify({
      message,
      stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // Insert into globalTelemetry — use a placeholder tenantId for platform errors.
    // The tenantId is required by the schema; we use a deterministic UUID for system-level events.
    await db.insert(globalTelemetry).values({
      tenantId: "00000000-0000-0000-0000-000000000000",
      eventType: "error",
      payload,
    });
  } catch (insertError) {
    // Never throw — just log locally
    log.warn("Failed to persist error to telemetry", {
      original: error instanceof Error ? error.message : String(error),
      insertError: String(insertError),
    });
  }
}

/**
 * Wraps any Next.js route handler with automatic error tracking.
 * Catches unhandled errors, logs them to globalTelemetry, and returns a 500 response.
 */
export function withErrorTracking(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Fire-and-forget — don't await to avoid blocking the response
      trackError(err, {
        url: request.url,
        method: request.method,
      }).catch(() => {
        // Intentionally swallowed
      });

      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: err.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  };
}
