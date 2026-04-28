/**
 * COST-RUNAWAY GUARD — bound the financial blast radius.
 *
 * Round 27 — The Permanence Sprint. Constitution Principle 7
 * ("bound the financial blast radius") operationalised.
 *
 * Why this exists: a single misconfigured agent, an A2E loop that
 * recurses 50 levels deep, or an attacker holding a stolen API key
 * could plausibly burn $10K of provider tokens in an hour. The
 * platform's worst plausible failure mode without this guard is
 * bankruptcy — and it's a failure mode where the operator finds
 * out via a Stripe email, not a Sentry alert.
 *
 * The guard:
 *   - Tracks per-tenant per-day cumulative spend in `tenant_cost_ledger`.
 *   - Enforces a daily cap (default $50, configurable per tenant
 *     plan). Exceeded → tenant gets `paused_at` set; subsequent
 *     agent calls 402 Payment Required until the next UTC rollover.
 *   - Operator gets paged on first pause (Sentry / Slack webhook).
 *   - Auto-unpaused at next UTC midnight (the day rolls over,
 *     a new ledger row starts at 0).
 *
 * The cap default ($50/day for free tier, $500/day for paid) is
 * generous — legitimate use should never hit it. The cap exists
 * to catch BUGS and ABUSE, not to ration normal users.
 *
 * Tenant-scoped via `userId` in every query. Atomic upsert via
 * INSERT … ON CONFLICT … DO UPDATE so concurrent agent calls don't
 * race on the counter.
 */

import { and, eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("cost-runaway");

/**
 * Default daily caps in cents. Plan-aware: free-tier users get a
 * tighter cap (since legitimate free use shouldn't hit much spend);
 * paid tiers get a looser cap that still bounds catastrophic abuse.
 *
 * Operators can override per-tenant via direct SQL on
 * `tenant_cost_ledger.pause_reason` — out of scope for this lib.
 */
const DAILY_CAP_CENTS_BY_PLAN: Record<string, number> = {
  free: 5_000,         // $50/day for free tier
  starter: 10_000,     // $100/day
  array: 25_000,       // $250/day for Growth
  node: 50_000,        // $500/day
  enterprise: 200_000, // $2000/day
  founder: 50_000,     // $500/day (founder = enterprise tier)
  pay_per_run: 50_000, // $500/day baseline; ad-hoc top-ups loosen it
};

const DEFAULT_CAP_CENTS = 5_000; // $50/day fallback when plan unknown

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

/** UTC day key for the ledger. Stable for the calendar day. */
function utcDayKey(d: Date = new Date()): string {
  // YYYY-MM-DD format. Postgres DATE column accepts this.
  return d.toISOString().slice(0, 10);
}

/**
 * Get the daily cap for a plan ID. Returns the default if the plan
 * isn't recognised (defensive — better to undercap a misconfigured
 * tenant than overcap them).
 */
export function getDailyCapCents(planId: string | null | undefined): number {
  if (!planId) return DEFAULT_CAP_CENTS;
  return DAILY_CAP_CENTS_BY_PLAN[planId] ?? DEFAULT_CAP_CENTS;
}

export interface CostCheckResult {
  /** True iff the tenant is BELOW the daily cap and may run. */
  allowed: boolean;
  /** Cumulative cents spent today. */
  spentCents: number;
  /** The cap that applied. */
  capCents: number;
  /** Human-readable reason when blocked. */
  reason?: string;
}

/**
 * Check whether a tenant is under the daily cap. Reads the ledger;
 * does NOT mutate. Call this BEFORE running an agent; if not
 * allowed, return 402 to the user.
 *
 * Returns `allowed: true` when DB is unavailable (fail-OPEN by
 * design — runaway protection that breaks the platform on a DB
 * blip is worse than no protection at all). The hard gate against
 * abuse is the per-provider circuit breaker; this is the
 * defence-in-depth layer.
 */
export async function checkTenantCostCap(input: {
  userId: string;
  planId: string | null;
}): Promise<CostCheckResult> {
  const capCents = getDailyCapCents(input.planId);

  const db = await getDb();
  if (!db) {
    return { allowed: true, spentCents: 0, capCents };
  }

  try {
    const { tenantCostLedger } = await import("@/db/schema");
    const today = utcDayKey();
    const rows = await db
      .select({
        costCents: tenantCostLedger.costCents,
        pausedAt: tenantCostLedger.pausedAt,
        pauseReason: tenantCostLedger.pauseReason,
      })
      .from(tenantCostLedger)
      .where(
        and(eq(tenantCostLedger.userId, input.userId), eq(tenantCostLedger.day, today)),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { allowed: true, spentCents: 0, capCents };
    }

    // If the ledger row says paused_at is set today, refuse.
    // The auto-unpause is implicit — tomorrow's day key produces
    // a new (or zero-cost) row.
    if (row.pausedAt) {
      return {
        allowed: false,
        spentCents: row.costCents,
        capCents,
        reason: row.pauseReason ?? "Daily cost cap reached",
      };
    }

    if (row.costCents >= capCents) {
      return {
        allowed: false,
        spentCents: row.costCents,
        capCents,
        reason: `Daily cap of $${(capCents / 100).toFixed(0)} reached (spent $${(row.costCents / 100).toFixed(2)})`,
      };
    }

    return { allowed: true, spentCents: row.costCents, capCents };
  } catch (err) {
    log.error("Cost cap check failed", { userId: input.userId, error: String(err) });
    // Fail-OPEN as designed — see top-of-file comment.
    return { allowed: true, spentCents: 0, capCents };
  }
}

/**
 * Record agent-run cost in the ledger. Atomic upsert: if the
 * (user, day) row exists, increment; otherwise insert.
 *
 * Triggers auto-pause if the post-increment cost crosses the cap.
 *
 * NEVER throws. Cost-tracking failures should never block the
 * user's response (the run already happened).
 *
 * Returns the post-increment cumulative cost so callers can log
 * "spent X today" without an extra query.
 */
export async function recordCost(input: {
  userId: string;
  costCents: number;
  capCents: number;
}): Promise<{ recorded: boolean; cumulativeCents: number; paused: boolean }> {
  // Zero-cost runs are a fast no-op regardless of DB state. Recorded
  // as "true" because there's nothing to record — incrementing by 0
  // would be a wasted round-trip. Order matters: check this BEFORE
  // the DB lookup so the function is total even when DB is missing.
  if (input.costCents <= 0) {
    return { recorded: true, cumulativeCents: 0, paused: false };
  }
  const db = await getDb();
  if (!db) {
    return { recorded: false, cumulativeCents: 0, paused: false };
  }

  const today = utcDayKey();

  try {
    const { tenantCostLedger } = await import("@/db/schema");
    const result = await db
      .insert(tenantCostLedger)
      .values({
        userId: input.userId,
        day: today,
        costCents: input.costCents,
        runCount: 1,
      })
      .onConflictDoUpdate({
        target: [tenantCostLedger.userId, tenantCostLedger.day],
        set: {
          costCents: sql`${tenantCostLedger.costCents} + ${input.costCents}`,
          runCount: sql`${tenantCostLedger.runCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({
        costCents: tenantCostLedger.costCents,
        pausedAt: tenantCostLedger.pausedAt,
      });

    const cumulativeCents = result[0]?.costCents ?? 0;
    const alreadyPaused = !!result[0]?.pausedAt;

    // Auto-pause crossing point: the row just crossed the cap and
    // wasn't already paused. Set paused_at to lock further runs.
    let paused = alreadyPaused;
    if (!alreadyPaused && cumulativeCents >= input.capCents) {
      await db
        .update(tenantCostLedger)
        .set({
          pausedAt: new Date(),
          pauseReason: `Daily cap of $${(input.capCents / 100).toFixed(0)} reached`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenantCostLedger.userId, input.userId),
            eq(tenantCostLedger.day, today),
          ),
        );
      paused = true;
      log.warn("Tenant auto-paused at cost cap", {
        userId: input.userId,
        cumulativeCents,
        capCents: input.capCents,
      });
    }

    return { recorded: true, cumulativeCents, paused };
  } catch (err) {
    log.error("Cost record failed", { userId: input.userId, error: String(err) });
    return { recorded: false, cumulativeCents: 0, paused: false };
  }
}

/**
 * Operator escape hatch — manually un-pause a tenant within a day
 * (e.g. after talking to the customer and confirming legitimate
 * usage). The auto-unpause at next UTC rollover happens regardless;
 * this is for early rescue.
 *
 * Returns false on DB error or no-op when the row didn't exist.
 */
export async function unpauseTenant(input: {
  userId: string;
  reason?: string;
}): Promise<{ unpaused: boolean }> {
  const db = await getDb();
  if (!db) return { unpaused: false };
  try {
    const { tenantCostLedger } = await import("@/db/schema");
    const today = utcDayKey();
    const result = await db
      .update(tenantCostLedger)
      .set({
        pausedAt: null,
        pauseReason: input.reason ? `Unpaused by operator: ${input.reason}` : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantCostLedger.userId, input.userId),
          eq(tenantCostLedger.day, today),
        ),
      )
      .returning({ id: tenantCostLedger.id });
    return { unpaused: result.length > 0 };
  } catch {
    return { unpaused: false };
  }
}

/**
 * Read-side admin surface — current ledger state for a tenant.
 * Used by the per-customer ops dashboard.
 */
export async function getTenantCostState(userId: string): Promise<{
  spentToday: number;
  runsToday: number;
  paused: boolean;
  pauseReason: string | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const { tenantCostLedger } = await import("@/db/schema");
    const today = utcDayKey();
    const rows = await db
      .select()
      .from(tenantCostLedger)
      .where(
        and(eq(tenantCostLedger.userId, userId), eq(tenantCostLedger.day, today)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      return { spentToday: 0, runsToday: 0, paused: false, pauseReason: null };
    }
    return {
      spentToday: row.costCents,
      runsToday: row.runCount,
      paused: !!row.pausedAt,
      pauseReason: row.pauseReason,
    };
  } catch {
    return null;
  }
}
