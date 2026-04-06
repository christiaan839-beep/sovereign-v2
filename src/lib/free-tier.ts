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
async function getUserTier(userId: string): Promise<TierType> {
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
 */
export async function incrementUsage(userId: string, agentId: string = "unknown"): Promise<void> {
  const { key } = getCurrentPeriod();
  const cacheKey = `${userId}:${key}`;

  // Persist to DB first (source of truth) — this is atomic
  try {
    await db.insert(usage).values({
      userId,
      agentId,
      model: "platform",
      tokensUsed: 1,
    });
    // Invalidate cache so next read hits DB for accurate count after TTL
    usageCache.delete(cacheKey);
  } catch (err) {
    log.error("Failed to record usage", err as Record<string, unknown>);
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
