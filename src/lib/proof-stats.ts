/**
 * Proof-page aggregate stats — single source of truth.
 *
 * Both the public API endpoint (`/api/proof/stats`) and the public
 * page (`/proof`) call `getProofStats()` directly. No HTTP self-fetch
 * during static generation. No noisy log lines when the DB isn't
 * reachable at build time.
 *
 * Failure modes:
 *   - DATABASE_URL absent (build-phase / new install) → return zeros
 *     with `migrationsApplied: false`, no log emitted
 *   - 42P01 / 42703 (table or column missing) → same graceful zeros
 *   - any other DB error → log once at warn level (not error) and
 *     return zeros so the page renders an "unavailable" card instead
 *     of crashing
 *
 * Aggregate-only by design — no datum here exposes any single
 * customer's identity. Safe to render publicly.
 */

import { db } from "@/db";
import { tenants, customerDeliveries } from "@/db/schema";
import { isNotNull, sql, gte } from "drizzle-orm";
import { mondayOfWeek, mondayWeeksAgo } from "@/lib/delivery-week";
import { createLogger } from "@/lib/logger";

const log = createLogger("proof-stats");

export interface ProofStats {
  activeCustomers: number;
  totalDeliveriesShipped: number;
  leadsDelivered: number;
  thisWeekShipped: number;
  last4WeeksOnTimeRate: number;
  migrationsApplied: boolean;
  generatedAt: string;
}

function zeroPayload(migrationsApplied = false): ProofStats {
  return {
    activeCustomers: 0,
    totalDeliveriesShipped: 0,
    leadsDelivered: 0,
    thisWeekShipped: 0,
    last4WeeksOnTimeRate: 0,
    migrationsApplied,
    generatedAt: new Date().toISOString(),
  };
}

export async function getProofStats(): Promise<ProofStats> {
  // Up-front bail-out: if there's no DATABASE_URL we won't even try
  // the query. This is the single most common reason this function
  // would log an error at build time, and there's nothing to log —
  // the operator already knows their dev environment isn't wired.
  if (!process.env.DATABASE_URL) {
    return zeroPayload(false);
  }

  const thisMonday = mondayOfWeek();
  const fourMondaysAgo = mondayWeeksAgo(4);

  try {
    const [
      [{ count: activeCustomers = 0 } = { count: 0 }],
      [
        { count: totalDeliveriesShipped = 0, sum: leadsDelivered = 0 } = {
          count: 0,
          sum: 0,
        },
      ],
      [{ count: thisWeekShipped = 0 } = { count: 0 }],
      [{ count: last4Weeks = 0 } = { count: 0 }],
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(isNotNull(tenants.welcomeFirstName)),
      db
        .select({
          count: sql<number>`count(*)::int`,
          sum: sql<number>`coalesce(sum(${customerDeliveries.leadCount}),0)::int`,
        })
        .from(customerDeliveries),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerDeliveries)
        .where(sql`${customerDeliveries.deliveryDate} = ${thisMonday}`),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerDeliveries)
        .where(gte(customerDeliveries.deliveryDate, fourMondaysAgo)),
    ]);

    const denom = Math.max(activeCustomers * 4, 1);
    const last4WeeksOnTimeRate = Math.min(
      100,
      Math.round((last4Weeks / denom) * 100),
    );

    return {
      activeCustomers,
      totalDeliveriesShipped,
      leadsDelivered,
      thisWeekShipped,
      last4WeeksOnTimeRate,
      migrationsApplied: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      // Migrations 0019/0020 not applied yet. Quiet path — the
      // /proof page renders a "Setting up" card instead.
      return zeroPayload(false);
    }
    // Anything else is genuinely unexpected — log at warn (not error)
    // and degrade to zeros so the page still renders.
    log.warn("Proof stats query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return zeroPayload(false);
  }
}
