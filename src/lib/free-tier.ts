/**
 * SOVEREIGN MATRIX — Hosted Free Tier System
 *
 * Users get 100 free agent runs per month using the platform's own API keys.
 * No setup required — just sign in and start using agents.
 *
 * Tiers:
 *   Free  → 100 runs/month
 *   Pro   → 5,000 runs/month
 *
 * In-memory store keyed by `userId:YYYY-MM` with automatic monthly reset.
 * In production, back this with a database (Drizzle + Neon).
 */

// ── Constants ──

export const FREE_MONTHLY_LIMIT = 100;
export const PRO_MONTHLY_LIMIT = 5000;
export const REFERRAL_BONUS_RUNS = 50;

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

export type TierType = "free" | "pro";

// ── In-Memory Store ──
// Maps "userId:YYYY-MM" → number of runs used this period

const usageStore = new Map<string, number>();

/**
 * Bonus runs awarded through referrals or promotions.
 * Maps userId → total bonus runs available (not period-scoped).
 */
const bonusRunsStore = new Map<string, number>();

/**
 * User tier overrides. Default is "free".
 * In production, read from the database / Clerk metadata.
 */
const tierStore = new Map<string, TierType>();

// ── Helpers ──

function getCurrentPeriodKey(userId: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${userId}:${year}-${month}`;
}

function getResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

function getUserTier(userId: string): TierType {
  return tierStore.get(userId) ?? "free";
}

function getLimitForTier(tier: TierType): number {
  return tier === "pro" ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;
}

// ── Public API ──

/**
 * Check whether a user can make another agent run this month.
 * Accounts for tier limit + any bonus runs from referrals.
 */
export function checkFreeUsage(userId: string): UsageCheck {
  const key = getCurrentPeriodKey(userId);
  const used = usageStore.get(key) ?? 0;
  const tier = getUserTier(userId);
  const baseLimit = getLimitForTier(tier);
  const bonus = bonusRunsStore.get(userId) ?? 0;
  const effectiveLimit = baseLimit + bonus;
  const remaining = Math.max(0, effectiveLimit - used);

  return {
    allowed: used < effectiveLimit,
    remaining,
    limit: effectiveLimit,
  };
}

/**
 * Record one agent run for the user in the current billing period.
 */
export function incrementUsage(userId: string): void {
  const key = getCurrentPeriodKey(userId);
  const current = usageStore.get(key) ?? 0;
  usageStore.set(key, current + 1);
}

/**
 * Return usage statistics for the current billing period.
 */
export function getUsageStats(userId: string): UsageStats {
  const key = getCurrentPeriodKey(userId);
  const used = usageStore.get(key) ?? 0;
  const tier = getUserTier(userId);
  const baseLimit = getLimitForTier(tier);
  const bonus = bonusRunsStore.get(userId) ?? 0;

  return {
    used,
    limit: baseLimit + bonus,
    resetDate: getResetDate(),
  };
}

/**
 * Add bonus runs for a user (e.g. from referral rewards).
 */
export function addBonusRuns(userId: string, runs: number): void {
  const current = bonusRunsStore.get(userId) ?? 0;
  bonusRunsStore.set(userId, current + runs);
}

/**
 * Set a user's tier. In production, sync this from Clerk/Stripe metadata.
 */
export function setUserTier(userId: string, tier: TierType): void {
  tierStore.set(userId, tier);
}

/**
 * Get the upgrade prompt shown when a user exceeds their limit.
 */
export function getUpgradePrompt(userId: string): string {
  const stats = getUsageStats(userId);
  return (
    `You've used all ${stats.limit} agent runs for this month. ` +
    `Your limit resets on ${new Date(stats.resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. ` +
    `Upgrade to Pro for ${PRO_MONTHLY_LIMIT.toLocaleString()} runs/month, or invite a friend to earn ${REFERRAL_BONUS_RUNS} bonus runs.`
  );
}
