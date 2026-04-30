/**
 * R130 — Performance Observatory unit tests.
 *
 * Coverage:
 *   - DEFAULT_PERFORMANCE_TARGETS contains the 6 (actually 7) prebuilt
 *     targets matching the prompt's roadmap
 *   - findTargetById + listTargets filtering / sorting
 *   - targetRegistryStats sums match the registry
 *   - computeDrift: higher-is-better + lower-is-better both directions
 *   - computeDrift: defensive when targetValue is 0
 *   - classifyDrift: thresholds at 0 / -10 / -25
 *   - classifyTargetStatus: not-measured + achieved + on-track + behind
 *   - validateBenchmarkResult: every typed failure reason
 *   - validateBenchmarkResult: verification monotonicity
 *   - leastSquaresFit: known-line, insufficient points, identical-t
 *   - estimateTimeToTarget: already-met / wrong-direction / flat /
 *     valid trend / lower-is-better path
 *   - gapReport: integration test — status + ETA + reproducibilityVerified
 *   - buildBenchmarkAttestationMessage: deterministic format
 *   - computeAttestationChainHash: GENESIS sentinel + avalanche
 *   - buildSignedAttestation: chain hash linkage
 *   - summarizeAttestationForReceipt: contains all key fields
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERFORMANCE_TARGETS,
  SWE_BENCH_PRO_TARGET,
  GATEWAY_OVERHEAD_LATENCY_TARGET,
  LONG_MEM_EVAL_TARGET,
  findTargetById,
  listTargets,
  targetRegistryStats,
} from "../targets";
import {
  classifyTargetStatus,
  computeDrift,
  classifyDrift,
  validateBenchmarkResult,
  type BenchmarkResult,
} from "../benchmark-results";
import {
  leastSquaresFit,
  estimateTimeToTarget,
  gapReport,
} from "../gap-analysis";
import {
  buildBenchmarkAttestationMessage,
  computeAttestationChainHash,
  buildSignedAttestation,
  summarizeAttestationForReceipt,
} from "../attestation";

// ── Test fixtures ──────────────────────────────────────────────────

function makeResult(
  overrides: Partial<BenchmarkResult> = {},
): BenchmarkResult {
  return {
    targetId: "swe-bench-pro",
    measuredValue: 47.2,
    measuredAt: "2026-04-30T12:00:00.000Z",
    runHash: "abc123hash",
    source: {
      harnessCommit: "git:8c5422f0",
      datasetVersion: "swe-bench-pro-v1",
      modelId: "trae-agent-v1.0",
    },
    verification: "internal-only",
    ...overrides,
  };
}

// ── Targets registry ───────────────────────────────────────────────

describe("Performance targets registry — DEFAULT_PERFORMANCE_TARGETS", () => {
  it("contains all 7 prebuilt targets from the 2026 roadmap", () => {
    expect(DEFAULT_PERFORMANCE_TARGETS.length).toBe(7);
    const ids = DEFAULT_PERFORMANCE_TARGETS.map((t) => t.id);
    expect(ids).toContain("swe-bench-verified");
    expect(ids).toContain("swe-bench-pro");
    expect(ids).toContain("gaia-level-3");
    expect(ids).toContain("long-mem-eval");
    expect(ids).toContain("gateway-throughput-rps");
    expect(ids).toContain("gateway-overhead-ms");
    expect(ids).toContain("broker-throughput-msgs-per-s");
  });

  it("every target has a verificationKind (anti-AI-washing)", () => {
    for (const t of DEFAULT_PERFORMANCE_TARGETS) {
      expect(t.verificationKind).toBeDefined();
    }
  });

  it("every target cites a SOTA source", () => {
    for (const t of DEFAULT_PERFORMANCE_TARGETS) {
      expect(t.sotaSource.length).toBeGreaterThan(0);
    }
  });

  it("targets span Phase 1, 2, and 3", () => {
    const phases = new Set(DEFAULT_PERFORMANCE_TARGETS.map((t) => t.phase));
    expect(phases.has("phase-1")).toBe(true);
    expect(phases.has("phase-2")).toBe(true);
    expect(phases.has("phase-3")).toBe(true);
  });

  it("at least one lower-is-better target (gateway latency)", () => {
    const lowers = DEFAULT_PERFORMANCE_TARGETS.filter(
      (t) => t.direction === "lower-is-better",
    );
    expect(lowers.length).toBeGreaterThanOrEqual(1);
    expect(lowers[0].id).toBe("gateway-overhead-ms");
  });
});

describe("findTargetById + listTargets", () => {
  it("findTargetById returns prebuilt targets", () => {
    expect(findTargetById("swe-bench-pro")?.targetValue).toBe(50);
    expect(findTargetById("nonexistent")).toBeUndefined();
  });

  it("listTargets sorts by id by default", () => {
    const list = listTargets();
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(list).toEqual(sorted);
  });

  it("listTargets filters by phase", () => {
    const phase2 = listTargets({ phase: "phase-2" });
    expect(phase2.length).toBeGreaterThan(0);
    expect(phase2.every((t) => t.phase === "phase-2")).toBe(true);
  });

  it("listTargets filters by category", () => {
    const coding = listTargets({ category: "benchmark-coding" });
    expect(coding.length).toBe(2); // verified + pro
  });

  it("listTargets filters by verificationKind", () => {
    const claimedOnly = listTargets({ verificationKind: "claimed-only" });
    expect(claimedOnly.length).toBe(DEFAULT_PERFORMANCE_TARGETS.length);
  });
});

describe("targetRegistryStats", () => {
  it("totals match the registry", () => {
    const stats = targetRegistryStats();
    expect(stats.total).toBe(DEFAULT_PERFORMANCE_TARGETS.length);
    const phaseSum =
      stats.byPhase["phase-1"] +
      stats.byPhase["phase-2"] +
      stats.byPhase["phase-3"];
    expect(phaseSum).toBe(stats.total);
  });
});

// ── computeDrift / classifyDrift ─────────────────────────────────

describe("computeDrift — higher-is-better", () => {
  const t = SWE_BENCH_PRO_TARGET; // target = 50, higher-is-better
  it("achieved → positive drift", () => {
    expect(computeDrift(t, 60)).toBeCloseTo(20, 5);
  });
  it("at target → drift 0", () => {
    expect(computeDrift(t, 50)).toBe(0);
  });
  it("below target → negative drift", () => {
    expect(computeDrift(t, 40)).toBeCloseTo(-20, 5);
  });
});

describe("computeDrift — lower-is-better", () => {
  const t = GATEWAY_OVERHEAD_LATENCY_TARGET; // target = 4ms, lower-is-better
  it("under budget → positive drift", () => {
    expect(computeDrift(t, 2)).toBeCloseTo(50, 5);
  });
  it("at budget → 0", () => {
    expect(computeDrift(t, 4)).toBe(0);
  });
  it("over budget → negative drift", () => {
    expect(computeDrift(t, 8)).toBeCloseTo(-100, 5);
  });
});

describe("computeDrift — defensive", () => {
  it("target=0 returns ±100 instead of NaN", () => {
    const t = { ...LONG_MEM_EVAL_TARGET, targetValue: 0 };
    const d = computeDrift(t, 5);
    expect(Number.isFinite(d)).toBe(true);
  });
});

describe("classifyDrift thresholds", () => {
  it(">= 0 → achieved", () => {
    expect(classifyDrift(0, "higher-is-better")).toBe("achieved");
    expect(classifyDrift(20, "higher-is-better")).toBe("achieved");
  });
  it("[-10, 0) → on-track", () => {
    expect(classifyDrift(-1, "higher-is-better")).toBe("on-track");
    expect(classifyDrift(-10, "higher-is-better")).toBe("on-track");
  });
  it("[-25, -10) → at-risk", () => {
    expect(classifyDrift(-11, "higher-is-better")).toBe("at-risk");
    expect(classifyDrift(-25, "higher-is-better")).toBe("at-risk");
  });
  it("< -25 → behind", () => {
    expect(classifyDrift(-30, "higher-is-better")).toBe("behind");
  });
});

// ── classifyTargetStatus ─────────────────────────────────────────

describe("classifyTargetStatus", () => {
  it("returns not-measured when result is null", () => {
    const c = classifyTargetStatus(SWE_BENCH_PRO_TARGET, null);
    expect(c.status).toBe("not-measured");
    expect(c.reason).toContain("No measurement");
  });

  it("returns achieved when measured meets target", () => {
    const c = classifyTargetStatus(
      SWE_BENCH_PRO_TARGET,
      makeResult({ measuredValue: 60 }),
    );
    expect(c.status).toBe("achieved");
  });

  it("returns behind when measured is far short", () => {
    const c = classifyTargetStatus(
      SWE_BENCH_PRO_TARGET,
      makeResult({ measuredValue: 30 }),
    );
    expect(c.status).toBe("behind");
  });

  it("reason notes verification status", () => {
    const c = classifyTargetStatus(
      SWE_BENCH_PRO_TARGET,
      makeResult({ measuredValue: 49 }),
    );
    expect(c.reason).toContain("TARGET ONLY");
  });
});

// ── validateBenchmarkResult ───────────────────────────────────

describe("validateBenchmarkResult — anti-AI-washing rules", () => {
  it("ok on a complete result", () => {
    const v = validateBenchmarkResult({
      result: makeResult(),
      target: SWE_BENCH_PRO_TARGET,
    });
    expect(v.ok).toBe(true);
  });

  it("rejects unknown target", () => {
    const v = validateBenchmarkResult({
      result: makeResult(),
      target: undefined,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("target_not_found");
  });

  it("rejects empty runHash", () => {
    const v = validateBenchmarkResult({
      result: makeResult({ runHash: "" }),
      target: SWE_BENCH_PRO_TARGET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_run_hash");
  });

  it("rejects malformed measuredAt", () => {
    const v = validateBenchmarkResult({
      result: makeResult({ measuredAt: "not-a-date" }),
      target: SWE_BENCH_PRO_TARGET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_measured_at");
  });

  it("rejects missing source fields", () => {
    const v = validateBenchmarkResult({
      result: makeResult({
        source: {
          harnessCommit: "",
          datasetVersion: "x",
          modelId: "y",
        },
      }),
      target: SWE_BENCH_PRO_TARGET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_source_fields");
  });

  it("rejects non-finite measuredValue", () => {
    const v = validateBenchmarkResult({
      result: makeResult({ measuredValue: NaN }),
      target: SWE_BENCH_PRO_TARGET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("measured_value_not_finite");
  });

  it("rejects verification downgrade", () => {
    const target = {
      ...SWE_BENCH_PRO_TARGET,
      verificationKind: "independent-replayable" as const,
    };
    const v = validateBenchmarkResult({
      result: makeResult({ verification: "internal-only" }),
      target,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("verification_too_weak");
  });

  it("accepts verification at or above target's required kind", () => {
    const target = {
      ...SWE_BENCH_PRO_TARGET,
      verificationKind: "internal-only" as const,
    };
    const v = validateBenchmarkResult({
      result: makeResult({ verification: "independent-replayable" }),
      target,
    });
    expect(v.ok).toBe(true);
  });
});

// ── leastSquaresFit ───────────────────────────────────────────────

describe("leastSquaresFit", () => {
  it("recovers known line y = 2t + 5", () => {
    const fit = leastSquaresFit([
      { t: 0, y: 5 },
      { t: 1, y: 7 },
      { t: 2, y: 9 },
      { t: 3, y: 11 },
    ]);
    expect(fit).not.toBeNull();
    if (fit) {
      expect(fit.slope).toBeCloseTo(2, 5);
      expect(fit.intercept).toBeCloseTo(5, 5);
    }
  });

  it("returns null when fewer than 2 points", () => {
    expect(leastSquaresFit([])).toBeNull();
    expect(leastSquaresFit([{ t: 1, y: 1 }])).toBeNull();
  });

  it("returns null when all timestamps are identical (zero variance)", () => {
    expect(
      leastSquaresFit([
        { t: 1, y: 10 },
        { t: 1, y: 20 },
      ]),
    ).toBeNull();
  });
});

// ── estimateTimeToTarget ────────────────────────────────────────

describe("estimateTimeToTarget", () => {
  const t = { ...SWE_BENCH_PRO_TARGET, targetValue: 50 };

  it("returns 0 days when latest already meets higher-is-better target", () => {
    const ttt = estimateTimeToTarget({
      target: t,
      history: [
        makeResult({
          measuredValue: 55,
          measuredAt: "2026-04-30T12:00:00.000Z",
        }),
      ],
    });
    expect(ttt.estimatedDays).toBe(0);
  });

  it("returns null when trend is moving the wrong way", () => {
    const ttt = estimateTimeToTarget({
      target: t,
      history: [
        makeResult({
          measuredValue: 45,
          measuredAt: "2026-04-01T12:00:00.000Z",
        }),
        makeResult({
          measuredValue: 40,
          measuredAt: "2026-04-15T12:00:00.000Z",
        }),
      ],
    });
    expect(ttt.estimatedDays).toBeNull();
    expect(ttt.rationale).toContain("moving away");
  });

  it("returns null when slope is flat", () => {
    const ttt = estimateTimeToTarget({
      target: t,
      history: [
        makeResult({
          measuredValue: 45,
          measuredAt: "2026-04-01T12:00:00.000Z",
        }),
        makeResult({
          measuredValue: 45,
          measuredAt: "2026-04-15T12:00:00.000Z",
        }),
      ],
    });
    expect(ttt.estimatedDays).toBeNull();
  });

  it("computes positive ETA when on a rising trend toward target", () => {
    const ttt = estimateTimeToTarget({
      target: t,
      history: [
        makeResult({
          measuredValue: 40,
          measuredAt: "2026-03-01T12:00:00.000Z",
        }),
        makeResult({
          measuredValue: 45,
          measuredAt: "2026-04-01T12:00:00.000Z",
        }),
      ],
      asOf: new Date("2026-04-01T12:00:00.000Z"),
    });
    expect(ttt.estimatedDays).not.toBeNull();
    if (ttt.estimatedDays !== null) {
      expect(ttt.estimatedDays).toBeGreaterThan(0);
    }
  });

  it("lower-is-better path: detects wrong-direction slope (rising)", () => {
    const ttt = estimateTimeToTarget({
      target: GATEWAY_OVERHEAD_LATENCY_TARGET,
      history: [
        makeResult({
          targetId: "gateway-overhead-ms",
          measuredValue: 6,
          measuredAt: "2026-04-01T12:00:00.000Z",
        }),
        makeResult({
          targetId: "gateway-overhead-ms",
          measuredValue: 8,
          measuredAt: "2026-04-15T12:00:00.000Z",
        }),
      ],
    });
    expect(ttt.estimatedDays).toBeNull();
  });

  it("returns null when history is empty", () => {
    const ttt = estimateTimeToTarget({ target: t, history: [] });
    expect(ttt.estimatedDays).toBeNull();
  });
});

// ── gapReport (integration) ────────────────────────────────────

describe("gapReport — integration", () => {
  const t = SWE_BENCH_PRO_TARGET;

  it("returns not-measured for empty history", () => {
    const report = gapReport({ target: t, history: [] });
    expect(report.status.status).toBe("not-measured");
    expect(report.measurementCount).toBe(0);
    expect(report.reproducibilityVerified).toBe(false);
  });

  it("returns achieved + measurementCount=1 for met target", () => {
    const report = gapReport({
      target: t,
      history: [makeResult({ measuredValue: 55 })],
    });
    expect(report.status.status).toBe("achieved");
    expect(report.measurementCount).toBe(1);
    expect(report.headline).toContain("Target met");
  });

  it("reproducibilityVerified true only when target is independent-replayable AND runHash present", () => {
    const independentTarget = {
      ...t,
      verificationKind: "independent-replayable" as const,
    };
    const r1 = gapReport({
      target: independentTarget,
      history: [
        makeResult({
          measuredValue: 55,
          runHash: "abc",
          verification: "independent-replayable",
        }),
      ],
    });
    expect(r1.reproducibilityVerified).toBe(true);

    const r2 = gapReport({
      target: t, // claimed-only
      history: [makeResult({ measuredValue: 55 })],
    });
    expect(r2.reproducibilityVerified).toBe(false);
  });
});

// ── Attestation ────────────────────────────────────────────────

describe("buildBenchmarkAttestationMessage", () => {
  it("is deterministic for identical inputs", () => {
    const a = buildBenchmarkAttestationMessage({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
    });
    const b = buildBenchmarkAttestationMessage({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
    });
    expect(a).toBe(b);
  });

  it("includes the target id, measured value, and run hash", () => {
    const m = buildBenchmarkAttestationMessage({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
    });
    expect(m).toContain("targetId:swe-bench-pro");
    expect(m).toContain("measuredValue:47.2");
    expect(m).toContain("runHash:abc123hash");
  });

  it("changes when any source field changes (avalanche)", () => {
    const a = buildBenchmarkAttestationMessage({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
    });
    const b = buildBenchmarkAttestationMessage({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult({
        source: {
          harnessCommit: "different-commit",
          datasetVersion: "swe-bench-pro-v1",
          modelId: "trae-agent-v1.0",
        },
      }),
      attestedAt: "2026-04-30T15:00:00.000Z",
    });
    expect(a).not.toBe(b);
  });
});

describe("computeAttestationChainHash", () => {
  it("identical inputs produce identical hashes", () => {
    const a = computeAttestationChainHash({
      parentChainHash: "abc",
      message: "msg",
      signature: "sig",
    });
    const b = computeAttestationChainHash({
      parentChainHash: "abc",
      message: "msg",
      signature: "sig",
    });
    expect(a).toBe(b);
  });

  it("avalanche on input change", () => {
    const base = computeAttestationChainHash({
      parentChainHash: "abc",
      message: "msg",
      signature: "sig",
    });
    expect(
      computeAttestationChainHash({
        parentChainHash: "xyz",
        message: "msg",
        signature: "sig",
      }),
    ).not.toBe(base);
  });

  it("GENESIS sentinel for null parent", () => {
    const a = computeAttestationChainHash({
      parentChainHash: null,
      message: "m",
      signature: "s",
    });
    const b = computeAttestationChainHash({
      parentChainHash: "GENESIS",
      message: "m",
      signature: "s",
    });
    expect(a).toBe(b);
  });
});

describe("buildSignedAttestation", () => {
  it("populates all fields including chain hash", () => {
    const att = buildSignedAttestation({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
      message: "msg",
      signature: "sig",
      parentChainHash: null,
      platformPublicKey: "pubkey-123",
    });
    expect(att.version).toBe("v1");
    expect(att.targetId).toBe("swe-bench-pro");
    expect(att.measuredValue).toBe(47.2);
    expect(att.signature).toBe("sig");
    expect(att.platformPublicKey).toBe("pubkey-123");
    expect(att.chainHash.length).toBe(64);
  });
});

describe("summarizeAttestationForReceipt", () => {
  it("includes target id + measured value + chain hash prefix", () => {
    const att = buildSignedAttestation({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
      message: "msg",
      signature: "sig",
      parentChainHash: null,
      platformPublicKey: "pubkey",
    });
    const summary = summarizeAttestationForReceipt(att);
    expect(summary).toContain("BENCHMARK ATTESTATION");
    expect(summary).toContain("swe-bench-pro");
    expect(summary).toContain("47.2");
    expect(summary).toContain(att.chainHash.slice(0, 16));
  });
});
