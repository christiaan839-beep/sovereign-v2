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

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per user

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW };
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

// ─── IP-keyed rate limiting (for public/unauthenticated endpoints) ─

/**
 * Extract the caller's IP from standard proxy headers. Order:
 *   1. x-forwarded-for (first entry — Vercel + most CDNs)
 *   2. x-real-ip       (some reverse proxies)
 *   3. "unknown"       (shared bucket — safer than skipping the check)
 *
 * Exported so test fixtures can exercise the parsing logic directly.
 */
export function extractClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export interface IpRateLimitOptions {
  /** Namespace so different endpoints don't share buckets. */
  bucket: string;
  /** Window length in ms. Defaults to 60 minutes. */
  windowMs?: number;
  /** Max requests per window. Defaults to 10. */
  max?: number;
}

/**
 * IP-keyed sliding window rate limit — intended for PUBLIC endpoints
 * where there's no userId to key against (e.g. /api/creators/submit
 * is unauthenticated by design).
 *
 * Returns `{ allowed: false }` once the quota is exceeded. Callers
 * should respond with 429 + a Retry-After header.
 *
 * Single-instance in-memory store. In a multi-region Vercel setup
 * each instance has its own bucket, which under-counts but never
 * over-counts — good enough for spam prevention. Swap to Upstash
 * Redis when UPSTASH_REDIS_REST_URL is set for cross-instance accuracy.
 */
export function checkIpRateLimit(
  ip: string,
  options: IpRateLimitOptions,
): { allowed: boolean; remaining: number; resetIn: number } {
  const windowMs = options.windowMs ?? 60 * 60 * 1000; // 1 hour
  const max = options.max ?? 10;
  const key = `${options.bucket}:${ip}`;

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: max - 1, resetIn: windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  const resetIn = entry.resetTime - now;

  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetIn };
  }
  return { allowed: true, remaining, resetIn };
}

/**
 * Test-only: clear the in-memory rate-limit store between test cases
 * so each test starts with a fresh quota.
 */
export function _resetRateLimitStoreForTests(): void {
  rateLimitStore.clear();
}

// ─── Input Validation ───────────────────────────────────────────

export function sanitizeString(input: unknown, maxLength = 2000): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

export function sanitizeNumber(input: unknown, min = 0, max = 100, fallback = 0): number {
  const num = Number(input);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeArray(input: unknown, maxItems = 20): string[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, maxItems).map(item => sanitizeString(item, 500)).filter(Boolean);
}

export function validateRequired(fields: Record<string, unknown>, required: string[]): string | null {
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
          { status: 401 }
        ),
      };
    }

    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Rate limit exceeded", code: "RATE_LIMITED", resetIn: rateCheck.resetIn },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rateCheck.resetIn / 1000)) } }
        ),
      };
    }

    return { authorized: true, userId: user.id, email };
  } catch {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication failed", code: "AUTH_ERROR" },
        { status: 500 }
      ),
    };
  }
}

// ─── Error Handler ──────────────────────────────────────────────

export function errorResponse(message: string, status = 500, code = "INTERNAL_ERROR") {
  log.error(`${code}: ${message}`);
  return NextResponse.json(
    { error: message, code, timestamp: new Date().toISOString() },
    { status }
  );
}
