/**
 * Per-user AI-spend cap.
 *
 * Reads the monthly sum of `usage.cost_cents` for a given user and
 * compares against their plan's hard cap. A user who exceeds their
 * limit gets a 402 Payment Required (or 429 if you treat spend as a
 * rate limit) at the `ai()` call site — before any LLM tokens burn.
 *
 * Why this exists:
 *   - Runaway loops in an agent can burn $100 of Claude in minutes.
 *     Without a cap, one bug is a five-figure bill.
 *   - A compromised API key should fail safely, not drain credits.
 *   - Free-plan users must be FORCIBLY bounded or the economics
 *     don't work. $0.50 / month hard cap = maybe 20 Claude calls.
 *
 * Failure modes:
 *   - DB unavailable → fail-OPEN (allowed=true). A Neon outage shouldn't
 *     halt every AI call. The subsequent billing reconciliation
 *     catches overages after the fact.
 *   - No userId         → fail-OPEN (treated as system call, not user).
 *   - No plan resolved  → fail-closed to FREE tier (most restrictive).
 *
 * Per-plan caps live in `src/lib/plans.ts` already; we read them
 * dynamically rather than hardcode to keep a single source of truth.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("spend-cap");

/* ─── Plan caps ───────────────────────────────────────────────── */

/**
 * Hard monthly cap in cents per plan. Reference:
 *   Free       → $0.50 / mo — enough to try things, not enough to exploit
 *   Starter    → $5.00
 *   Growth     → $25.00
 *   Node       → $100.00
 *   Enterprise → soft cap ($1000 warn, no block)
 *
 * Kept here (not in plans.ts) because plans.ts tracks features +
 * prices for the PURCHASE flow. This is internal cost enforcement,
 * a different concern. They can drift deliberately: a $199/mo plan
 * might allow $80/mo in AI spend (keeps margins positive).
 */
export const SPEND_CAPS_CENTS: Record<string, number | "unlimited"> = {
  free: 50,
  founder: 10_000, // founder program — high cap, human oversight
  starter: 500,
  growth: 2_500,
  node: 10_000,
  enterprise: "unlimited", // soft cap with alerts, not enforced at this layer
};

export function capForPlan(plan: string | null | undefined): number | "unlimited" {
  const normalized = (plan ?? "free").toLowerCase();
  return SPEND_CAPS_CENTS[normalized] ?? SPEND_CAPS_CENTS.free;
}

/* ─── Core query ──────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

export interface SpendCheckResult {
  allowed: boolean;
  /** Cents spent this billing period (month so far). */
  spentCents: number;
  /** The effective cap in cents, or Infinity for unlimited. */
  limitCents: number;
  /** Cents remaining in the period. -1 when unlimited. */
  remainingCents: number;
  /** "hard_block" | "unlimited" | "no_db_fail_open" | "empty_user_fail_open" */
  mode: string;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Look up how much the user has spent this month, compare to their
 * plan's cap. Graceful no-DB: returns allowed=true with empty stats
 * so the `ai()` call proceeds — this is fail-OPEN by design (see
 * module docstring).
 */
export async function checkSpendCap(args: {
  userId: string | null | undefined;
  plan: string | null | undefined;
}): Promise<SpendCheckResult> {
  if (!args.userId) {
    return {
      allowed: true,
      spentCents: 0,
      limitCents: Number.POSITIVE_INFINITY,
      remainingCents: -1,
      mode: "empty_user_fail_open",
    };
  }

  const cap = capForPlan(args.plan);
  if (cap === "unlimited") {
    return {
      allowed: true,
      spentCents: 0,
      limitCents: Number.POSITIVE_INFINITY,
      remainingCents: -1,
      mode: "unlimited",
    };
  }

  if (!databaseIsConfigured()) {
    return {
      allowed: true,
      spentCents: 0,
      limitCents: cap,
      remainingCents: cap,
      mode: "no_db_fail_open",
    };
  }

  const since = startOfCurrentMonth();

  try {
    const rows = await db
      .select({
        total: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
      })
      .from(usage)
      .where(
        and(
          eq(usage.userId, args.userId),
          gte(usage.createdAt, since),
        ),
      );

    const spent = Number(rows[0]?.total ?? 0);
    const remaining = Math.max(0, cap - spent);
    const allowed = spent < cap;
    return {
      allowed,
      spentCents: spent,
      limitCents: cap,
      remainingCents: remaining,
      mode: "hard_block",
    };
  } catch (err) {
    log.error("checkSpendCap query failed — failing open", {
      userId: args.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      allowed: true,
      spentCents: 0,
      limitCents: cap,
      remainingCents: cap,
      mode: "no_db_fail_open",
    };
  }
}
