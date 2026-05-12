/**
 * SOVEREIGN MATRIX — Receipt analytics (Cook 55 / Tier 6 #29 + #30)
 *
 * Pure data shapers for two dashboard surfaces:
 *
 *   #29 Receipt timeline — every receipt for a tenant in
 *       chronological order, bucketed by status (committed / drifted
 *       / replayed / failed). Drives the audit log UI.
 *
 *   #30 Diff visualization — given two receipts (typically: original
 *       and replay), render the structured field-by-field diff for
 *       side-by-side display. Composes with selective-disclosure +
 *       drift-detector modules.
 *
 * Pure module: no I/O. Caller passes ReceiptSummary[] from the DB;
 * this module aggregates + diffs.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type ReceiptStatus = "committed" | "drifted" | "replayed" | "failed";

export interface ReceiptSummary {
  id: string;
  agentSlug: string;
  status: ReceiptStatus;
  /** Unix ms. */
  committedAt: number;
  /** Optional: link to a replay of this receipt. */
  replayOf?: string;
  /** Optional: drift score 0..1 (1 = identical to original). */
  driftScore?: number;
  /** Final answer body — present for diffable receipts. */
  answer?: unknown;
  /** Optional canonical field bag (e.g. for selective-disclosure roots). */
  fields?: Record<string, unknown>;
}

export interface TimelineBucket {
  /** Inclusive start unix ms. */
  start: number;
  /** Exclusive end unix ms. */
  end: number;
  /** Human label (e.g. "2026-05-12"). */
  label: string;
  total: number;
  byStatus: Record<ReceiptStatus, number>;
  /** Top agent slugs by receipt count in this bucket. */
  topAgents: Array<{ agentSlug: string; count: number }>;
}

export interface TimelineRequest {
  receipts: ReceiptSummary[];
  /** "day" | "week". Default "day". */
  granularity?: "day" | "week";
  /** Window start unix ms. Default min(receipts.committedAt). */
  windowStart?: number;
  /** Window end unix ms (exclusive). Default max(committedAt) + 1ms. */
  windowEnd?: number;
}

export type DiffOp = "added" | "removed" | "changed" | "same";

export interface FieldDiff {
  field: string;
  op: DiffOp;
  before?: unknown;
  after?: unknown;
}

export interface ReceiptDiff {
  receiptA: string;
  receiptB: string;
  /** Per-field op list. Stable alphabetical ordering. */
  diffs: FieldDiff[];
  /** Convenience flags. */
  identical: boolean;
  changedFieldCount: number;
}

// ── Timeline ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function toUtcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function toUtcWeekStart(ms: number): number {
  const dayStart = toUtcDayStart(ms);
  const dow = new Date(dayStart).getUTCDay(); // 0 = Sun
  return dayStart - dow * DAY_MS;
}

function formatBucketLabel(start: number, granularity: "day" | "week"): string {
  const d = new Date(start);
  const iso = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return granularity === "week" ? `Week of ${iso}` : iso;
}

/** Group receipts into time buckets with status counts + top agents. */
export function buildTimeline(req: TimelineRequest): TimelineBucket[] {
  const granularity = req.granularity ?? "day";
  const bucketSize = granularity === "week" ? WEEK_MS : DAY_MS;
  const startOf = granularity === "week" ? toUtcWeekStart : toUtcDayStart;

  if (req.receipts.length === 0) return [];

  const windowStart =
    req.windowStart ?? Math.min(...req.receipts.map((r) => r.committedAt));
  const windowEnd =
    req.windowEnd ?? Math.max(...req.receipts.map((r) => r.committedAt)) + 1;

  const inWindow = req.receipts.filter(
    (r) => r.committedAt >= windowStart && r.committedAt < windowEnd,
  );

  // Group.
  const groups = new Map<number, ReceiptSummary[]>();
  for (const r of inWindow) {
    const bucket = startOf(r.committedAt);
    const arr = groups.get(bucket) ?? [];
    arr.push(r);
    groups.set(bucket, arr);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
  return sortedKeys.map((start) => {
    const items = groups.get(start)!;
    const byStatus: Record<ReceiptStatus, number> = {
      committed: 0,
      drifted: 0,
      replayed: 0,
      failed: 0,
    };
    const agentCounts = new Map<string, number>();
    for (const r of items) {
      byStatus[r.status]++;
      agentCounts.set(r.agentSlug, (agentCounts.get(r.agentSlug) ?? 0) + 1);
    }
    const topAgents = [...agentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agentSlug, count]) => ({ agentSlug, count }));
    return {
      start,
      end: start + bucketSize,
      label: formatBucketLabel(start, granularity),
      total: items.length,
      byStatus,
      topAgents,
    };
  });
}

// ── Diff ──────────────────────────────────────────────────────────────────

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compute a field-by-field diff between two receipts. The `fields`
 * map drives the diff — receipts without it fall back to comparing
 * `answer`.
 */
export function diffReceipts(
  a: ReceiptSummary,
  b: ReceiptSummary,
): ReceiptDiff {
  const fieldsA = a.fields ?? { answer: a.answer };
  const fieldsB = b.fields ?? { answer: b.answer };
  const allKeys = new Set<string>([
    ...Object.keys(fieldsA),
    ...Object.keys(fieldsB),
  ]);
  const sortedKeys = [...allKeys].sort();
  const diffs: FieldDiff[] = [];
  for (const k of sortedKeys) {
    const inA = k in fieldsA;
    const inB = k in fieldsB;
    const va = fieldsA[k];
    const vb = fieldsB[k];
    if (inA && !inB) {
      diffs.push({ field: k, op: "removed", before: va });
    } else if (!inA && inB) {
      diffs.push({ field: k, op: "added", after: vb });
    } else if (shallowEqual(va, vb)) {
      diffs.push({ field: k, op: "same", before: va, after: vb });
    } else {
      diffs.push({ field: k, op: "changed", before: va, after: vb });
    }
  }
  const changedFieldCount = diffs.filter((d) => d.op !== "same").length;
  return {
    receiptA: a.id,
    receiptB: b.id,
    diffs,
    identical: changedFieldCount === 0,
    changedFieldCount,
  };
}
