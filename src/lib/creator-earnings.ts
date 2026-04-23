/**
 * Creator earnings — library used by:
 *
 *   • invocation pipeline      → creditEarning() on every successful run
 *   • /dashboard/earnings       → summarizeForCreator() for the UI
 *   • /api/creators/earnings    → JSON response with the same shape
 *   • admin payout cron        → lockAndPayout() (future, Phase B+1)
 *
 * The 70/30 split is computed here, deliberately, ONCE, with rounding
 * rules that always favour the creator on odd cents. Every caller
 * gets the same numbers.
 *
 * Graceful no-DB: every function returns safe defaults without a
 * DATABASE_URL. Unit tests exercise the split math + the no-DB path.
 */

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatorEarnings, marketplaceAgents } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("creator-earnings");

/* ─── Split math (deterministic, unit-tested) ─────────────────── */

export const CREATOR_SHARE = 0.7; // 70% to creator, 30% to platform

/**
 * Compute the 70/30 split for an integer-cent amount.
 *
 * Rounding rule: `creatorCents = floor(gross * 0.7)`, then
 * `platformCents = gross - creatorCents`. This means on odd cents
 * (e.g. 5¢ gross), the creator gets 3¢ and the platform gets 2¢ —
 * rounding favours the creator rather than the platform. Consistent,
 * documented, never surprises anyone.
 */
export function splitEarnings(grossCents: number): {
  creatorCents: number;
  platformCents: number;
} {
  if (!Number.isFinite(grossCents) || grossCents < 0) {
    return { creatorCents: 0, platformCents: 0 };
  }
  const gross = Math.floor(grossCents);
  const creator = Math.floor(gross * CREATOR_SHARE);
  const platform = gross - creator;
  return { creatorCents: creator, platformCents: platform };
}

/* ─── Types ───────────────────────────────────────────────────── */

export interface CreditEarningInput {
  agentId: string;
  creatorEmail: string;
  /** Price charged to the user in cents. */
  grossCents: number;
  /** Optional external reference (playbook run id, job id, etc.). */
  invocationId?: string | null;
}

export interface CreatorEarningsSummary {
  creatorEmail: string;
  /** Lifetime totals across all agents. */
  lifetimeGrossCents: number;
  lifetimeCreatorCents: number;
  /** Rolling 30-day totals (creator share only). */
  thirtyDayCreatorCents: number;
  /** Paid vs pending creator-share split. */
  paidCreatorCents: number;
  pendingCreatorCents: number;
  /** Total invocation events recorded. */
  invocations: number;
}

export interface PerAgentEarnings {
  agentId: string;
  slug: string | null;
  name: string;
  invocations: number;
  creatorCents: number;
}

/* ─── Internals ───────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/* ─── Credit an earning event (write path) ────────────────────── */

/**
 * Record a single agent invocation's earnings. Idempotent on
 * invocationId — the unique partial index in migration 0028 enforces
 * "one earning row per invocation" so retrying a webhook never
 * double-credits.
 *
 * Returns `true` on write, `false` on skip (no DB, duplicate
 * invocationId, or DB error). Never throws.
 */
export async function creditEarning(
  input: CreditEarningInput,
): Promise<boolean> {
  if (!databaseIsConfigured()) return false;
  if (!input.agentId || !input.creatorEmail) return false;

  const { creatorCents, platformCents } = splitEarnings(input.grossCents);

  try {
    await db
      .insert(creatorEarnings)
      .values({
        agentId: input.agentId,
        creatorEmail: input.creatorEmail.toLowerCase(),
        invocationId: input.invocationId ?? null,
        grossCents: Math.max(0, Math.floor(input.grossCents)),
        creatorCents,
        platformCents,
        status: "pending",
      })
      .onConflictDoNothing();
    return true;
  } catch (err) {
    log.error("creditEarning failed", {
      agentId: input.agentId,
      creatorEmail: input.creatorEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/* ─── Summary queries (read path) ─────────────────────────────── */

export async function summarizeForCreator(
  creatorEmail: string,
): Promise<CreatorEarningsSummary> {
  const empty: CreatorEarningsSummary = {
    creatorEmail,
    lifetimeGrossCents: 0,
    lifetimeCreatorCents: 0,
    thirtyDayCreatorCents: 0,
    paidCreatorCents: 0,
    pendingCreatorCents: 0,
    invocations: 0,
  };
  if (!databaseIsConfigured() || !creatorEmail) return empty;

  const email = creatorEmail.toLowerCase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    // One query, five aggregates. Keeps the read path cheap.
    const rows = await db
      .select({
        lifetimeGross: sql<number>`COALESCE(SUM(${creatorEarnings.grossCents}), 0)::int`,
        lifetimeCreator: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}), 0)::int`,
        thirtyDayCreator: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}) FILTER (WHERE ${creatorEarnings.createdAt} >= ${thirtyDaysAgo}), 0)::int`,
        paidCreator: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}) FILTER (WHERE ${creatorEarnings.status} = 'paid'), 0)::int`,
        pendingCreator: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}) FILTER (WHERE ${creatorEarnings.status} = 'pending'), 0)::int`,
        invocations: count(creatorEarnings.id),
      })
      .from(creatorEarnings)
      .where(eq(creatorEarnings.creatorEmail, email));

    const row = rows[0];
    return {
      creatorEmail,
      lifetimeGrossCents: Number(row?.lifetimeGross ?? 0),
      lifetimeCreatorCents: Number(row?.lifetimeCreator ?? 0),
      thirtyDayCreatorCents: Number(row?.thirtyDayCreator ?? 0),
      paidCreatorCents: Number(row?.paidCreator ?? 0),
      pendingCreatorCents: Number(row?.pendingCreator ?? 0),
      invocations: Number(row?.invocations ?? 0),
    };
  } catch (err) {
    log.error("summarizeForCreator failed", {
      creatorEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
}

/**
 * Per-agent breakdown for a creator's dashboard. Returns one row per
 * agent that has at least one earning.
 */
export async function earningsByAgentForCreator(
  creatorEmail: string,
  sinceDays = 30,
): Promise<PerAgentEarnings[]> {
  if (!databaseIsConfigured() || !creatorEmail) return [];
  const email = creatorEmail.toLowerCase();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select({
        agentId: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        invocations: count(creatorEarnings.id),
        creatorCents: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}), 0)::int`,
      })
      .from(marketplaceAgents)
      .leftJoin(
        creatorEarnings,
        and(
          eq(creatorEarnings.agentId, marketplaceAgents.id),
          gte(creatorEarnings.createdAt, since),
        ),
      )
      .where(eq(marketplaceAgents.authorEmail, email))
      .groupBy(marketplaceAgents.id, marketplaceAgents.slug, marketplaceAgents.name)
      .orderBy(desc(sql`COALESCE(SUM(${creatorEarnings.creatorCents}), 0)`));

    return rows.map((r) => ({
      agentId: r.agentId,
      slug: r.slug,
      name: r.name,
      invocations: Number(r.invocations),
      creatorCents: Number(r.creatorCents),
    }));
  } catch (err) {
    log.error("earningsByAgentForCreator failed", {
      creatorEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
