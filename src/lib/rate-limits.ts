/**
 * RATE LIMITS — per-route-prefix middleware with Upstash sliding windows.
 *
 * Single source of truth for every rate limit in the platform. The
 * middleware imports `applyRateLimit()` and routes decisions through
 * this module so a route prefix can never accidentally ship without
 * a limit (compare to the old pattern where each route owned its own
 * limit call — easy to forget on new routes).
 *
 * Rate buckets (phase 1.5):
 *   /api/agents/*           60/min   by userId or IP
 *   /api/auth/*             10/min   by IP
 *   /api/webhooks/stripe    100/min  by IP  (sig verify happens in route handler)
 *   /api/playbooks/run      10/min   by userId
 *   /api/free/*             — uses existing free-tool-limits.ts, leave alone
 *   /api/_agents/*          100/min  legacy, existing behaviour preserved
 *
 * Fallback: when Upstash is not configured, uses an in-memory sliding
 * window per edge instance. Correct for dev and single-region; at scale
 * the per-instance limit is effectively N × window across N instances —
 * noted in ADR-0001 and accepted as a dev-tier trade-off.
 */

// Edge-safe: this module is imported by proxy.ts (middleware), which runs
// on the Edge runtime in production. No node:crypto, no fs, no drizzle.

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetInSeconds: number;
  rule: string;
}

type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number; limit?: number }>;
};

interface RateRule {
  /** Canonical name used in logs + header values */
  name: string;
  /** Path prefix (startsWith match). Order matters — first match wins. */
  prefix: string;
  /** Requests allowed per window */
  max: number;
  /** Window size (used both for Upstash config key and in-memory bucket) */
  windowSeconds: number;
  /** How to identify the caller */
  identify: "user_or_ip" | "ip_only" | "user_only";
  /** Skip this rule entirely (used for routes with their own limiter) */
  skip?: boolean;
}

const RULES: readonly RateRule[] = [
  // ─── SKIP: these have their own gate OR should never be throttled ───
  // Free tools have their own limiter via free-tool-limits.ts — skip here
  { name: "free-tools",       prefix: "/api/free/",           max: 0,    windowSeconds: 60, identify: "ip_only", skip: true },
  // Cron routes use the CRON_SECRET bearer — skipping rate limits
  // prevents accidental self-throttling when multiple crons tick at
  // the same minute boundary.
  { name: "cron",             prefix: "/api/cron/",           max: 0,    windowSeconds: 60, identify: "ip_only", skip: true },
  // Health endpoints are polled heavily by UptimeRobot + Vercel Cron —
  // rate limiting them would be self-defeating.
  { name: "health",           prefix: "/api/health/",         max: 0,    windowSeconds: 60, identify: "ip_only", skip: true },
  { name: "health-internal",  prefix: "/api/_health/",        max: 0,    windowSeconds: 60, identify: "ip_only", skip: true },
  // Internal routes carry CRON_SECRET or pair-header auth — no throttle.
  { name: "internal",         prefix: "/api/_internal/",      max: 0,    windowSeconds: 60, identify: "ip_only", skip: true },

  // ─── PER-IP (public endpoints — scrape/abuse defense) ───────────────
  // Catalog + leaderboard + recent-runs are public GETs. Heavy edge
  // caching absorbs most traffic; this limit stops a single IP from
  // hammering the origin.
  { name: "catalog",          prefix: "/api/catalog",         max: 120,  windowSeconds: 60, identify: "ip_only" },
  { name: "leaderboard",      prefix: "/api/leaderboard",     max: 60,   windowSeconds: 60, identify: "ip_only" },
  // ─── PUBLIC DEMO ENDPOINTS (expensive pipelines, tight caps) ─────
  // These sit BEFORE the generic /api/public/ rule (first match wins).
  // Each invocation triggers a real AI pipeline — abuse would burn
  // real money through Anthropic/NIM/Groq. Keep tight until we add
  // billing hooks to the demo endpoints.
  { name: "public-router-demo",  prefix: "/api/public/router-demo",  max: 5,   windowSeconds: 3600, identify: "ip_only" },
  { name: "public-verify-demo",  prefix: "/api/public/verify-demo",  max: 5,   windowSeconds: 3600, identify: "ip_only" },
  { name: "public-memory-demo",  prefix: "/api/public/memory-demo",  max: 10,  windowSeconds: 3600, identify: "ip_only" },
  // agent-builder-demo is the most expensive of all — it emits ~4000 output
  // tokens from Claude per call. Tightest cap (3/hour/IP) and a daily
  // budget gate lives inside the route handler itself.
  { name: "public-agent-builder-demo",
                                prefix: "/api/public/agent-builder-demo", max: 3,  windowSeconds: 3600, identify: "ip_only" },
  // ─── generic /api/public/* catch-all (catalog, atlas-edges, recent-runs) ─────
  { name: "public",           prefix: "/api/public/",         max: 120,  windowSeconds: 60, identify: "ip_only" },
  // Stripe's own retry can burst higher than our user-layer limit; the
  // signature verification inside the handler is the real gate.
  { name: "webhooks-stripe",  prefix: "/api/webhooks/stripe", max: 100,  windowSeconds: 60, identify: "ip_only" },
  { name: "webhooks",         prefix: "/api/webhooks/",       max: 100,  windowSeconds: 60, identify: "ip_only" },
  // Auth endpoints are the spray-attack surface — keep tight.
  { name: "auth",             prefix: "/api/auth/",           max: 10,   windowSeconds: 60, identify: "ip_only" },

  // ─── PER-USER (authenticated endpoints — fair-use) ─────────────────
  // Admin routes need tight limits for defense-in-depth; an exposed
  // session token shouldn't let an attacker scan the whole admin
  // surface in seconds.
  { name: "admin",            prefix: "/api/admin/",          max: 30,   windowSeconds: 60, identify: "user_only" },
  // Developer submission endpoint — each user gets a handful per minute.
  { name: "developers-submit",prefix: "/api/developers/submit", max: 10, windowSeconds: 60, identify: "user_only" },
  // Playbook submission — expensive, tight limit.
  { name: "playbook-run",     prefix: "/api/playbooks/run",   max: 10,   windowSeconds: 60, identify: "user_only" },
  // Other playbook endpoints (list/schedule CRUD) — wider budget.
  { name: "playbooks",        prefix: "/api/playbooks/",      max: 120,  windowSeconds: 60, identify: "user_or_ip" },
  // Credits/billing endpoints — user-level.
  { name: "credits",          prefix: "/api/credits/",        max: 60,   windowSeconds: 60, identify: "user_only" },
  // Voice session open — tight. WebSocket itself is Railway, not this.
  { name: "voice",            prefix: "/api/voice/",          max: 30,   windowSeconds: 60, identify: "user_only" },
  // Agents (public + authenticated paths).
  { name: "agents",           prefix: "/api/agents/",         max: 60,   windowSeconds: 60, identify: "user_or_ip" },
  // Legacy — preserve existing behaviour for /api/_agents/*
  { name: "agents-legacy",    prefix: "/api/_agents/",        max: 100,  windowSeconds: 60, identify: "user_or_ip" },
  // _admin legacy path (mirrors /api/admin/).
  { name: "admin-legacy",     prefix: "/api/_admin/",         max: 30,   windowSeconds: 60, identify: "user_only" },
  // _teams endpoint legacy.
  { name: "teams-legacy",     prefix: "/api/_teams/",         max: 60,   windowSeconds: 60, identify: "user_only" },
  // _payments legacy.
  { name: "payments-legacy",  prefix: "/api/_payments/",      max: 60,   windowSeconds: 60, identify: "user_or_ip" },

  // ─── DEFAULT: everything else under /api/ gets a moderate per-IP cap.
  // Placed LAST so the specific rules above win. Catches /api/approvals,
  // /api/contact, /api/waitlist, /api/integrations/*, etc.
  { name: "api-default",      prefix: "/api/",                max: 60,   windowSeconds: 60, identify: "user_or_ip" },
];

export function matchRule(pathname: string): RateRule | null {
  for (const rule of RULES) {
    if (pathname.startsWith(rule.prefix)) return rule;
  }
  return null;
}

// ── Upstash lazy singletons, one per (rule, window) combo ────────

const _limiterCache = new Map<string, UpstashLimiter | null>();

async function getLimiter(rule: RateRule): Promise<UpstashLimiter | null> {
  const key = `${rule.name}:${rule.max}:${rule.windowSeconds}`;
  if (_limiterCache.has(key)) return _limiterCache.get(key)!;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _limiterCache.set(key, null);
    return null;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(rule.max, `${rule.windowSeconds} s` as const),
      analytics: true,
      prefix: `sovereign:rl:${rule.name}`,
    });
    _limiterCache.set(key, limiter);
    return limiter;
  } catch {
    _limiterCache.set(key, null);
    return null;
  }
}

// ── In-memory fallback (per-edge-instance sliding window) ────────

interface Bucket {
  count: number;
  resetAt: number;
}
const memBuckets = new Map<string, Bucket>();
let reqCount = 0;

function memLimit(
  ruleKey: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const composite = `${ruleKey}:${identifier}`;
  const windowMs = windowSeconds * 1000;
  const bucket = memBuckets.get(composite);

  if (!bucket || now >= bucket.resetAt) {
    memBuckets.set(composite, { count: 1, resetAt: now + windowMs });
    cleanupMemBuckets(now);
    return { success: true, remaining: max - 1, reset: now + windowMs };
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { success: false, remaining: 0, reset: bucket.resetAt };
  }
  return { success: true, remaining: max - bucket.count, reset: bucket.resetAt };
}

function cleanupMemBuckets(now: number): void {
  reqCount++;
  if (reqCount % 250 !== 0) return;
  // Periodic sweep — cheap O(n) walk every ~250 req
  for (const [k, b] of memBuckets) {
    if (now >= b.resetAt) memBuckets.delete(k);
  }
  // Hard cap — shed oldest entries if we still have too many
  if (memBuckets.size > 2000) {
    const toRemove = memBuckets.size - 2000;
    let removed = 0;
    for (const k of memBuckets.keys()) {
      if (removed >= toRemove) break;
      memBuckets.delete(k);
      removed++;
    }
  }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Evaluate the rate limit for a given path + caller.
 *
 * Returns:
 *   - allowed=true  → proceed
 *   - allowed=false → middleware should return 429 with Retry-After
 *
 * The `rule.skip` path returns `allowed=true` with `rule="skipped:*"`
 * so middleware can log without counting.
 */
export async function applyRateLimit(
  pathname: string,
  identity: { userId?: string | null; ip?: string | null },
): Promise<RateLimitDecision> {
  const rule = matchRule(pathname);
  if (!rule) {
    // No rule matches — default allow (routes we haven't classified)
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      limit: Number.MAX_SAFE_INTEGER,
      resetInSeconds: 0,
      rule: "unmatched",
    };
  }
  if (rule.skip) {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      limit: Number.MAX_SAFE_INTEGER,
      resetInSeconds: 0,
      rule: `skipped:${rule.name}`,
    };
  }

  const identifier = resolveIdentifier(rule, identity);
  if (!identifier) {
    // user_only rule with no user → block. Prevents anonymous playbook-run.
    return {
      allowed: false,
      remaining: 0,
      limit: rule.max,
      resetInSeconds: rule.windowSeconds,
      rule: `${rule.name}:no-identity`,
    };
  }

  const limiter = await getLimiter(rule);
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        limit: result.limit ?? rule.max,
        resetInSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
        rule: rule.name,
      };
    } catch {
      // Upstash flaked — degrade to in-memory rather than 500
    }
  }

  const mem = memLimit(rule.name, identifier, rule.max, rule.windowSeconds);
  return {
    allowed: mem.success,
    remaining: mem.remaining,
    limit: rule.max,
    resetInSeconds: Math.max(0, Math.ceil((mem.reset - Date.now()) / 1000)),
    rule: `${rule.name}:mem`,
  };
}

function resolveIdentifier(
  rule: RateRule,
  identity: { userId?: string | null; ip?: string | null },
): string | null {
  const { userId, ip } = identity;
  switch (rule.identify) {
    case "user_only":
      return userId ?? null;
    case "ip_only":
      return ip ?? null;
    case "user_or_ip":
      return userId ?? ip ?? null;
  }
}

/** Response headers to attach to every rate-limited or allowed request. */
export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(Math.max(0, decision.remaining)),
    "X-RateLimit-Rule": decision.rule,
    ...(decision.allowed ? {} : { "Retry-After": String(decision.resetInSeconds) }),
  };
}
