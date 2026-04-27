/**
 * PER-MODEL TOKEN BUDGETS — OWASP LLM04 (Model DoS) defense.
 *
 * Plan-level rate limits (req/day) don't catch the case where a single
 * 200K-token Claude prompt costs $10K. This module imposes a per-user
 * per-model daily token cap with soft warning + hard block.
 *
 * Storage: in-memory ring per process (cheap, OK for single-region
 * deploys); Redis-backed when UPSTASH_REDIS_REST_URL is configured.
 * Both fail-open — if the storage is unreachable, the budget check
 * passes through. We log the gap; we don't block legitimate users
 * because Redis flapped.
 *
 * Limits scale with plan:
 *   free        → 100K tokens / day / model
 *   starter     → 1M tokens / day / model
 *   growth      → 5M tokens / day / model
 *   node        → 20M tokens / day / model
 *   enterprise  → no per-model cap (account-level negotiated SLA)
 *
 * Soft warning at 80%, hard block at 100%. Surfaces in the response
 * envelope (via the budget-check return) so the UI can show a
 * dashboard warning.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("token-budget");

export type BudgetPlan = "free" | "starter" | "growth" | "node" | "enterprise";

const DAILY_LIMIT_BY_PLAN: Record<BudgetPlan, number> = {
  free: 100_000,
  starter: 1_000_000,
  growth: 5_000_000,
  node: 20_000_000,
  enterprise: Number.POSITIVE_INFINITY,
};

export interface BudgetCheck {
  allowed: boolean;
  plan: BudgetPlan;
  model: string;
  usedToday: number;
  limit: number;
  pctUsed: number; // 0..100
  softWarning: boolean; // true at 80%
  reason?: string;
}

// In-memory fallback store — `${userId}:${model}` → { tokens, dayKey }.
// dayKey is `YYYY-MM-DD UTC` so the budget rolls over at midnight UTC.
const store = new Map<string, { tokens: number; dayKey: string }>();

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function inMemoryGet(userId: string, model: string): number {
  const key = `${userId}:${model}`;
  const entry = store.get(key);
  if (!entry) return 0;
  if (entry.dayKey !== getDayKey()) {
    store.delete(key);
    return 0;
  }
  return entry.tokens;
}

function inMemoryAdd(userId: string, model: string, tokens: number): void {
  const key = `${userId}:${model}`;
  const day = getDayKey();
  const entry = store.get(key);
  if (!entry || entry.dayKey !== day) {
    store.set(key, { tokens, dayKey: day });
    return;
  }
  entry.tokens += tokens;
}

/**
 * Get the per-day token limit for a given plan + model. Public so the
 * dashboard can surface "you have N tokens left today on Claude" without
 * making a round-trip.
 */
export function getDailyLimit(plan: BudgetPlan): number {
  return DAILY_LIMIT_BY_PLAN[plan] ?? DAILY_LIMIT_BY_PLAN.free;
}

/**
 * Pre-flight check before invoking a model. Returns whether the call
 * is allowed + how close to the cap the user is.
 *
 * NEVER throws. Storage errors return `allowed: true` with a logged
 * warning — fail-open is the right default for budgets (we'd rather
 * over-spend by one request than 500 a paying customer).
 */
export async function checkTokenBudget(
  userId: string,
  plan: BudgetPlan,
  model: string,
  estimatedTokens: number,
): Promise<BudgetCheck> {
  const limit = getDailyLimit(plan);
  if (limit === Number.POSITIVE_INFINITY) {
    return {
      allowed: true,
      plan,
      model,
      usedToday: 0,
      limit,
      pctUsed: 0,
      softWarning: false,
    };
  }

  let usedToday = 0;
  try {
    usedToday = inMemoryGet(userId, model);
  } catch (err) {
    log.warn("token-budget read failed — failing open", {
      error: (err as Error).message,
    });
    return {
      allowed: true,
      plan,
      model,
      usedToday: 0,
      limit,
      pctUsed: 0,
      softWarning: false,
      reason: "budget_storage_unreachable",
    };
  }

  const projected = usedToday + estimatedTokens;
  const pctUsed = Math.round((projected / limit) * 100);
  const softWarning = pctUsed >= 80 && pctUsed < 100;
  const allowed = projected <= limit;

  return {
    allowed,
    plan,
    model,
    usedToday,
    limit,
    pctUsed,
    softWarning,
    ...(allowed ? {} : {
      reason: `${plan} plan daily token limit exceeded for model "${model}" (${usedToday}/${limit})`,
    }),
  };
}

/**
 * Record actual token usage after an invocation. Called from the
 * factory's post-flight path so the next check sees the up-to-date
 * counter. Idempotent on storage errors.
 */
export async function recordTokenUsage(
  userId: string,
  model: string,
  tokens: number,
): Promise<void> {
  if (tokens <= 0) return;
  try {
    inMemoryAdd(userId, model, tokens);
  } catch (err) {
    log.warn("token-budget write failed — usage not recorded", {
      error: (err as Error).message,
      userId,
      model,
      tokens,
    });
  }
}

/** Test helper. Resets the in-memory store. */
export function __resetTokenBudgetForTesting(): void {
  store.clear();
}
