/**
 * Rate Limiter — Persistent (Upstash Redis) or In-Memory Fallback
 *
 * When UPSTASH_REDIS_REST_URL is configured, rate limits persist across deploys.
 * Otherwise falls back to in-memory (resets on each deploy/restart).
 *
 * Usage:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   const limiter = rateLimit({ interval: 60, limit: 20 });
 *
 *   export async function POST(req: Request) {
 *     const limited = limiter.check(req);
 *     if (limited) return limited;
 *   }
 */

import { NextResponse } from "next/server";

interface RateLimitConfig {
  interval: number; // seconds
  limit: number;    // max requests per interval
}

// ─── In-Memory Store (fallback) ───
const stores = new Map<string, Map<string, number[]>>();

function getClientId(req: Request): string {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) return `key:${apiKey.slice(0, 8)}`;
  const forwarded = req.headers.get("x-forwarded-for");
  return `ip:${forwarded?.split(",")[0]?.trim() || "unknown"}`;
}

// ─── Redis-Backed Rate Limiter ───
async function checkRedis(clientId: string, interval: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis not configured");

  const key = `rl:${clientId}:${Math.floor(Date.now() / (interval * 1000))}`;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, interval],
    ]),
  });

  const data = await res.json();
  const count = data?.[0]?.result ?? 1;
  const remaining = Math.max(0, limit - count);
  const resetIn = interval;

  return { allowed: count <= limit, remaining, resetIn };
}

// ─── In-Memory Fallback ───
function checkMemory(clientId: string, interval: number, limit: number): { allowed: boolean; remaining: number; resetIn: number } {
  const storeKey = `${interval}-${limit}`;
  if (!stores.has(storeKey)) stores.set(storeKey, new Map());
  const store = stores.get(storeKey)!;

  const now = Date.now();
  const cutoff = now - interval * 1000;
  const timestamps = (store.get(clientId) || []).filter(t => t > cutoff);

  if (timestamps.length >= limit) {
    const retryAfter = Math.ceil(interval - (now - timestamps[0]) / 1000);
    return { allowed: false, remaining: 0, resetIn: retryAfter };
  }

  timestamps.push(now);
  store.set(clientId, timestamps);

  // Clean up old entries periodically
  if (store.size > 1000) {
    for (const [key, ts] of store.entries()) {
      if (ts.every(t => t <= cutoff)) store.delete(key);
    }
  }

  return { allowed: true, remaining: limit - timestamps.length, resetIn: interval };
}

export function rateLimit(config: RateLimitConfig) {
  const { interval, limit } = config;
  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  return {
    async check(req: Request): Promise<NextResponse | null> {
      const clientId = getClientId(req);

      let result: { allowed: boolean; remaining: number; resetIn: number };

      if (useRedis) {
        try {
          result = await checkRedis(clientId, interval, limit);
        } catch {
          // Redis down — fall back to memory
          result = checkMemory(clientId, interval, limit);
        }
      } else {
        result = checkMemory(clientId, interval, limit);
      }

      if (!result.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please slow down.", retryAfter: result.resetIn },
          { status: 429, headers: { "Retry-After": String(result.resetIn) } }
        );
      }

      return null;
    },
  };
}
