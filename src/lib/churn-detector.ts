/**
 * SOVEREIGN MATRIX — Usage decline detector.
 *
 * Detects accounts whose run volume is dropping fast — a strong leading
 * signal of churn. Sales/ops then get a daily list to act on (win-back
 * call, feature outreach, support check-in).
 *
 * Why this exists: the valuation audit found NRR/churn signals are at 3/10.
 * Saving 10% of churned ARR pays for itself an order of magnitude over.
 *
 *   import { detectUsageDecline } from "@/lib/churn-detector";
 *   const atRisk = await detectUsageDecline({ thresholdPct: 30 });
 *   //  → [{ userId, currentRuns, priorRuns, dropPct }]
 */
import { db } from "@/db";
import { usage, subscriptions } from "@/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";

export interface UsageDeclineRow {
  userId: string;
  plan: string;
  currentRuns: number;
  priorRuns: number;
  dropPct: number; // 0..100
}

export interface DetectOptions {
  /** Minimum % drop (current vs prior 30-day window) to flag. Default 30. */
  thresholdPct?: number;
  /** Window length in days. Default 30. */
  windowDays?: number;
  /** Only consider users whose prior window had at least this many runs.
   *  Filters out brand-new accounts where any drop is statistical noise. */
  minPriorRuns?: number;
  /** When provided, treats this as "now" (used by tests). */
  now?: Date;
}

/**
 * Compute the at-risk set. Pure-ish: only reads from the DB, no side effects.
 * Wraps the SQL so the cron route stays tiny and testable.
 */
export async function detectUsageDecline(
  opts: DetectOptions = {},
): Promise<UsageDeclineRow[]> {
  const thresholdPct = opts.thresholdPct ?? 30;
  const windowDays = opts.windowDays ?? 30;
  const minPriorRuns = opts.minPriorRuns ?? 5;
  const now = opts.now ?? new Date();

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - windowMs);
  const priorStart = new Date(now.getTime() - 2 * windowMs);

  // Pull paid subscribers — free users churn differently and need a
  // different playbook (upgrade prompt, not "we miss you").
  const paidSubs = await db
    .select({ userId: subscriptions.userId, plan: subscriptions.plan })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        sql`${subscriptions.plan} != 'free'`,
      ),
    );

  if (paidSubs.length === 0) return [];

  const results: UsageDeclineRow[] = [];

  // One window-pair lookup per user. We use parallelism with a small
  // concurrency cap to avoid stampeding the DB on big sub lists.
  const batchSize = 10;
  for (let i = 0; i < paidSubs.length; i += batchSize) {
    const batch = paidSubs.slice(i, i + batchSize);
    const rows = await Promise.all(
      batch.map(async (sub) => {
        const [currentRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(usage)
          .where(
            and(
              eq(usage.userId, sub.userId),
              gte(usage.createdAt, currentStart),
            ),
          );
        const [priorRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(usage)
          .where(
            and(
              eq(usage.userId, sub.userId),
              gte(usage.createdAt, priorStart),
              lt(usage.createdAt, currentStart),
            ),
          );
        const currentRuns = Number(currentRow?.count ?? 0);
        const priorRuns = Number(priorRow?.count ?? 0);

        if (priorRuns < minPriorRuns) return null;

        const dropPct = ((priorRuns - currentRuns) / priorRuns) * 100;
        if (dropPct < thresholdPct) return null;

        return {
          userId: sub.userId,
          plan: sub.plan,
          currentRuns,
          priorRuns,
          dropPct: Math.round(dropPct * 10) / 10,
        };
      }),
    );
    for (const r of rows) if (r) results.push(r);
  }

  // Sort highest-risk first so consumers can rate-limit outreach.
  results.sort((a, b) => b.dropPct - a.dropPct);
  return results;
}
