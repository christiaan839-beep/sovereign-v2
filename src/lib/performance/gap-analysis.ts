/**
 * GAP ANALYSIS — pure-function reports + linear time-to-target.
 *
 * Given a target + history of measurements, produce a procurement-
 * readable gap report including:
 *
 *   - Current status (from classifyTargetStatus)
 *   - Drift (% gap from target)
 *   - Linear extrapolation: "if the current trend continues, the
 *     target is reached in N days"
 *   - Reproducibility flag — true when the target is replayable +
 *     the latest result has a runHash
 *
 * Linear extrapolation is intentionally simple. Fancy time-series
 * models would be opaque; a least-squares fit on the last K
 * measurements is transparent + replayable in @sovereign/inspector.
 */

import {
  classifyTargetStatus,
  type BenchmarkResult,
  type StatusClassification,
  type TargetStatus,
} from "./benchmark-results";
import type { PerformanceTarget } from "./targets";

// ── Pure: linear least-squares fit ───────────────────────────────

/**
 * Pure: ordinary least-squares slope+intercept on (t, y) pairs.
 * Returns null when there are fewer than 2 distinct timestamps.
 *
 * `t` is in days-since-epoch; `y` is the measured value.
 */
export function leastSquaresFit(
  points: ReadonlyArray<{ t: number; y: number }>,
): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const distinctTs = new Set(points.map((p) => p.t));
  if (distinctTs.size < 2) return null;
  const n = points.length;
  let sumT = 0;
  let sumY = 0;
  let sumTT = 0;
  let sumTY = 0;
  for (const p of points) {
    sumT += p.t;
    sumY += p.y;
    sumTT += p.t * p.t;
    sumTY += p.t * p.y;
  }
  const denom = n * sumTT - sumT * sumT;
  if (denom === 0) return null;
  const slope = (n * sumTY - sumT * sumY) / denom;
  const intercept = (sumY - slope * sumT) / n;
  return { slope, intercept };
}

// ── Pure: time-to-target extrapolation ──────────────────────────

export interface TimeToTargetEstimate {
  /**
   * Days from `as-of` until the linear-fit value crosses the target.
   * Null when the trend is moving the wrong way OR when we have
   * insufficient history.
   */
  estimatedDays: number | null;
  /** Slope of the linear fit (target unit per day). */
  slope: number | null;
  /** Procurement-readable explanation. */
  rationale: string;
}

/**
 * Pure: compute time-to-target via linear extrapolation.
 *
 * Inputs:
 *   - target: the PerformanceTarget
 *   - history: results sorted ascending by measuredAt
 *   - asOf: ISO 8601 — when the prediction is anchored
 */
export function estimateTimeToTarget(input: {
  target: PerformanceTarget;
  history: ReadonlyArray<BenchmarkResult>;
  asOf?: Date;
}): TimeToTargetEstimate {
  const { target, history } = input;
  const asOf = input.asOf ?? new Date();
  if (history.length === 0) {
    return {
      estimatedDays: null,
      slope: null,
      rationale: "No history; cannot extrapolate.",
    };
  }
  const latest = history[history.length - 1];
  if (
    target.direction === "higher-is-better" &&
    latest.measuredValue >= target.targetValue
  ) {
    return {
      estimatedDays: 0,
      slope: null,
      rationale: "Target already achieved (latest measurement meets it).",
    };
  }
  if (
    target.direction === "lower-is-better" &&
    latest.measuredValue <= target.targetValue
  ) {
    return {
      estimatedDays: 0,
      slope: null,
      rationale: "Target already achieved (latest measurement meets it).",
    };
  }

  const points = history.map((r) => ({
    t: Date.parse(r.measuredAt) / (1000 * 60 * 60 * 24),
    y: r.measuredValue,
  }));
  const fit = leastSquaresFit(points);
  if (!fit) {
    return {
      estimatedDays: null,
      slope: null,
      rationale: "Insufficient distinct timestamps for linear fit.",
    };
  }
  if (fit.slope === 0) {
    return {
      estimatedDays: null,
      slope: 0,
      rationale: "Trend is flat — no progress toward target.",
    };
  }
  const direction = target.direction;
  // Wrong-direction trend → infinity.
  if (direction === "higher-is-better" && fit.slope < 0) {
    return {
      estimatedDays: null,
      slope: fit.slope,
      rationale: `Trend is moving away from target (slope ${fit.slope.toFixed(4)} ${target.unit}/day).`,
    };
  }
  if (direction === "lower-is-better" && fit.slope > 0) {
    return {
      estimatedDays: null,
      slope: fit.slope,
      rationale: `Trend is moving away from target (slope +${fit.slope.toFixed(4)} ${target.unit}/day; target wants lower).`,
    };
  }

  // Solve fit.slope * t + fit.intercept = target.targetValue for t.
  const tCross = (target.targetValue - fit.intercept) / fit.slope;
  const tNow = Date.parse(asOf.toISOString()) / (1000 * 60 * 60 * 24);
  const days = tCross - tNow;
  if (days < 0) {
    return {
      estimatedDays: 0,
      slope: fit.slope,
      rationale:
        "Linear fit suggests target was crossed in the past — recompute with a fresh measurement.",
    };
  }
  return {
    estimatedDays: days,
    slope: fit.slope,
    rationale: `At current trend (slope ${fit.slope.toFixed(4)} ${target.unit}/day), target reached in ${days.toFixed(0)} days.`,
  };
}

// ── Pure: full gap report ───────────────────────────────────────

export interface GapReport {
  targetId: string;
  status: StatusClassification;
  timeToTarget: TimeToTargetEstimate;
  /** True when target is independent-replayable AND the latest
   *  result has a non-empty runHash. */
  reproducibilityVerified: boolean;
  /** Number of measurements in history. */
  measurementCount: number;
  /** Procurement-readable headline (status + ETA). */
  headline: string;
}

export function gapReport(input: {
  target: PerformanceTarget;
  history: ReadonlyArray<BenchmarkResult>;
  asOf?: Date;
}): GapReport {
  const { target, history } = input;
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const status = classifyTargetStatus(target, latest);
  const tt = estimateTimeToTarget({ target, history, asOf: input.asOf });
  const reproducibilityVerified =
    target.verificationKind === "independent-replayable" &&
    latest !== null &&
    latest.runHash.trim().length > 0;
  const headline = buildHeadline(target, status.status, tt);
  return {
    targetId: target.id,
    status,
    timeToTarget: tt,
    reproducibilityVerified,
    measurementCount: history.length,
    headline,
  };
}

function buildHeadline(
  target: PerformanceTarget,
  status: TargetStatus,
  tt: TimeToTargetEstimate,
): string {
  const head = `${target.name} — ${status}`;
  if (status === "achieved") return `${head}. Target met.`;
  if (status === "not-measured") return `${head}. No measurement yet.`;
  if (tt.estimatedDays === null) return `${head}. ETA unavailable.`;
  if (tt.estimatedDays === 0) return `${head}. Target achievable now.`;
  return `${head}. ETA ${tt.estimatedDays.toFixed(0)} days at current trend.`;
}
