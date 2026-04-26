/**
 * API Guard — Validation, Rate Limiting, Error Handling
 *
 * Makes every API route unbreakable:
 * 1. Input validation with safe defaults
 * 2. Rate limiting:
 *    - Upstash Redis (persists across deploys / shared across regions)
 *    - In-memory fallback when UPSTASH_REDIS_REST_* env vars are missing
 *    - Memory is also used when Redis is configured but the pipeline call throws
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

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_SEC = 60; // 1 minute
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SEC * 1000;
const RATE_LIMIT_MAX = 60; // 60 requests per minute per user

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds
}

/**
 * Synchronous in-memory rate limit. Kept for back-compat with auth-guard.ts
 * and the unit tests. Prefer checkRateLimitAsync() in new code so prod gets
 * Upstash-backed limits (memory limits reset per Vercel cold-start).
 */
export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetIn: RATE_LIMIT_WINDOW_MS,
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

/**
 * Async rate limiter. Uses Upstash Redis when configured (persists across
 * deploys, shared across regions/lambdas), falls back to the in-memory map
 * when env vars are missing or Redis is unreachable.
 */
export async function checkRateLimitAsync(
  userId: string,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return checkRateLimit(userId);
  }

  try {
    const windowKey = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
    const key = `apg:${userId}:${windowKey}`;

    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, RATE_LIMIT_WINDOW_SEC],
      ]),
      // Bound the network call so a slow Redis cannot stall the request path.
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) throw new Error(`Upstash ${res.status}`);

    const data = (await res.json()) as Array<{ result?: number }>;
    const count = data?.[0]?.result ?? 1;

    const remaining = Math.max(0, RATE_LIMIT_MAX - count);
    // Time left in the current window.
    const resetIn = RATE_LIMIT_WINDOW_MS - (Date.now() % RATE_LIMIT_WINDOW_MS);

    return { allowed: count <= RATE_LIMIT_MAX, remaining, resetIn };
  } catch (err) {
    log.warn("Upstash rate-limit unavailable, falling back to memory", {
      error: String(err),
    });
    return checkRateLimit(userId);
  }
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

    const rateCheck = await checkRateLimitAsync(user.id);
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
  } catch {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication failed", code: "AUTH_ERROR" },
        { status: 500 },
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
