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
// Async, Upstash-backed when UPSTASH_REDIS_REST_URL is set, otherwise
// in-memory. The in-memory path is per-lambda-instance, so on Vercel the
// effective limit becomes RATE_LIMIT_MAX × N_warm_instances. With Upstash
// the limit is exact across the entire deployment.

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per user

async function checkUpstash(
  userId: string,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash not configured");

  const intervalSec = RATE_LIMIT_WINDOW / 1000;
  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW);
  const key = `rl:user:${userId}:${bucket}`;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, intervalSec],
    ]),
    signal: AbortSignal.timeout(2_000),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  const count = Number(data?.[0]?.result ?? 1);
  const remaining = Math.max(0, RATE_LIMIT_MAX - count);
  return {
    allowed: count <= RATE_LIMIT_MAX,
    remaining,
    resetIn: RATE_LIMIT_WINDOW,
  };
}

function checkMemory(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
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

export async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const useRedis = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  if (useRedis) {
    try {
      return await checkUpstash(userId);
    } catch {
      // Redis unreachable — degrade to in-memory rather than blocking the
      // request. Cluster-wide consistency is lost during the outage but
      // per-instance limits still apply.
      return checkMemory(userId);
    }
  }
  return checkMemory(userId);
}

// Clean up stale in-memory entries every 5 minutes (Upstash entries
// auto-expire via EXPIRE, so this only matters in the memory-only path).
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

    const rateCheck = await checkRateLimit(user.id);
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
