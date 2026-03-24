/**
 * SOVEREIGN MATRIX: BUDGET ENFORCEMENT
 *
 * Three-tier budget controls for agent execution.
 * Tracks spending per user with alerts at 80% and hard stops at 100%.
 *
 * Uses the persist layer for daily/monthly usage tracking.
 */

import { persistRead, persistWrite } from "@/lib/persist";

// ── Types ──

export interface BudgetConfig {
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  alertThreshold: number; // 0.8 = alert at 80%
}

export interface BudgetCheckResult {
  allowed: boolean;
  remaining: number;
  percentUsed: number;
  warning?: string;
}

export interface BudgetStatus {
  daily: {
    used: number;
    limit: number;
    percentUsed: number;
    remaining: number;
  };
  monthly: {
    used: number;
    limit: number;
    percentUsed: number;
    remaining: number;
  };
  plan: string;
  warning?: string;
}

interface UsageRecord {
  tokens: number;
  timestamp: number;
}

// ── Plan Budgets ──

export const PLAN_BUDGETS: Record<string, BudgetConfig> = {
  free: {
    dailyTokenLimit: 50_000,
    monthlyTokenLimit: 500_000,
    alertThreshold: 0.8,
  },
  pro: {
    dailyTokenLimit: 500_000,
    monthlyTokenLimit: 5_000_000,
    alertThreshold: 0.8,
  },
  enterprise: {
    dailyTokenLimit: 5_000_000,
    monthlyTokenLimit: 50_000_000,
    alertThreshold: 0.8,
  },
};

// ── Key Helpers ──

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function dailyPersistKey(userId: string): string {
  return `budget:daily:${userId}:${todayKey()}`;
}

function monthlyPersistKey(userId: string): string {
  return `budget:monthly:${userId}:${monthKey()}`;
}

// ── Read current usage totals ──

function getDailyUsage(userId: string): number {
  const records = persistRead<UsageRecord[]>(dailyPersistKey(userId), []);
  return records.reduce((sum, r) => sum + r.tokens, 0);
}

function getMonthlyUsage(userId: string): number {
  const records = persistRead<UsageRecord[]>(monthlyPersistKey(userId), []);
  return records.reduce((sum, r) => sum + r.tokens, 0);
}

// ── Public API ──

/**
 * Record token usage for a user. Call this after every agent execution.
 */
export function recordUsage(userId: string, tokensUsed: number): void {
  const record: UsageRecord = { tokens: tokensUsed, timestamp: Date.now() };

  // Append to daily bucket
  const dailyRecords = persistRead<UsageRecord[]>(dailyPersistKey(userId), []);
  dailyRecords.push(record);
  persistWrite(dailyPersistKey(userId), dailyRecords);

  // Append to monthly bucket
  const monthlyRecords = persistRead<UsageRecord[]>(monthlyPersistKey(userId), []);
  monthlyRecords.push(record);
  persistWrite(monthlyPersistKey(userId), monthlyRecords);
}

/**
 * Check if a user has budget to spend the requested tokens.
 * Returns whether the request is allowed, remaining tokens, and any warnings.
 */
export function checkBudget(
  userId: string,
  plan: string,
  tokensToUse: number
): BudgetCheckResult {
  const config = PLAN_BUDGETS[plan] ?? PLAN_BUDGETS.free;

  const dailyUsed = getDailyUsage(userId);
  const monthlyUsed = getMonthlyUsage(userId);

  // Check against both daily and monthly limits
  const dailyAfter = dailyUsed + tokensToUse;
  const monthlyAfter = monthlyUsed + tokensToUse;

  const dailyPercent = dailyAfter / config.dailyTokenLimit;
  const monthlyPercent = monthlyAfter / config.monthlyTokenLimit;

  // Hard stop at 100% on either limit
  if (dailyPercent >= 1) {
    return {
      allowed: false,
      remaining: Math.max(0, config.dailyTokenLimit - dailyUsed),
      percentUsed: Math.min(1, dailyUsed / config.dailyTokenLimit),
      warning: `Daily token limit reached (${config.dailyTokenLimit.toLocaleString()} tokens). Resets at midnight.`,
    };
  }

  if (monthlyPercent >= 1) {
    return {
      allowed: false,
      remaining: Math.max(0, config.monthlyTokenLimit - monthlyUsed),
      percentUsed: Math.min(1, monthlyUsed / config.monthlyTokenLimit),
      warning: `Monthly token limit reached (${config.monthlyTokenLimit.toLocaleString()} tokens). Resets next month.`,
    };
  }

  // Warning at threshold
  let warning: string | undefined;
  const worstPercent = Math.max(
    dailyUsed / config.dailyTokenLimit,
    monthlyUsed / config.monthlyTokenLimit
  );

  if (dailyUsed / config.dailyTokenLimit >= config.alertThreshold) {
    warning = `Daily budget ${Math.round((dailyUsed / config.dailyTokenLimit) * 100)}% consumed. ${(config.dailyTokenLimit - dailyUsed).toLocaleString()} tokens remaining today.`;
  } else if (monthlyUsed / config.monthlyTokenLimit >= config.alertThreshold) {
    warning = `Monthly budget ${Math.round((monthlyUsed / config.monthlyTokenLimit) * 100)}% consumed. ${(config.monthlyTokenLimit - monthlyUsed).toLocaleString()} tokens remaining this month.`;
  }

  return {
    allowed: true,
    remaining: Math.min(
      config.dailyTokenLimit - dailyUsed,
      config.monthlyTokenLimit - monthlyUsed
    ),
    percentUsed: worstPercent,
    warning,
  };
}

/**
 * Get full budget status for dashboard display.
 */
export function getBudgetStatus(userId: string, plan: string): BudgetStatus {
  const config = PLAN_BUDGETS[plan] ?? PLAN_BUDGETS.free;

  const dailyUsed = getDailyUsage(userId);
  const monthlyUsed = getMonthlyUsage(userId);

  const dailyPercent = dailyUsed / config.dailyTokenLimit;
  const monthlyPercent = monthlyUsed / config.monthlyTokenLimit;

  let warning: string | undefined;
  if (dailyPercent >= 1) {
    warning = "Daily limit reached. Agent execution paused until midnight.";
  } else if (monthlyPercent >= 1) {
    warning = "Monthly limit reached. Upgrade your plan to continue.";
  } else if (dailyPercent >= config.alertThreshold) {
    warning = `Approaching daily limit (${Math.round(dailyPercent * 100)}% used).`;
  } else if (monthlyPercent >= config.alertThreshold) {
    warning = `Approaching monthly limit (${Math.round(monthlyPercent * 100)}% used).`;
  }

  return {
    daily: {
      used: dailyUsed,
      limit: config.dailyTokenLimit,
      percentUsed: Math.min(1, dailyPercent),
      remaining: Math.max(0, config.dailyTokenLimit - dailyUsed),
    },
    monthly: {
      used: monthlyUsed,
      limit: config.monthlyTokenLimit,
      percentUsed: Math.min(1, monthlyPercent),
      remaining: Math.max(0, config.monthlyTokenLimit - monthlyUsed),
    },
    plan,
    warning,
  };
}
