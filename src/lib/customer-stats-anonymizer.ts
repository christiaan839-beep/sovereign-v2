/**
 * customer-stats-anonymizer.ts
 *
 * Determines what platform-wide stats are safe to publish on
 * /trust/customers. The decision is a privacy-vs-trust trade-off
 * with multiple defensible answers; this file is the single
 * source of truth for "what we publish".
 *
 * Constitution Principle 5 ("numbers don't lie") demands honest
 * data. Constitution Principle 7 ("bound the blast radius") demands
 * we don't accidentally leak revenue, customer identity, or per-
 * tenant volumes that could let competitors estimate ARR.
 *
 * The implementation lives here so the decision is auditable.
 */

export interface RawPlatformStats {
  /** Total runs in the window (raw count). */
  totalRuns: number;
  /** Total successful runs in the window. */
  totalSuccesses: number;
  /** Distinct active users in the window. */
  distinctUsers: number;
  /** Distinct agents that ran in the window. */
  distinctAgents: number;
  /** Average run duration ms (calc'd platform-wide). */
  avgDurationMs: number | null;
  /** Window in days. */
  windowDays: number;
}

export interface PublishedPlatformStats {
  /** Headline label (procurement-friendly). */
  headline: string;
  /** Success rate (% with 1 decimal). */
  successRatePct: number | null;
  /** Run-volume bucket (NEVER absolute under threshold). */
  runVolumeBucket: string;
  /** User-volume bucket. */
  userVolumeBucket: string;
  /** Avg-latency in seconds (single decimal). */
  avgLatencySec: number | null;
  /** Distinct-agents count (always exact — agents are public). */
  distinctAgents: number;
  /** Window in days. */
  windowDays: number;
}

/**
 * Bucket helper — maps a raw count to a published range. Exact
 * numbers below a threshold are suppressed (early-stage absolute
 * numbers can be sensitive); ranges grow logarithmically.
 *
 * The threshold + bucket boundaries are the user-customizable knob
 * (see USER CONTRIBUTION block below in publishStats).
 */
export function bucketCount(
  raw: number,
  config: {
    /** Below this, we report "<= threshold" rather than a number. */
    suppressionThreshold: number;
    /** The set of bucket upper bounds (sorted ascending). */
    bucketBounds: number[];
  },
): string {
  if (raw < config.suppressionThreshold) {
    return `under ${config.suppressionThreshold.toLocaleString()}`;
  }
  for (const bound of config.bucketBounds) {
    if (raw < bound) {
      // Find the bucket: previous bound (or threshold) → this bound.
      const idx = config.bucketBounds.indexOf(bound);
      const lower =
        idx === 0
          ? config.suppressionThreshold
          : config.bucketBounds[idx - 1];
      return `${lower.toLocaleString()}–${bound.toLocaleString()}`;
    }
  }
  // Above the largest bucket — report as "Nk+".
  const last = config.bucketBounds[config.bucketBounds.length - 1];
  return `${last.toLocaleString()}+`;
}

/**
 * Convert raw stats into the published form.
 *
 * ─── USER CONTRIBUTION POINT ────────────────────────────────────
 *
 * The four constants below are the privacy/trust trade-off knob.
 * All four are defensible:
 *
 * 1. CONSERVATIVE (safest, least informative)
 *      RUN_THRESHOLD: 10_000
 *      USER_THRESHOLD: 100
 *      RUN_BUCKETS: [25_000, 100_000, 1_000_000]
 *      USER_BUCKETS: [500, 2_500, 10_000]
 *    → "under 10K runs" / "100-500 users"
 *
 * 2. STANDARD (current default — balanced)
 *      RUN_THRESHOLD: 1_000
 *      USER_THRESHOLD: 25
 *      RUN_BUCKETS: [5_000, 25_000, 100_000, 1_000_000]
 *      USER_BUCKETS: [100, 500, 2_500, 10_000]
 *    → procurement-friendly, but reveals platform is past pilot
 *
 * 3. AGGRESSIVE (most informative, possibly more revealing)
 *      RUN_THRESHOLD: 100
 *      USER_THRESHOLD: 5
 *      RUN_BUCKETS: [500, 2_000, 10_000, 50_000, 250_000, 1_000_000]
 *      USER_BUCKETS: [25, 100, 500, 2_500, 10_000]
 *    → tight ranges; competitors could estimate revenue at low end
 *
 * 4. EXACT (no bucketing — full honesty)
 *      Use raw numbers. Strongest trust signal. Real risk: at
 *      early-stage scale, an exact "473 users" tells competitors
 *      exactly how big the business is.
 *
 * SHIPPED CHOICE (R29): STANDARD posture.
 *
 * Rationale: the platform is past pilot but pre-mass-scale. Conservative
 * thresholds (10K runs / 100 users) would suppress every legitimate
 * range a procurement reviewer needs to evaluate. Aggressive (100 / 5)
 * leaks too much at our current scale. Exact would let competitors
 * estimate ARR.
 *
 * Standard hits the procurement-friendly band: "1,000–5,000 runs" or
 * "25–100 users" is informative AND non-revealing. When platform
 * scale grows past the upper buckets (1M+ runs / 10K+ users), the
 * "1M+" / "10K+" labels naturally take over.
 *
 * Revisit this when monthly active users cross 5,000 or annual run
 * count crosses 1M. At that point, Aggressive becomes the right call —
 * the absolute numbers are no longer business-sensitive.
 *
 * ────────────────────────────────────────────────────────────────
 */
export const PUBLISHED_STATS_CONFIG = {
  RUN_SUPPRESSION_THRESHOLD: 1_000,
  RUN_BUCKETS: [5_000, 25_000, 100_000, 1_000_000],
  USER_SUPPRESSION_THRESHOLD: 25,
  USER_BUCKETS: [100, 500, 2_500, 10_000],
} as const;

export function publishStats(raw: RawPlatformStats): PublishedPlatformStats {
  const successRatePct =
    raw.totalRuns > 0
      ? Number(((raw.totalSuccesses / raw.totalRuns) * 100).toFixed(1))
      : null;
  const avgLatencySec =
    raw.avgDurationMs !== null
      ? Number((raw.avgDurationMs / 1000).toFixed(1))
      : null;

  return {
    headline: `Last ${raw.windowDays} days, anonymized`,
    successRatePct,
    runVolumeBucket: bucketCount(raw.totalRuns, {
      suppressionThreshold: PUBLISHED_STATS_CONFIG.RUN_SUPPRESSION_THRESHOLD,
      bucketBounds: [...PUBLISHED_STATS_CONFIG.RUN_BUCKETS],
    }),
    userVolumeBucket: bucketCount(raw.distinctUsers, {
      suppressionThreshold:
        PUBLISHED_STATS_CONFIG.USER_SUPPRESSION_THRESHOLD,
      bucketBounds: [...PUBLISHED_STATS_CONFIG.USER_BUCKETS],
    }),
    avgLatencySec,
    distinctAgents: raw.distinctAgents,
    windowDays: raw.windowDays,
  };
}
