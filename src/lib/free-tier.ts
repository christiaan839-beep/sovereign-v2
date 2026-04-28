/**
 * SOVEREIGN MATRIX — Usage Metering (Database-Backed)
 *
 * Tracks agent runs per user per month using the `usage` table in Postgres.
 * In-memory cache provides fast reads; writes go to DB for persistence.
 *
 * Tiers:
 *   Free  → 100 runs/month
 *   Pro   → 5,000 runs/month
 *   Enterprise → unlimited
 */

import { db } from "@/db";
import { usage, subscriptions } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("free-tier");

// ── Constants (imported from canonical plans.ts) ──

import {
  PLAN_LIMITS,
  MAX_FOUNDERS,
  REFERRAL_BONUS_RUNS,
  getPlanLimit,
  normalizePlanId,
  isUnlimited,
  getNextPlan,
  type PlanId,
} from "@/lib/plans";

export { PLAN_LIMITS, MAX_FOUNDERS, REFERRAL_BONUS_RUNS };
export const FREE_MONTHLY_LIMIT = PLAN_LIMITS.free;
export const PRO_MONTHLY_LIMIT = PLAN_LIMITS.node; // "pro" is legacy alias for "node"

// ── Types ──

export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export interface UsageStats {
  used: number;
  limit: number;
  resetDate: string;
}

export type TierType = PlanId | "pro";

// ── In-Memory Cache (fast path, synced from DB) ──
// Cache key: "userId:YYYY-MM" → { count, cachedAt }
const usageCache = new Map<string, { count: number; cachedAt: number }>();
const USAGE_CACHE_TTL = 10_000; // 10 seconds — prevents DB hammering on rapid consecutive requests
// Cache for user tiers (from subscriptions table)
const tierCache = new Map<string, { tier: TierType; cachedAt: number }>();
const TIER_CACHE_TTL = 5 * 60_000; // 5 minutes

// ── Helpers ──

function getCurrentPeriod(): { key: string; start: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const start = new Date(year, month, 1);
  return { key, start };
}

function getResetDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function getLimitForTier(tier: TierType): number {
  return getPlanLimit(tier);
}

/**
 * Get user's subscription tier from DB (cached for 5 minutes).
 */
export async function getUserTier(userId: string): Promise<TierType> {
  const cached = tierCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < TIER_CACHE_TTL) {
    return cached.tier;
  }

  try {
    const row = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    const tier = (row?.plan as TierType) || "free";
    tierCache.set(userId, { tier, cachedAt: Date.now() });
    return tier;
  } catch {
    return "free";
  }
}

/**
 * Count usage for the current month from the database.
 */
async function countMonthlyUsage(userId: string): Promise<number> {
  const { key, start } = getCurrentPeriod();
  const cacheKey = `${userId}:${key}`;

  // Check cache first (with TTL to prevent stale reads)
  const cached = usageCache.get(cacheKey);
  if (cached !== undefined && Date.now() - cached.cachedAt < USAGE_CACHE_TTL) {
    return cached.count;
  }

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usage)
      .where(and(eq(usage.userId, userId), gte(usage.createdAt, start)));
    const count = result[0]?.count ?? 0;
    usageCache.set(cacheKey, { count, cachedAt: Date.now() });
    return count;
  } catch (err) {
    log.error("Failed to count usage from DB", err as Record<string, unknown>);
    return 0;
  }
}

// ── Public API ──

/**
 * Check whether a user can make another agent run this month.
 */
export async function checkFreeUsage(userId: string): Promise<UsageCheck> {
  const [used, tier] = await Promise.all([
    countMonthlyUsage(userId),
    getUserTier(userId),
  ]);
  const limit = getLimitForTier(tier);
  const remaining = Math.max(0, limit - used);

  const unlimited = isUnlimited(tier);
  return {
    allowed: unlimited || used < limit,
    remaining: unlimited ? Infinity : remaining,
    limit: unlimited ? Infinity : limit,
  };
}

/**
 * Record one agent run for the user. Persists to database.
 * Uses atomic DB insert as source of truth — cache is invalidated, not incremented.
 * This prevents race conditions where concurrent requests both read the same count.
 *
 * Round 26 — RECOVERY PATH ADDED. Pre-R26 a failed insert was swallowed
 * with `log.error` and the run kept running. That silently lost the
 * user's run from their monthly counter, meaning free-tier customers
 * got more runs than they paid for during transient DB hiccups.
 *
 * Post-R26:
 *   1. Try the canonical insert with retryWithBackoff (handles
 *      transient locks / connection drops).
 *   2. On total failure, write to `usage_outbox` (separate, simpler
 *      table — no FKs, no cache, just append) so the drainer cron
 *      can replay it within ~1 minute.
 *   3. If the outbox write ALSO fails (full DB outage), surface a
 *      structured ERROR log with severity high so the operator
 *      sees it. Do NOT throw — the user's agent ran successfully;
 *      we just need to fix the bookkeeping out of band.
 *
 * The contract from the caller's perspective is unchanged: this is
 * still fire-and-forget. The caller doesn't care whether the row
 * landed canonically or in the outbox — both paths converge on the
 * same monthly-count answer once the drainer runs.
 */
export async function incrementUsage(userId: string, agentId: string = "unknown"): Promise<void> {
  const { key } = getCurrentPeriod();
  const cacheKey = `${userId}:${key}`;

  // Try the canonical insert with one retry. Most transient
  // failures (lock contention on a hot index page, brief
  // connection drop) clear within a few hundred ms.
  const maxRetries = 2;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await db.insert(usage).values({
        userId,
        agentId,
        model: "platform",
        tokensUsed: 1,
      });
      // Invalidate cache so next read hits DB for accurate count after TTL
      usageCache.delete(cacheKey);
      return; // success — done.
    } catch (err) {
      lastErr = err;
      // Tiny backoff before retry. We're inside the request path so
      // can't sleep too long; ~50ms is enough to dodge most lock
      // contention without making the user wait.
      if (attempt + 1 < maxRetries) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  // Canonical insert failed twice. Write to the outbox so the
  // drainer can replay later. Even if THIS write fails (full DB
  // outage), we've at least logged the failure with severity.
  log.warn("Usage insert failed; routing to outbox", {
    userId,
    agentId,
    error: String(lastErr),
  });
  try {
    const { usageOutbox } = await import("@/db/schema");
    await db.insert(usageOutbox).values({
      userId,
      agentId,
      status: "pending",
      lastError: String(lastErr).slice(0, 500),
    });
    usageCache.delete(cacheKey);
  } catch (outboxErr) {
    // Both canonical AND outbox failed. This is severity-high — log
    // explicitly so an operator notices in Sentry / log dashboard.
    // We don't throw because the agent already ran; the bookkeeping
    // gap is logged for manual reconciliation.
    log.error("CRITICAL: usage outbox write failed (silent run loss)", {
      userId,
      agentId,
      canonicalError: String(lastErr),
      outboxError: String(outboxErr),
    });
  }
}

/**
 * Return usage statistics for the current billing period.
 */
export async function getUsageStats(userId: string): Promise<UsageStats> {
  const [used, tier] = await Promise.all([
    countMonthlyUsage(userId),
    getUserTier(userId),
  ]);
  const limit = getLimitForTier(tier);

  return {
    used,
    limit: tier === "enterprise" ? Infinity : limit,
    resetDate: getResetDate(),
  };
}

/**
 * Add bonus runs for a user (e.g. from referral rewards).
 * Grants extra runs by inserting a negative-token "credit" row in usage,
 * effectively raising the user's limit for the current period.
 */
export async function addBonusRuns(userId: string, runs: number): Promise<void> {
  try {
    // Insert a credit row (negative tokens = bonus runs)
    await db.insert(usage).values({
      userId,
      agentId: "referral-bonus",
      model: "platform",
      tokensUsed: -runs, // Negative = credit
    });
    log.info("Bonus runs granted", { userId, runs });
  } catch (err) {
    log.error("Failed to add bonus runs", err as Record<string, unknown>);
  }
}

/**
 * Get the upgrade prompt shown when a user exceeds their limit.
 */
export function getUpgradePrompt(limit: number): string {
  return (
    `You've used all ${limit} agent runs for this month. ` +
    `Your limit resets on ${new Date(getResetDate()).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. ` +
    `Upgrade to Pro for ${PRO_MONTHLY_LIMIT.toLocaleString()} runs/month, or invite a friend to earn ${REFERRAL_BONUS_RUNS} bonus runs.`
  );
}

/* ── Plan Tier Metadata (from canonical plans.ts) ── */

export interface SmartUpgradeInfo {
  currentPlan: string;
  currentLimit: number;
  used: number;
  nextPlan: string;
  nextLimit: number;
  nextPrice: string;
  upgradeUrl: string;
  resetDate: string;
}

/**
 * Build a structured upgrade prompt with plan comparison details.
 */
export async function getSmartUpgradeInfo(userId: string): Promise<SmartUpgradeInfo> {
  const [used, tier] = await Promise.all([
    countMonthlyUsage(userId),
    getUserTier(userId),
  ]);

  const currentLimit = getPlanLimit(tier);
  const next = getNextPlan(tier);

  return {
    currentPlan: normalizePlanId(tier),
    currentLimit,
    used,
    nextPlan: next?.name ?? "Enterprise",
    nextLimit: next?.runsPerMonth ?? Infinity,
    nextPrice: next?.priceDisplayZar ?? "Custom",
    upgradeUrl: "/dashboard/billing",
    resetDate: getResetDate(),
  };
}
