/**
 * API Guard — Validation, Rate Limiting, Error Handling
 *
 * Makes every API route unbreakable:
 * 1. Input validation with safe defaults
 * 2. In-memory rate limiting (60 req/min per user)
 * 3. Error handler wrapper with structured error responses
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
const log = createLogger("api-guard");
import { currentUser } from "@clerk/nextjs/server";

// ─── Rate Limiter ───────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Map's iteration order is insertion order, so we can use it as a tiny LRU:
// when the store fills up we evict the oldest-inserted entries.
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per user
/**
 * Hard cap on concurrent rate-limit entries to prevent OOM at scale.
 * Reliability-audit finding: unbounded Map grows to ~500MB at 10K concurrent
 * users, triggering GC pauses and cascading latency. 100K cap means each
 * region holds ~10MB of state — well within Vercel's 1GB limit.
 */
const RATE_LIMIT_MAX_ENTRIES = 100_000;

export function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
    // Evict oldest-inserted entry when the cache is at capacity.
    if (rateLimitStore.size >= RATE_LIMIT_MAX_ENTRIES) {
      const oldest = rateLimitStore.keys().next().value;
      if (oldest !== undefined) rateLimitStore.delete(oldest);
    }
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetIn: RATE_LIMIT_WINDOW,
    };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetIn = entry.resetTime - now;

  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining, resetIn };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 300_000);

// ─── Input Validation ───────────────────────────────────────────

export function sanitizeString(input: unknown, maxLength = 2000): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

export function sanitizeNumber(
  input: unknown,
  min = 0,
  max = 100,
  fallback = 0,
): number {
  const num = Number(input);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeArray(input: unknown, maxItems = 20): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, maxItems)
    .map((item) => sanitizeString(item, 500))
    .filter(Boolean);
}

export function validateRequired(
  fields: Record<string, unknown>,
  required: string[],
): string | null {
  for (const field of required) {
    const value = fields[field];
    if (value === undefined || value === null || value === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// ─── Auth + Rate Limit Guard ────────────────────────────────────

export async function guardRoute(): Promise<
  | { authorized: true; userId: string; email: string }
  | { authorized: false; response: NextResponse }
> {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;

    if (!user || !email) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized", code: "AUTH_REQUIRED" },
          { status: 401 },
        ),
      };
    }

    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: "Rate limit exceeded",
            code: "RATE_LIMITED",
            resetIn: rateCheck.resetIn,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(rateCheck.resetIn / 1000)),
            },
          },
        ),
      };
    }

    return { authorized: true, userId: user.id, email };
  } catch (err) {
    // Auth lookup failure = the user isn't authenticated *to us right now*.
    // Returning 500 makes Clerk-side outages look like our bugs and breaks
    // the entire API surface (front-end retries, paging on-call, etc.).
    // Fail-CLOSED with 401 so clients route to the login flow, and log
    // the underlying cause so we can distinguish Clerk outages from real
    // 401s in the dashboard.
    log.warn("guardRoute auth lookup failed — returning 401", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "AUTH_UNAVAILABLE" },
        { status: 401 },
      ),
    };
  }
}

// ─── Error Handler ──────────────────────────────────────────────

export function errorResponse(
  message: string,
  status = 500,
  code = "INTERNAL_ERROR",
) {
  log.error(`${code}: ${message}`);
  return NextResponse.json(
    { error: message, code, timestamp: new Date().toISOString() },
    { status },
  );
}
