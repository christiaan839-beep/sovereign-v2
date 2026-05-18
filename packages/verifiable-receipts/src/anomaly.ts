/**
 * Receipt anomaly detection — statistical outlier detection over
 * receipt sets.
 *
 * Operationally, regulators + SOC teams need to know:
 *
 *   1. Did the block-rate for a specific Guardian pack suddenly
 *      spike? (Could indicate an attacker probing the agent.)
 *   2. Did a specific rule start firing much more than baseline?
 *      (Could indicate prompt-injection success or model drift.)
 *   3. Did the receipt volume burst beyond historical norms?
 *      (Could indicate runaway agent, abuse, or DDoS-like load.)
 *   4. Was there an unusually long quiet period?
 *      (Could indicate outage, key rotation gone wrong, or
 *      adversarial silence.)
 *   5. Did a never-before-seen agent slug appear? (Could indicate
 *      lateral movement or unauthorized deployment.)
 *
 * This module is Apache 2.0, pure-stdlib, side-effect-free. Callers
 * supply a `ReceiptRecord[]` (same shape used by the Receipt-Audit
 * DSL). The detector returns an `AnomalyReport` describing what
 * looks unusual + a severity tier.
 *
 * The math: simple Z-score over windowed buckets. No ML, no
 * external deps, no surprises. An auditor can mechanically
 * re-derive every detection by hand.
 *
 * @packageDocumentation
 */

import type { ReceiptRecord } from "./audit-dsl.js";

export type AnomalyKind =
  | "block-rate-spike"
  | "rule-failure-drift"
  | "volume-burst"
  | "quiet-period"
  | "new-agent";

export type AnomalySeverity = "info" | "warn" | "critical";

export interface Anomaly {
  kind: AnomalyKind;
  severity: AnomalySeverity;
  /** Human-readable description of what was detected. */
  description: string;
  /** Z-score where applicable (block-rate, volume, rule-drift). */
  zScore?: number;
  /** Affected slug — rule id, agent slug, pack id. */
  affectedField?: string;
  /** Receipts in the detection window. */
  windowReceipts?: number;
  /** Receipts in the baseline window (everything before). */
  baselineReceipts?: number;
  /** ISO 8601 of when this anomaly was raised. */
  detectedAt: string;
}

export interface AnomalyOptions {
  /**
   * How recent counts as "now" for spike detection. Default: last
   * 10% of receipts (by count, not time), minimum 10. Use this when
   * receipt arrival times are bursty.
   */
  windowSize?: number;
  /**
   * Z-score threshold for `warn` severity. Default 2.0 (≈ p < 0.05
   * under normal assumption).
   */
  warnZ?: number;
  /**
   * Z-score threshold for `critical` severity. Default 3.5 (≈ p <
   * 0.001).
   */
  criticalZ?: number;
  /**
   * Maximum allowed gap between consecutive receipts before flagging
   * a quiet period. Default 6 hours.
   */
  maxGapHours?: number;
}

export interface AnomalyReport {
  /** ISO 8601 of report generation. */
  detectedAt: string;
  /** Window size used for the analysis. */
  windowSize: number;
  /** Total receipts scanned. */
  totalReceipts: number;
  /** Baseline stats across the full input. */
  baselineStats: {
    passRate: number;
    warnRate: number;
    blockRate: number;
  };
  /** All anomalies detected, severity-sorted (critical first). */
  anomalies: Anomaly[];
}

const DEFAULT_WARN_Z = 2.0;
const DEFAULT_CRITICAL_Z = 3.5;
const DEFAULT_MAX_GAP_HOURS = 6;

/**
 * Run anomaly detection over a receipt set.
 *
 * Returns immediately on empty / tiny inputs (need ≥ 20 receipts
 * to compute meaningful baseline stats). Read-only — does not
 * mutate the input array.
 */
export function detectAnomalies(
  receipts: readonly ReceiptRecord[],
  opts: AnomalyOptions = {},
): AnomalyReport {
  const detectedAt = new Date().toISOString();
  const total = receipts.length;
  const warnZ = opts.warnZ ?? DEFAULT_WARN_Z;
  const criticalZ = opts.criticalZ ?? DEFAULT_CRITICAL_Z;
  const maxGapMs = (opts.maxGapHours ?? DEFAULT_MAX_GAP_HOURS) * 3600 * 1000;

  // Default window: last 10% of receipts, minimum 10.
  const windowSize = Math.max(10, opts.windowSize ?? Math.ceil(total * 0.1));

  const baseline = {
    passRate: 0,
    warnRate: 0,
    blockRate: 0,
  };

  if (total === 0) {
    return {
      detectedAt,
      windowSize,
      totalReceipts: 0,
      baselineStats: baseline,
      anomalies: [],
    };
  }

  // ── Compute baseline rates over the full input ──────────────────
  let passCount = 0;
  let warnCount = 0;
  let blockCount = 0;
  for (const r of receipts) {
    if (r.overall === "pass") passCount += 1;
    else if (r.overall === "warn") warnCount += 1;
    else if (r.overall === "block") blockCount += 1;
  }
  baseline.passRate = passCount / total;
  baseline.warnRate = warnCount / total;
  baseline.blockRate = blockCount / total;

  const anomalies: Anomaly[] = [];

  // Need at least 20 receipts to compute meaningful Z-scores
  // (smaller samples produce wildly unstable stats).
  if (total < 20) {
    return {
      detectedAt,
      windowSize,
      totalReceipts: total,
      baselineStats: baseline,
      anomalies,
    };
  }

  // Sort by issuedAt so window selection is consistent. We don't
  // mutate the input — work on indices.
  const sortedIdx = receipts
    .map((_, i) => i)
    .sort((a, b) => {
      const ai = receipts[a].issuedAt;
      const bi = receipts[b].issuedAt;
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    });
  const windowIdx = sortedIdx.slice(-windowSize);
  const baselineIdx = sortedIdx.slice(0, -windowSize);

  // ── 1. Block-rate spike ─────────────────────────────────────────
  // Compare block-rate in window vs baseline using normal approx
  // for the difference of two proportions.
  if (baselineIdx.length >= 10 && windowIdx.length >= 10) {
    const winBlocks = windowIdx.filter(
      (i) => receipts[i].overall === "block",
    ).length;
    const baseBlocks = baselineIdx.filter(
      (i) => receipts[i].overall === "block",
    ).length;
    const winRate = winBlocks / windowIdx.length;
    const baseRate = baseBlocks / baselineIdx.length;
    const pooled =
      (winBlocks + baseBlocks) / (windowIdx.length + baselineIdx.length);
    const se = Math.sqrt(
      pooled * (1 - pooled) * (1 / windowIdx.length + 1 / baselineIdx.length),
    );
    if (se > 0) {
      const z = (winRate - baseRate) / se;
      if (z >= warnZ) {
        anomalies.push({
          kind: "block-rate-spike",
          severity: z >= criticalZ ? "critical" : "warn",
          description: `Block-rate spike: window ${(winRate * 100).toFixed(1)}% vs baseline ${(baseRate * 100).toFixed(1)}% (z=${z.toFixed(2)})`,
          zScore: z,
          windowReceipts: windowIdx.length,
          baselineReceipts: baselineIdx.length,
          detectedAt,
        });
      }
    }
  }

  // ── 2. Per-rule failure drift ───────────────────────────────────
  // For each pack id seen in the window, compare its window block+warn
  // rate vs its baseline rate.
  if (baselineIdx.length >= 10 && windowIdx.length >= 10) {
    const packs = new Set<string>();
    for (const i of windowIdx) {
      const p = receipts[i].pack;
      if (typeof p === "string") packs.add(p);
    }
    for (const pack of packs) {
      const winSet = windowIdx.filter((i) => receipts[i].pack === pack);
      const baseSet = baselineIdx.filter((i) => receipts[i].pack === pack);
      if (winSet.length < 5 || baseSet.length < 5) continue;
      const winFailures = winSet.filter(
        (i) =>
          receipts[i].overall === "block" || receipts[i].overall === "warn",
      ).length;
      const baseFailures = baseSet.filter(
        (i) =>
          receipts[i].overall === "block" || receipts[i].overall === "warn",
      ).length;
      const winRate = winFailures / winSet.length;
      const baseRate = baseFailures / baseSet.length;
      const pooled =
        (winFailures + baseFailures) / (winSet.length + baseSet.length);
      const se = Math.sqrt(
        pooled * (1 - pooled) * (1 / winSet.length + 1 / baseSet.length),
      );
      if (se <= 0) continue;
      const z = (winRate - baseRate) / se;
      if (z >= warnZ) {
        anomalies.push({
          kind: "rule-failure-drift",
          severity: z >= criticalZ ? "critical" : "warn",
          description: `Pack '${pack}' failure-rate drift: window ${(winRate * 100).toFixed(1)}% vs baseline ${(baseRate * 100).toFixed(1)}% (z=${z.toFixed(2)})`,
          zScore: z,
          affectedField: pack,
          windowReceipts: winSet.length,
          baselineReceipts: baseSet.length,
          detectedAt,
        });
      }
    }
  }

  // ── 3. Volume burst (volume in window vs avg baseline rate) ──────
  if (baselineIdx.length >= 10 && windowIdx.length >= 10) {
    const firstBaseline = receipts[baselineIdx[0]].issuedAt;
    const lastBaseline = receipts[baselineIdx[baselineIdx.length - 1]].issuedAt;
    const firstWindow = receipts[windowIdx[0]].issuedAt;
    const lastWindow = receipts[windowIdx[windowIdx.length - 1]].issuedAt;
    const baselineSpanMs = Date.parse(lastBaseline) - Date.parse(firstBaseline);
    const windowSpanMs = Date.parse(lastWindow) - Date.parse(firstWindow);
    if (baselineSpanMs > 0 && windowSpanMs > 0) {
      const baselineRate = baselineIdx.length / baselineSpanMs; // receipts per ms
      const windowRate = windowIdx.length / windowSpanMs;
      const ratio = windowRate / baselineRate;
      // Flag burst when window rate is ≥ 5× baseline.
      if (ratio >= 5) {
        anomalies.push({
          kind: "volume-burst",
          severity: ratio >= 10 ? "critical" : "warn",
          description: `Volume burst: window throughput ${ratio.toFixed(1)}× baseline (${windowIdx.length} receipts in ${(windowSpanMs / 60000).toFixed(0)} min vs baseline ${baselineIdx.length} in ${(baselineSpanMs / 60000).toFixed(0)} min)`,
          windowReceipts: windowIdx.length,
          baselineReceipts: baselineIdx.length,
          detectedAt,
        });
      }
    }
  }

  // ── 4. Quiet period (gap > maxGapHours between consecutive) ──────
  for (let i = 1; i < sortedIdx.length; i++) {
    const prev = Date.parse(receipts[sortedIdx[i - 1]].issuedAt);
    const curr = Date.parse(receipts[sortedIdx[i]].issuedAt);
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
    const gap = curr - prev;
    if (gap > maxGapMs) {
      anomalies.push({
        kind: "quiet-period",
        severity: gap > maxGapMs * 4 ? "critical" : "warn",
        description: `Quiet period: ${(gap / 3600000).toFixed(1)}h gap between receipts (threshold ${opts.maxGapHours ?? DEFAULT_MAX_GAP_HOURS}h)`,
        detectedAt,
      });
    }
  }

  // ── 5. New agent appearance (window-only agentSlug) ──────────────
  if (baselineIdx.length >= 10) {
    const baselineAgents = new Set<string>();
    for (const i of baselineIdx) {
      const slug = receipts[i].agentSlug;
      if (typeof slug === "string") baselineAgents.add(slug);
    }
    const windowAgents = new Set<string>();
    for (const i of windowIdx) {
      const slug = receipts[i].agentSlug;
      if (typeof slug === "string") windowAgents.add(slug);
    }
    for (const slug of windowAgents) {
      if (!baselineAgents.has(slug)) {
        anomalies.push({
          kind: "new-agent",
          severity: "info",
          description: `Never-before-seen agent slug appeared: '${slug}'`,
          affectedField: slug,
          detectedAt,
        });
      }
    }
  }

  // Sort severity descending (critical first), then alphabetically.
  const severityRank: Record<AnomalySeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };
  anomalies.sort((a, b) => {
    const s = severityRank[a.severity] - severityRank[b.severity];
    if (s !== 0) return s;
    return a.kind.localeCompare(b.kind);
  });

  return {
    detectedAt,
    windowSize,
    totalReceipts: total,
    baselineStats: baseline,
    anomalies,
  };
}
