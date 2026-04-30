/**
 * @sovereign/inspector — Performance Observatory (R130).
 *
 * Pure-function port of src/lib/performance/{targets,benchmark-results,
 * gap-analysis,attestation}.ts to standalone Node ESM. Same target
 * registry, same status classification, same drift math, same
 * canonical attestation message format.
 *
 * Strategic property: when Sovereign claims "we hit X% on benchmark Y,"
 * a customer or auditor uses this module to:
 *   1. Verify the structural validity of the claimed BenchmarkResult
 *      (runHash present, source fields complete, verification kind
 *       not silently downgraded).
 *   2. Recompute the canonical attestation message and verify the
 *      Ed25519 signature offline.
 *   3. Replay the gap-report's status classification + linear
 *      time-to-target extrapolation.
 * No Sovereign network call required.
 *
 * Coverage:
 *   - 7 prebuilt 2026 SOTA targets (anti-AI-washing structural rules)
 *   - validateBenchmarkResult (7 typed failure reasons)
 *   - classifyTargetStatus / computeDrift / classifyDrift
 *   - leastSquaresFit / estimateTimeToTarget / gapReport
 *   - buildBenchmarkAttestationMessage / computeAttestationChainHash
 *   - buildSignedAttestation / summarizeAttestationForReceipt
 */

import { createHash } from "node:crypto";

// ── Targets registry ─────────────────────────────────────────────

export const SWE_BENCH_VERIFIED_TARGET = {
  id: "swe-bench-verified",
  name: "SWE-bench Verified",
  description:
    "The cleaned, contamination-resistant subset of SWE-bench. Procurement-grade benchmark for autonomous-coding fitness.",
  phase: "phase-2",
  category: "benchmark-coding",
  unit: "% pass rate",
  targetValue: 80,
  direction: "higher-is-better",
  sotaValue: 79.2,
  sotaSource: "Trae Agent leaderboard, early 2026",
  verificationKind: "claimed-only",
};

export const SWE_BENCH_PRO_TARGET = {
  id: "swe-bench-pro",
  name: "SWE-bench Pro",
  description:
    "The harder, contamination-resistant benchmark — designed to expose models that cherry-picked Verified. Real-world coding fitness.",
  phase: "phase-2",
  category: "benchmark-coding",
  unit: "% pass rate",
  targetValue: 50,
  direction: "higher-is-better",
  sotaValue: 45.9,
  sotaSource: "Trae Agent / SWE-bench Pro 2026",
  verificationKind: "claimed-only",
};

export const GAIA_LEVEL_3_TARGET = {
  id: "gaia-level-3",
  name: "GAIA Level 3",
  description:
    "The hardest tier of the GAIA general-AI assistant benchmark. Multi-step reasoning + multi-tool use under realistic ambiguity.",
  phase: "phase-2",
  category: "benchmark-general",
  unit: "% accuracy",
  targetValue: 60,
  direction: "higher-is-better",
  sotaValue: 57.7,
  sotaSource: "GAIA leaderboard, early 2026",
  verificationKind: "claimed-only",
};

export const LONG_MEM_EVAL_TARGET = {
  id: "long-mem-eval",
  name: "LongMemEval",
  description:
    "Long-term memory recall benchmark. The bar an agent must clear to be useful past a single session.",
  phase: "phase-1",
  category: "benchmark-memory",
  unit: "% accuracy",
  targetValue: 92,
  direction: "higher-is-better",
  sotaValue: 91.4,
  sotaSource: "LongMemEval 2026",
  verificationKind: "claimed-only",
};

export const GATEWAY_THROUGHPUT_TARGET = {
  id: "gateway-throughput-rps",
  name: "Gateway throughput (RPS)",
  description:
    "Sustained requests-per-second the platform's edge gateway can handle in production. Drives massive-swarm capacity planning.",
  phase: "phase-3",
  category: "throughput",
  unit: "req/s",
  targetValue: 350,
  direction: "higher-is-better",
  sotaValue: 350,
  sotaSource: "Elite gateway production deployments, 2026",
  verificationKind: "claimed-only",
};

export const GATEWAY_OVERHEAD_LATENCY_TARGET = {
  id: "gateway-overhead-ms",
  name: "Gateway overhead (per request)",
  description:
    "Per-request latency the gateway adds on top of the upstream agent invocation. Lower is better — must stay ≤4ms to support tight HITL loops.",
  phase: "phase-3",
  category: "latency",
  unit: "ms",
  targetValue: 4,
  direction: "lower-is-better",
  sotaValue: 4,
  sotaSource: "Elite gateway production deployments, 2026",
  verificationKind: "claimed-only",
};

export const BROKER_THROUGHPUT_TARGET = {
  id: "broker-throughput-msgs-per-s",
  name: "Broker throughput (per node)",
  description:
    "Messages-per-second per broker node the swarm-messaging layer can sustain.",
  phase: "phase-3",
  category: "messaging",
  unit: "msg/s",
  targetValue: 10000,
  direction: "higher-is-better",
  sotaValue: 10000,
  sotaSource: "Elite messaging brokers, 2026",
  verificationKind: "claimed-only",
};

export const DEFAULT_PERFORMANCE_TARGETS = [
  LONG_MEM_EVAL_TARGET,
  SWE_BENCH_VERIFIED_TARGET,
  SWE_BENCH_PRO_TARGET,
  GAIA_LEVEL_3_TARGET,
  GATEWAY_THROUGHPUT_TARGET,
  GATEWAY_OVERHEAD_LATENCY_TARGET,
  BROKER_THROUGHPUT_TARGET,
];

// ── Pure: registry helpers ───────────────────────────────────────

export function findTargetById(id, targets = DEFAULT_PERFORMANCE_TARGETS) {
  return targets.find((t) => t.id === id);
}

export function listTargets(filter = {}, targets = DEFAULT_PERFORMANCE_TARGETS) {
  const out = [];
  for (const t of targets) {
    if (filter.phase && t.phase !== filter.phase) continue;
    if (filter.category && t.category !== filter.category) continue;
    if (
      filter.verificationKind &&
      t.verificationKind !== filter.verificationKind
    )
      continue;
    out.push(t);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

// ── Pure: status classification ──────────────────────────────────

export function computeDrift(target, measuredValue) {
  if (target.targetValue === 0) {
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

export function classifyDrift(driftPp) {
  if (driftPp >= 0) return "achieved";
  if (driftPp >= -10) return "on-track";
  if (driftPp >= -25) return "at-risk";
  return "behind";
}

export function classifyTargetStatus(target, result) {
  if (result === null) {
    return {
      status: "not-measured",
      driftPercentagePoints: 0,
      reason: `No measurement recorded for ${target.id}. Dashboard refuses to display a current value without a runHash.`,
    };
  }
  const drift = computeDrift(target, result.measuredValue);
  const status = classifyDrift(drift);
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
  let reason;
  switch (status) {
    case "achieved":
      reason = `Achieved: measured ${measured}, ${direction} ${targetStr} (drift +${driftStr})${verification}.`;
      break;
    case "on-track":
      reason = `On track: measured ${measured}, ${direction} ${targetStr} (drift ${driftStr})${verification}.`;
      break;
    case "at-risk":
      reason = `At risk: measured ${measured}, ${direction} ${targetStr} (drift ${driftStr})${verification}.`;
      break;
    case "behind":
      reason = `Behind target: measured ${measured}, ${direction} ${targetStr} (drift ${driftStr})${verification}.`;
      break;
    default:
      reason = `Status not classifiable for ${target.id}.`;
  }
  return { status, driftPercentagePoints: drift, reason };
}

// ── Pure: structural validation (anti-AI-washing) ────────────────

export function validateBenchmarkResult(input) {
  if (!input.target) {
    return {
      ok: false,
      reason: "target_not_found",
      details: `target ${input.result?.targetId ?? "?"} not in registry`,
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
  const order = {
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

// ── Pure: linear least-squares + time-to-target ─────────────────

export function leastSquaresFit(points) {
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

export function estimateTimeToTarget(input) {
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
  if (target.direction === "higher-is-better" && fit.slope < 0) {
    return {
      estimatedDays: null,
      slope: fit.slope,
      rationale: `Trend is moving away from target (slope ${fit.slope.toFixed(4)} ${target.unit}/day).`,
    };
  }
  if (target.direction === "lower-is-better" && fit.slope > 0) {
    return {
      estimatedDays: null,
      slope: fit.slope,
      rationale: `Trend is moving away from target (slope +${fit.slope.toFixed(4)} ${target.unit}/day; target wants lower).`,
    };
  }
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

export function gapReport(input) {
  const { target, history } = input;
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const status = classifyTargetStatus(target, latest);
  const tt = estimateTimeToTarget({ target, history, asOf: input.asOf });
  const reproducibilityVerified =
    target.verificationKind === "independent-replayable" &&
    latest !== null &&
    latest.runHash.trim().length > 0;

  let headline;
  if (status.status === "achieved") {
    headline = `${target.name} — achieved. Target met.`;
  } else if (status.status === "not-measured") {
    headline = `${target.name} — not-measured. No measurement yet.`;
  } else if (tt.estimatedDays === null) {
    headline = `${target.name} — ${status.status}. ETA unavailable.`;
  } else if (tt.estimatedDays === 0) {
    headline = `${target.name} — ${status.status}. Target achievable now.`;
  } else {
    headline = `${target.name} — ${status.status}. ETA ${tt.estimatedDays.toFixed(0)} days at current trend.`;
  }

  return {
    targetId: target.id,
    status,
    timeToTarget: tt,
    reproducibilityVerified,
    measurementCount: history.length,
    headline,
  };
}

// ── Pure: attestation builder + chain hash ───────────────────────

export function buildBenchmarkAttestationMessage(input) {
  const { target, result, attestedAt } = input;
  const sourceHash = createHash("sha256")
    .update(
      [
        result.source.harnessCommit,
        result.source.datasetVersion,
        result.source.modelId,
        result.source.envNotes ?? "",
      ].join("|"),
    )
    .digest("hex");
  return [
    "v1",
    "benchmark-attestation",
    `targetId:${target.id}`,
    `targetValue:${target.targetValue}`,
    `targetDirection:${target.direction}`,
    `verificationKind:${target.verificationKind}`,
    `measuredValue:${result.measuredValue}`,
    `measuredAt:${result.measuredAt}`,
    `runHash:${result.runHash}`,
    `sourceHash:${sourceHash}`,
    `attestedAt:${attestedAt}`,
  ].join("\n");
}

export function computeAttestationChainHash(input) {
  return createHash("sha256")
    .update(
      [
        input.parentChainHash ?? "GENESIS",
        input.message,
        input.signature,
      ].join("|"),
    )
    .digest("hex");
}

export function buildSignedAttestation(input) {
  const { target, result } = input;
  const sourceHash = createHash("sha256")
    .update(
      [
        result.source.harnessCommit,
        result.source.datasetVersion,
        result.source.modelId,
        result.source.envNotes ?? "",
      ].join("|"),
    )
    .digest("hex");
  const chainHash = computeAttestationChainHash({
    parentChainHash: input.parentChainHash,
    message: input.message,
    signature: input.signature,
  });
  return {
    version: "v1",
    targetId: target.id,
    targetValue: target.targetValue,
    targetDirection: target.direction,
    verificationKind: target.verificationKind,
    measuredValue: result.measuredValue,
    measuredAt: result.measuredAt,
    runHash: result.runHash,
    sourceHash,
    attestedAt: input.attestedAt,
    message: input.message,
    signature: input.signature,
    parentChainHash: input.parentChainHash,
    chainHash,
    platformPublicKey: input.platformPublicKey,
  };
}

export function summarizeAttestationForReceipt(att) {
  return [
    `BENCHMARK ATTESTATION v1 — target ${att.targetId}`,
    `  measured ${att.measuredValue} ${att.targetDirection === "higher-is-better" ? "≥" : "≤"} ${att.targetValue} (target)`,
    `  verification: ${att.verificationKind}`,
    `  measured at: ${att.measuredAt}`,
    `  run hash: ${att.runHash.slice(0, 16)}...`,
    `  source hash: ${att.sourceHash.slice(0, 16)}...`,
    `  chain hash: ${att.chainHash.slice(0, 16)}...`,
  ].join("\n");
}
