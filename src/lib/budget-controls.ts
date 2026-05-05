/**
 * SOVEREIGN MATRIX — Budget & Cost Controls (Postgres-backed)
 *
 * Hard cap on AI inference spend, per user, per day.
 *
 * The previous implementation stored spend in an in-memory Map. In a
 * serverless deployment that resets on every cold start, which means the
 * "hard cap" never actually fired in practice. This version reads spend
 * from the `usage` table (single source of truth, populated by
 * cost-ledger.recordLedgerEntry) and computes daily/monthly aggregates
 * via a single SQL query. Cold starts no longer reset the counter.
 *
 * Plan-based defaults come from src/lib/plans.ts (PlanDefinition.dailyBudgetCents).
 * No per-user overrides for v1 — keep config in plans.ts so it's audit-able
 * and revertable in code review.
 *
 * Free models (Cerebras, NIM, Ollama-local, Groq dev) cost 0 and never
 * consume budget. See model-prices.ts for the canonical price table.
 */

import { db } from "@/db";
import { usage } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { PLANS, type PlanId, normalizePlanId } from "@/lib/plans";
import { getModelPrice, calculateCostCents } from "@/lib/model-prices";
import { createLogger } from "@/lib/logger";

const log = createLogger("budget-controls");

// ── Types ────────────────────────────────────────────────────────────────

export interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  dailyCents: number;
  dailyLimitCents: number;
  dailyPercent: number;
  monthlyCents: number;
  plan: PlanId;
}

export interface SpendBreakdown {
  totalCents: number;
  byModel: Array<{ model: string; cents: number; calls: number }>;
}

// ── Tiny in-process cache (cuts DB hits during a request burst) ────────

interface CachedSpend {
  dailyCents: number;
  monthlyCents: number;
  cachedAt: number;
}
const SPEND_CACHE = new Map<string, CachedSpend>();
const SPEND_CACHE_TTL_MS = 5_000; // 5s — small enough to be safe, large enough to absorb bursts

function cacheKey(userId: string): string {
  return userId;
}

function readCache(userId: string): CachedSpend | null {
  const entry = SPEND_CACHE.get(cacheKey(userId));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > SPEND_CACHE_TTL_MS) {
    SPEND_CACHE.delete(cacheKey(userId));
    return null;
  }
  return entry;
}

function writeCache(userId: string, dailyCents: number, monthlyCents: number) {
  SPEND_CACHE.set(cacheKey(userId), {
    dailyCents,
    monthlyCents,
    cachedAt: Date.now(),
  });
}

/** Test-only: clear the cache so each test starts fresh. */
export function _resetBudgetCacheForTests(): void {
  SPEND_CACHE.clear();
}

// ── DB reads ─────────────────────────────────────────────────────────────

/** Sum cost_cents from the usage table for a given user since `since`. */
async function sumSpend(userId: string, since: Date): Promise<number> {
  try {
    const [row] = await db
      .select({
        cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
      })
      .from(usage)
      .where(and(eq(usage.userId, userId), gte(usage.createdAt, since)));
    return Number(row?.cents ?? 0);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      // Table missing in dev — fail open.
      return 0;
    }
    log.error("sumSpend failed — failing open to avoid blocking users", {
      error: msg,
      userId,
    });
    return 0;
  }
}

/**
 * Get the day boundary for "today" in UTC. We use UTC explicitly so a user
 * traveling between time zones can't reset their budget by toggling local
 * clock — and so different Vercel regions agree on the rollover instant.
 */
function dayStartUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function monthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Check whether `userId` may incur additional AI spend this request.
 *
 * Reads the current day's spend from `usage`, compares against the user's
 * plan's `dailyBudgetCents`, and returns a structured result. Always returns
 * synchronously through Promise — never throws (errors fail open with
 * structured logs so the platform can't accidentally lock everyone out
 * from a transient DB blip).
 */
export async function checkBudget(
  userId: string,
  planId?: string | null,
): Promise<BudgetCheck> {
  const plan = PLANS[normalizePlanId(planId ?? "free")];
  const dailyLimitCents = plan.dailyBudgetCents;

  // Fast path: cache hit.
  let dailyCents: number;
  let monthlyCents: number;
  const cached = readCache(userId);
  if (cached) {
    dailyCents = cached.dailyCents;
    monthlyCents = cached.monthlyCents;
  } else {
    [dailyCents, monthlyCents] = await Promise.all([
      sumSpend(userId, dayStartUtc()),
      sumSpend(userId, monthStartUtc()),
    ]);
    writeCache(userId, dailyCents, monthlyCents);
  }

  const dailyPercent =
    dailyLimitCents > 0 && dailyLimitCents !== Infinity
      ? Math.round((dailyCents / dailyLimitCents) * 100)
      : 0;

  // Hard cap. Equality is intentional — exactly at the cap = blocked.
  if (dailyLimitCents !== Infinity && dailyCents >= dailyLimitCents) {
    return {
      allowed: false,
      reason: `Daily budget exceeded ($${(dailyLimitCents / 100).toFixed(2)}/day on ${plan.name}). Resets at 00:00 UTC.`,
      dailyCents,
      dailyLimitCents,
      dailyPercent,
      monthlyCents,
      plan: normalizePlanId(planId ?? "free"),
    };
  }

  return {
    allowed: true,
    dailyCents,
    dailyLimitCents,
    dailyPercent,
    monthlyCents,
    plan: normalizePlanId(planId ?? "free"),
  };
}

/**
 * Record AI spend after an inference call. Writes to the `usage` table
 * with cost_cents derived from model-prices.ts.
 *
 * Fire-and-forget: callers should NOT await this on the hot path. Failures
 * are logged but never thrown — telemetry must never break the user's
 * actual request.
 *
 * If a model is free (provider returns price.free=true), the row is still
 * written for analytics but cost_cents is 0 — that way "how many free vs
 * paid calls did this user make" is queryable.
 */
export async function recordSpend(
  userId: string,
  modelId: string,
  inputTokens: number,
  outputTokens = 0,
  agentId = "agent",
): Promise<void> {
  const costCents = calculateCostCents(modelId, inputTokens, outputTokens);
  const price = getModelPrice(modelId);

  try {
    await db.insert(usage).values({
      userId,
      agentId,
      model: modelId,
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      costCents,
      provider: price.provider,
    });
    // Invalidate cache so the next checkBudget reads fresh.
    SPEND_CACHE.delete(cacheKey(userId));
  } catch (err) {
    log.warn("recordSpend write failed", {
      error: err instanceof Error ? err.message : String(err),
      userId,
      modelId,
    });
  }
}

/**
 * Get a user's current spend totals, with a per-model breakdown for today.
 * Used by the admin spend dashboard.
 */
export async function getSpend(userId: string): Promise<SpendBreakdown> {
  try {
    const rows = await db
      .select({
        model: usage.model,
        cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
        calls: sql<number>`COUNT(*)::int`,
      })
      .from(usage)
      .where(and(eq(usage.userId, userId), gte(usage.createdAt, dayStartUtc())))
      .groupBy(usage.model);

    let totalCents = 0;
    const byModel = rows.map((r) => {
      const cents = Number(r.cents ?? 0);
      totalCents += cents;
      return {
        model: String(r.model),
        cents,
        calls: Number(r.calls ?? 0),
      };
    });
    byModel.sort((a, b) => b.cents - a.cents);

    return { totalCents, byModel };
  } catch (err) {
    log.warn("getSpend failed", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return { totalCents: 0, byModel: [] };
  }
}

/**
 * Top spenders for the current day. Powers the admin dashboard so the
 * operator can see who's burning budget in real time.
 */
export async function getTopSpenders(
  limit = 25,
): Promise<Array<{ userId: string; cents: number; calls: number }>> {
  try {
    const rows = await db
      .select({
        userId: usage.userId,
        cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
        calls: sql<number>`COUNT(*)::int`,
      })
      .from(usage)
      .where(gte(usage.createdAt, dayStartUtc()))
      .groupBy(usage.userId)
      .orderBy(sql`SUM(${usage.costCents}) DESC NULLS LAST`)
      .limit(limit);

    return rows.map((r) => ({
      userId: String(r.userId),
      cents: Number(r.cents ?? 0),
      calls: Number(r.calls ?? 0),
    }));
  } catch (err) {
    log.warn("getTopSpenders failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
