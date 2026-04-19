/**
 * FREE TOOL RATE LIMITERS — distributed via Upstash, with in-memory fallback.
 *
 * Three buckets per ADR-0001:
 *   - emailLimit  : 10/hr/email (used when caller supplies an email)
 *   - ipLimit     : 3/hr/ip     (used when caller does not)
 *   - ipCeiling   : 20/hr/ip    (always applied, prevents fake-email spray)
 *
 * If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, the limiters
 * use Upstash sliding-window (correct across all edge instances, consistent
 * at 10K+ concurrent users). Otherwise we fall back to per-instance in-memory
 * Maps — correct for dev and single-region deployments, but effectively
 * `N × limit` across N edge instances on multi-region Vercel.
 *
 * See docs/adr/0001-free-tool-rate-limit-identity.md
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("free-tool-limits");

export const EMAIL_LIMIT = 10;       // runs / hour when email supplied
export const IP_LIMIT = 3;           // runs / hour when only IP
export const IP_CEILING = 20;        // absolute per-IP ceiling / hour
const WINDOW_MS = 60 * 60 * 1000;

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Where the count is stored right now, for observability. */
  backend: "upstash" | "memory";
}

type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

/* ─── Upstash lazy singletons ──────────────────────────────────────── */

// Module-load init eliminates the race where two concurrent first
// requests would each construct Upstash clients. The promise resolves
// once; all callers await the same settled value.

async function buildLimiter(prefix: string, limit: number): Promise<UpstashLimiter | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, "1 h"),
      analytics: true,
      prefix,
    });
  } catch (err) {
    log.warn("Upstash init failed — falling back to in-memory", {
      prefix,
      error: (err as Error).message,
    });
    return null;
  }
}

const limitersReady: Promise<{ email: UpstashLimiter | null; ip: UpstashLimiter | null; ceiling: UpstashLimiter | null }> =
  Promise.all([
    buildLimiter("sovereign:free:email", EMAIL_LIMIT),
    buildLimiter("sovereign:free:ip", IP_LIMIT),
    buildLimiter("sovereign:free:ceil", IP_CEILING),
  ]).then(([email, ip, ceiling]) => ({ email, ip, ceiling }));

/* ─── In-memory fallback — identical semantics at small scale ──────── */

type Window = { count: number; resetAt: number };
const memEmail = new Map<string, Window>();
const memIp = new Map<string, Window>();
const memCeiling = new Map<string, Window>();

function memTick(map: Map<string, Window>, key: string, limit: number, now: number): LimitResult {
  const w = map.get(key);
  if (!w || w.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, limit, backend: "memory" };
  }
  if (w.count >= limit) return { allowed: false, remaining: 0, limit, backend: "memory" };
  w.count += 1;
  return { allowed: true, remaining: limit - w.count, limit, backend: "memory" };
}

function memSweep(map: Map<string, Window>, now: number) {
  if (map.size < 5000) return;
  for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
}

/* ─── Public API ───────────────────────────────────────────────────── */

async function check(
  prefix: "sovereign:free:email" | "sovereign:free:ip" | "sovereign:free:ceil",
  key: string,
  limit: number,
  memMap: Map<string, Window>,
): Promise<LimitResult> {
  const limiters = await limitersReady;
  const limiter =
    prefix === "sovereign:free:email" ? limiters.email
    : prefix === "sovereign:free:ip" ? limiters.ip
    : limiters.ceiling;

  if (limiter) {
    try {
      const res = await limiter.limit(key);
      return { allowed: res.success, remaining: res.remaining, limit, backend: "upstash" };
    } catch (err) {
      // Upstash failed mid-flight — degrade to in-memory rather than 500
      log.warn("Upstash .limit threw — falling back to in-memory", {
        prefix,
        error: (err as Error).message,
      });
    }
  }

  const now = Date.now();
  memSweep(memMap, now);
  return memTick(memMap, key, limit, now);
}

export async function checkEmailLimit(email: string): Promise<LimitResult> {
  return check("sovereign:free:email", email, EMAIL_LIMIT, memEmail);
}

export async function checkIpLimit(ip: string): Promise<LimitResult> {
  return check("sovereign:free:ip", ip, IP_LIMIT, memIp);
}

export async function checkIpCeiling(ip: string): Promise<LimitResult> {
  return check("sovereign:free:ceil", ip, IP_CEILING, memCeiling);
}
