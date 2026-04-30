/**
 * BENCHMARK RESULTS — pure-function shape + classifier.
 *
 * Every row in the Performance Registry's results table conforms to
 * `BenchmarkResult`. The structural rule that prevents AI-washing:
 *
 *   - measuredValue is REQUIRED (no implicit defaults)
 *   - runHash is REQUIRED for "independent-replayable" targets
 *   - measuredAt is REQUIRED (ISO 8601)
 *   - source is REQUIRED (commit hash + dataset version + model id)
 *
 * Pure functions classify status (`achieved` / `on-track` / `at-risk`
 * / `behind`) and compute drift (% gap from target). The dashboard
 * uses these for color-coding.
 */

import type {
  PerformanceTarget,
  MetricDirection,
  VerificationKind,
} from "./targets";

// ── Result shape ──────────────────────────────────────────────────

export interface BenchmarkResultSource {
  /** Git commit hash (or other VCS reference) used for the harness. */
  harnessCommit: string;
  /** Dataset version / snapshot identifier. */
  datasetVersion: string;
  /** Model id / version executed against. */
  modelId: string;
  /** Optional environment notes (cluster size, hardware, etc.). */
  envNotes?: string;
}

export interface BenchmarkResult {
  /** The target this result is measured against. */
  targetId: string;
  /** The measured value. Same unit as target.unit. */
  measuredValue: number;
  /** ISO 8601 — when the measurement was taken. */
  measuredAt: string;
  /** sha256 hash of (commit || dataset || modelId || envNotes), or "internal". */
  runHash: string;
  source: BenchmarkResultSource;
  /** Optional procurement-readable notes. */
  notes?: string;
  /** What kind of verification this result claims to be. Must
   *  match or be more rigorous than the target's verificationKind. */
  verification: VerificationKind;
}

// ── Pure: status classification ──────────────────────────────────

export type TargetStatus =
  | "achieved" // measuredValue meets or exceeds the target
  | "on-track" // within 10% of target (depending on direction)
  | "at-risk" // 10-25% short
  | "behind" // >25% short
  | "not-measured"; // no result yet

export interface StatusClassification {
  status: TargetStatus;
  /** Drift in percentage points — positive = ahead of target. */
  driftPercentagePoints: number;
  /** Procurement-readable summary. */
  reason: string;
}

/**
 * Pure: classify the status of a target given its latest result.
 * `result` may be null when no measurement exists yet.
 */
export function classifyTargetStatus(
  target: PerformanceTarget,
  result: BenchmarkResult | null,
): StatusClassification {
  if (result === null) {
    return {
      status: "not-measured",
      driftPercentagePoints: 0,
      reason: `No measurement recorded for ${target.id}. Dashboard refuses to display a current value without a runHash.`,
    };
  }
  const drift = computeDrift(target, result.measuredValue);
  const status = classifyDrift(drift, target.direction);
  const reason = procurementReason(target, result, status, drift);
  return { status, driftPercentagePoints: drift, reason };
}

/**
 * Pure: compute drift as percentage points relative to target value.
 *
 * direction = higher-is-better:
 *   drift = ((measured - target) / target) * 100  (negative = short)
 * direction = lower-is-better:
 *   drift = ((target - measured) / target) * 100  (negative = over budget)
 */
export function computeDrift(
  target: PerformanceTarget,
  measuredValue: number,
): number {
  if (target.targetValue === 0) {
    // Defensive — should never happen with the prebuilt registry, but
    // an operator-supplied target could be 0. Avoid division-by-zero.
    return target.direction === "higher-is-better"
      ? measuredValue >= 0
        ? 100
        : -100
      : measuredValue <= 0
        ? 100
        : -100;
  }
  if (target.direction === "higher-is-better") {
    return ((measuredValue - target.targetValue) / target.targetValue) * 100;
  }
  return ((target.targetValue - measuredValue) / target.targetValue) * 100;
}

/**
 * Pure: classify the drift into achieved / on-track / at-risk / behind.
 * Same thresholds regardless of direction.
 */
export function classifyDrift(
  driftPp: number,
  _direction: MetricDirection,
): TargetStatus {
  if (driftPp >= 0) return "achieved";
  if (driftPp >= -10) return "on-track";
  if (driftPp >= -25) return "at-risk";
  return "behind";
}

function procurementReason(
  target: PerformanceTarget,
  result: BenchmarkResult,
  status: TargetStatus,
  drift: number,
): string {
  const measured = `${result.measuredValue}${target.unit}`;
  const targetStr = `${target.targetValue}${target.unit}`;
  const direction =
    target.direction === "higher-is-better" ? "must reach" : "must stay below";
  const driftStr = `${drift.toFixed(1)}%`;
  const verification =
    target.verificationKind === "independent-replayable"
      ? " — independently replayable via published harness"
      : target.verificationKind === "internal-only"
        ? " — internally measured only"
        : " — TARGET ONLY (no measurement yet)";
  switch (status) {
    case "achieved":
      return `Achieved: measured ${measured}, ${direction} ${targetStr} (drift +${driftStr})${verification}.`;
    case "on-track":
      return `On track: measured ${measured}, ${direction} ${targetStr} (drift ${driftStr})${verification}.`;
    case "at-risk":
      return `At risk: measured ${measured}, ${direction} ${targetStr} (drift ${driftStr})${verification}.`;
    case "behind":
      return `Behind target: measured ${measured}, ${direction} ${targetStr} (drift ${driftStr})${verification}.`;
    default:
      return `Status not classifiable for ${target.id}.`;
  }
}

// ── Pure: verify a submitted result against its target ──────────

export type ResultValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "target_not_found"
        | "missing_run_hash"
        | "missing_measured_at"
        | "missing_source_fields"
        | "verification_too_weak"
        | "measured_value_not_finite";
      details?: string;
    };

/**
 * Pure: validate a `BenchmarkResult` against its declared target.
 *
 * Anti-AI-washing structural rules:
 *
 *   1. result.runHash must be non-empty (procurement audit trail)
 *   2. result.measuredAt must be a valid ISO 8601 (timestamps anchor
 *      the measurement)
 *   3. result.source must include harnessCommit + datasetVersion +
 *      modelId
 *   4. If target.verificationKind is "independent-replayable", the
 *      result MUST also claim "independent-replayable" (cannot
 *      downgrade verification rigour silently)
 *   5. measuredValue must be a finite number
 */
export function validateBenchmarkResult(input: {
  result: BenchmarkResult;
  target: PerformanceTarget | undefined;
}): ResultValidation {
  if (!input.target) {
    return {
      ok: false,
      reason: "target_not_found",
      details: `target ${input.result.targetId} not in registry`,
    };
  }
  const r = input.result;
  if (!r.runHash || r.runHash.trim().length === 0) {
    return { ok: false, reason: "missing_run_hash" };
  }
  if (!r.measuredAt || Number.isNaN(Date.parse(r.measuredAt))) {
    return { ok: false, reason: "missing_measured_at" };
  }
  if (
    !r.source ||
    !r.source.harnessCommit ||
    !r.source.datasetVersion ||
    !r.source.modelId
  ) {
    return { ok: false, reason: "missing_source_fields" };
  }
  if (!Number.isFinite(r.measuredValue)) {
    return { ok: false, reason: "measured_value_not_finite" };
  }
  // Verification monotonicity.
  const order: Record<VerificationKind, number> = {
    "claimed-only": 0,
    "internal-only": 1,
    "independent-replayable": 2,
  };
  if (order[r.verification] < order[input.target.verificationKind]) {
    return {
      ok: false,
      reason: "verification_too_weak",
      details: `target requires ${input.target.verificationKind}; result claims only ${r.verification}`,
    };
  }
  return { ok: true };
}
