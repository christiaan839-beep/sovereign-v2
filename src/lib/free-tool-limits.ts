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

let _email: UpstashLimiter | null | undefined;
let _ip: UpstashLimiter | null | undefined;
let _ceiling: UpstashLimiter | null | undefined;

async function getLimiter(
  cached: UpstashLimiter | null | undefined,
  prefix: string,
  limit: number,
): Promise<UpstashLimiter | null> {
  if (cached !== undefined) return cached;
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
  prefix: string,
  key: string,
  limit: number,
  memMap: Map<string, Window>,
): Promise<LimitResult> {
  const limiter =
    prefix === "sovereign:free:email" ? await getLimiter(_email, prefix, limit).then((l) => (_email = l))
    : prefix === "sovereign:free:ip" ? await getLimiter(_ip, prefix, limit).then((l) => (_ip = l))
    : await getLimiter(_ceiling, prefix, limit).then((l) => (_ceiling = l));

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
