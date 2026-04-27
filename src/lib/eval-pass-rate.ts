/**
 * Per-agent rolling 7-day eval pass rate.
 *
 * Used by `agent-confidence.ts` as one of 5 weighted confidence
 * signals. The factory was wiring `evalPassRate: null` until now —
 * that meant every response got the neutral 0.10 contribution
 * regardless of whether the agent had a recent eval failure history.
 *
 * SOURCE: `eval_runs` + `eval_run_results` tables (populated by
 * /api/cron/run-evals every 6 hours). For each agent, count
 * pass/fail across the last 7 days.
 *
 * STORAGE: in-memory cache with a 5-minute TTL. The eval pass-rate
 * doesn't change second-to-second — caching avoids 200 DB queries
 * per second under load.
 *
 * NEVER throws. Returns null on any DB error (caller treats null as
 * "no data, neutral confidence").
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("eval-pass-rate");

interface CacheEntry {
  rate: number | null;
  fetchedAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

/**
 * Get the rolling 7-day eval pass rate for a given agent slug.
 * Returns:
 *   - 0..1 when we have ≥3 eval runs in the window (statistical
 *     floor — fewer than 3 isn't a meaningful signal)
 *   - null when no data, when the table doesn't exist, or when the
 *     query failed
 *
 * Cached for 5 minutes per slug to avoid hammering the DB.
 */
export async function getAgentEvalPassRate(
  slug: string,
): Promise<number | null> {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.rate;
  }

  let rate: number | null = null;
  try {
    rate = await fetchFromDb(slug);
  } catch (err) {
    log.debug("eval-pass-rate read failed — returning null (neutral)", {
      slug,
      error: (err as Error).message,
    });
    rate = null;
  }

  cache.set(slug, { rate, fetchedAt: Date.now() });
  return rate;
}

async function fetchFromDb(slug: string): Promise<number | null> {
  // Lazy-load drizzle so this module stays cheap to require in
  // environments without a DB configured.
  if (!process.env.DATABASE_URL) return null;

  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  // Single aggregate query — count pass + total in the last 7 days.
  // Postgres bigint comes back as string; coerce.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE passed = true)::int AS passes,
      COUNT(*)::int AS total
    FROM eval_run_results
    WHERE agent_slug = ${slug}
      AND created_at >= ${since}
  `)) as unknown as Array<{ passes: number | string; total: number | string }>;

  const row = rows[0];
  if (!row) return null;
  const total = Number(row.total ?? 0);
  if (total < 3) return null; // not enough data for a meaningful rate
  const passes = Number(row.passes ?? 0);
  return Math.round((passes / total) * 100) / 100;
}

/** Test helper. */
export function __resetEvalPassRateCacheForTesting(): void {
  cache.clear();
}
