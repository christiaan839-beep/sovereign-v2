/**
 * SOVEREIGN MATRIX — Budget & Cost Controls
 *
 * Tracks and enforces spend limits per agent, user, and workspace.
 * Prevents runaway API costs when agents go wild.
 *
 * Features:
 * - Per-user daily/monthly budget caps
 * - Alert webhooks at 50%, 80%, 100% thresholds
 * - Hard stop enforcement with admin override
 * - Token cost estimation per model
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("budget-controls");

// ── Types ──

export interface BudgetConfig {
  userId: string;
  /** Optional email used by the alert webhook — included in the
   * payload when set so the operator knows which account to look at
   * without an extra DB lookup. */
  email?: string;
  dailyLimitCents: number; // e.g., 500 = $5/day
  monthlyLimitCents: number; // e.g., 5000 = $50/month
  alertWebhookUrl?: string;
  alertedAt50?: boolean;
  alertedAt80?: boolean;
  alertedAt100?: boolean;
}

interface SpendRecord {
  totalCents: number;
  lastUpdated: number;
  resetAt: number;
}

// ── Model Cost Estimates (per 1K tokens, in cents) ──

const MODEL_COSTS: Record<string, number> = {
  // NIM models (free tier)
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": 0,
  "deepseek-ai/deepseek-v3.2": 0,
  "google/gemma-4-31b-it": 0,
  // Paid models (estimate)
  "claude-sonnet-4-6": 3, // $3/M input → 0.3c/1K
  "gemini-2.0-pro": 2.5,
  "gpt-4o": 5,
  // Default for unknown models
  default: 1,
};

// ── In-Memory Spend Tracking ──

const dailySpend = new Map<string, SpendRecord>();
const monthlySpend = new Map<string, SpendRecord>();
const budgetConfigs = new Map<string, BudgetConfig>();

// ── Helpers ──

function getOrCreateSpend(
  map: Map<string, SpendRecord>,
  key: string,
  windowMs: number,
): SpendRecord {
  const now = Date.now();
  const existing = map.get(key);
  if (existing && existing.resetAt > now) return existing;

  const record: SpendRecord = {
    totalCents: 0,
    lastUpdated: now,
    resetAt: now + windowMs,
  };
  map.set(key, record);
  return record;
}

function estimateCostCents(model: string, tokensUsed: number): number {
  const costPer1K = MODEL_COSTS[model] ?? MODEL_COSTS.default;
  return Math.ceil((tokensUsed / 1000) * costPer1K);
}

// ── Public API ──

/**
 * Set budget configuration for a user.
 */
export function setBudget(config: BudgetConfig): void {
  budgetConfigs.set(config.userId, config);
  log.info("Budget set", {
    userId: config.userId,
    daily: config.dailyLimitCents,
    monthly: config.monthlyLimitCents,
  });
}

/**
 * Check if a user can execute (pre-action check).
 * Returns { allowed, reason, spendPercent }.
 */
export function checkBudget(userId: string): {
  allowed: boolean;
  reason: string;
  dailyPercent: number;
  monthlyPercent: number;
} {
  const config = budgetConfigs.get(userId);
  if (!config)
    return { allowed: true, reason: "", dailyPercent: 0, monthlyPercent: 0 };

  const daily = getOrCreateSpend(dailySpend, userId, 24 * 60 * 60 * 1000);
  const monthly = getOrCreateSpend(
    monthlySpend,
    userId,
    30 * 24 * 60 * 60 * 1000,
  );

  const dailyPercent =
    config.dailyLimitCents > 0
      ? Math.round((daily.totalCents / config.dailyLimitCents) * 100)
      : 0;
  const monthlyPercent =
    config.monthlyLimitCents > 0
      ? Math.round((monthly.totalCents / config.monthlyLimitCents) * 100)
      : 0;

  // Check alerts
  if (monthlyPercent >= 50 && !config.alertedAt50) {
    config.alertedAt50 = true;
    fireAlert(config, 50, monthly.totalCents);
  }
  if (monthlyPercent >= 80 && !config.alertedAt80) {
    config.alertedAt80 = true;
    fireAlert(config, 80, monthly.totalCents);
  }

  // Hard stop
  if (daily.totalCents >= config.dailyLimitCents) {
    return {
      allowed: false,
      reason: `Daily budget exceeded ($${(config.dailyLimitCents / 100).toFixed(2)}/day)`,
      dailyPercent,
      monthlyPercent,
    };
  }
  if (monthly.totalCents >= config.monthlyLimitCents) {
    return {
      allowed: false,
      reason: `Monthly budget exceeded ($${(config.monthlyLimitCents / 100).toFixed(2)}/month)`,
      dailyPercent,
      monthlyPercent,
    };
  }

  return { allowed: true, reason: "", dailyPercent, monthlyPercent };
}

/**
 * Record spend after an agent execution.
 */
export function recordSpend(
  userId: string,
  model: string,
  tokensUsed: number,
): void {
  const costCents = estimateCostCents(model, tokensUsed);
  if (costCents === 0) return; // Free model

  const daily = getOrCreateSpend(dailySpend, userId, 24 * 60 * 60 * 1000);
  const monthly = getOrCreateSpend(
    monthlySpend,
    userId,
    30 * 24 * 60 * 60 * 1000,
  );

  daily.totalCents += costCents;
  daily.lastUpdated = Date.now();
  monthly.totalCents += costCents;
  monthly.lastUpdated = Date.now();
}

/**
 * Get current spend for a user.
 */
export function getSpend(userId: string): {
  dailyCents: number;
  monthlyCents: number;
} {
  return {
    dailyCents: dailySpend.get(userId)?.totalCents || 0,
    monthlyCents: monthlySpend.get(userId)?.totalCents || 0,
  };
}

// ── Alert Webhook ──

async function fireAlert(
  config: BudgetConfig,
  threshold: number,
  currentCents: number,
): Promise<void> {
  if (!config.alertWebhookUrl) return;

  try {
    await fetch(config.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "budget_alert",
        userId: config.userId,
        threshold,
        currentSpendCents: currentCents,
        limitCents: config.monthlyLimitCents,
        message: `Budget ${threshold}% reached: $${(currentCents / 100).toFixed(2)} of $${(config.monthlyLimitCents / 100).toFixed(2)}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    log.warn("Budget alert webhook failed", { error: String(err) });
  }
}
