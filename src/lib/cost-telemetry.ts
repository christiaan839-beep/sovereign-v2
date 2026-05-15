/**
 * SOVEREIGN MATRIX — Cost telemetry aggregator (Cook 45 / Tier 6 #28)
 *
 * Pure aggregator over per-agent, per-model usage events. Powers
 * the CFO-friendly dashboard: spend by agent, spend by model, spend
 * by time window, top-N cost drivers, anomaly flag.
 *
 * Input: a stream of `UsageEvent` records (typically read from the
 * existing `generations` / `usage` Drizzle tables). Output: a
 * `TelemetryReport` that's JSON-serializable and embeds verbatim in
 * the dashboard payload.
 *
 * NO I/O. Composes with the existing usage tables via a caller-supplied
 * fetch.
 */

export interface UsageEvent {
  /** Stable agent slug (e.g. "lead-blitz"). */
  agentSlug: string;
  /** Stable model id (e.g. "nemotron-ultra-253b-v1"). */
  model: string;
  /** Cents the call cost. Integer. */
  costCents: number;
  /** Output tokens (rough proxy for usefulness). */
  outputTokens?: number;
  /** Unix ms. */
  occurredAt: number;
  /** Optional tenant scope. Aggregator can group by tenant if present. */
  tenantId?: string;
}

export interface SpendByKey {
  key: string;
  totalCents: number;
  callCount: number;
  avgCents: number;
  /** Share of total spend in this window (0..1). */
  share: number;
}

export interface TelemetryReport {
  windowStart: number;
  windowEnd: number;
  totalCents: number;
  callCount: number;
  byAgent: SpendByKey[];
  byModel: SpendByKey[];
  byTenant: SpendByKey[];
  /** Spend-per-call calls in the top 5 % — likely runaway prompts. */
  anomalies: UsageEvent[];
}

export interface TelemetryRequest {
  events: UsageEvent[];
  /** Window start (Unix ms). Inclusive. Defaults to min(events.occurredAt). */
  windowStart?: number;
  /** Window end (Unix ms). Exclusive. Defaults to max(events.occurredAt)+1. */
  windowEnd?: number;
  /** Max keys to return per grouping. Default 10. */
  topN?: number;
  /**
   * Anomaly threshold percentile (0..1). Default 0.95 — events
   * whose costCents exceeds the 95th percentile are flagged.
   */
  anomalyPercentile?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function aggregate(
  events: UsageEvent[],
  keyOf: (e: UsageEvent) => string | undefined,
  totalCents: number,
  topN: number,
): SpendByKey[] {
  const map = new Map<string, { totalCents: number; callCount: number }>();
  for (const e of events) {
    const k = keyOf(e);
    if (!k) continue;
    const cur = map.get(k) ?? { totalCents: 0, callCount: 0 };
    cur.totalCents += e.costCents;
    cur.callCount += 1;
    map.set(k, cur);
  }
  const rows: SpendByKey[] = [...map.entries()].map(([key, v]) => ({
    key,
    totalCents: v.totalCents,
    callCount: v.callCount,
    avgCents: v.callCount === 0 ? 0 : v.totalCents / v.callCount,
    share: totalCents === 0 ? 0 : v.totalCents / totalCents,
  }));
  rows.sort((a, b) => b.totalCents - a.totalCents);
  return rows.slice(0, topN);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Index of the value below which `p` fraction of events fall.
  // For [10,10,10,10,1000] at p=0.8 we want sorted[3] = 10 so the
  // outlier 1000 is flagged via strict-greater-than comparison.
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  );
  return sorted[idx];
}

// ── Public API ────────────────────────────────────────────────────────────

export function aggregateUsage(req: TelemetryRequest): TelemetryReport {
  const events = req.events;
  const topN = req.topN ?? 10;
  const anomalyP = req.anomalyPercentile ?? 0.95;

  let windowStart = req.windowStart;
  let windowEnd = req.windowEnd;
  if (windowStart === undefined && events.length > 0) {
    windowStart = Math.min(...events.map((e) => e.occurredAt));
  }
  if (windowEnd === undefined && events.length > 0) {
    windowEnd = Math.max(...events.map((e) => e.occurredAt)) + 1;
  }
  windowStart ??= 0;
  windowEnd ??= 0;

  const inWindow = events.filter(
    (e) => e.occurredAt >= windowStart! && e.occurredAt < windowEnd!,
  );

  const totalCents = inWindow.reduce((s, e) => s + e.costCents, 0);

  const byAgent = aggregate(inWindow, (e) => e.agentSlug, totalCents, topN);
  const byModel = aggregate(inWindow, (e) => e.model, totalCents, topN);
  const byTenant = aggregate(inWindow, (e) => e.tenantId, totalCents, topN);

  const cutoff = percentile(
    inWindow.map((e) => e.costCents),
    anomalyP,
  );
  // Don't flag everything when costs are uniform — require a true outlier.
  const anomalies =
    cutoff === 0 ? [] : inWindow.filter((e) => e.costCents > cutoff);

  return {
    windowStart,
    windowEnd,
    totalCents,
    callCount: inWindow.length,
    byAgent,
    byModel,
    byTenant,
    anomalies,
  };
}

/** Format cents as a human-readable dollar string. Pure helper. */
export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
