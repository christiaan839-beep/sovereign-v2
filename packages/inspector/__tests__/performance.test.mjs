/**
 * @sovereign/inspector — performance module tests.
 *
 * Verifies cross-implementation agreement with src/lib/performance/.
 * If these tests pass, customers can offline-verify benchmark
 * attestations the platform claims.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERFORMANCE_TARGETS,
  SWE_BENCH_PRO_TARGET,
  GATEWAY_OVERHEAD_LATENCY_TARGET,
  findTargetById,
  listTargets,
  computeDrift,
  classifyDrift,
  classifyTargetStatus,
  validateBenchmarkResult,
  leastSquaresFit,
  estimateTimeToTarget,
  gapReport,
  buildBenchmarkAttestationMessage,
  computeAttestationChainHash,
  buildSignedAttestation,
  summarizeAttestationForReceipt,
} from "../src/performance.mjs";

function makeResult(overrides = {}) {
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

describe("Targets registry", () => {
  it("contains 7 prebuilt 2026 SOTA targets", () => {
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
  it("findTargetById returns prebuilt and undefined for missing", () => {
    expect(findTargetById("swe-bench-pro").targetValue).toBe(50);
    expect(findTargetById("nonexistent")).toBeUndefined();
  });
  it("listTargets sorts by id by default", () => {
    const list = listTargets();
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(list).toEqual(sorted);
  });
  it("listTargets filters by phase", () => {
    const phase2 = listTargets({ phase: "phase-2" });
    expect(phase2.every((t) => t.phase === "phase-2")).toBe(true);
  });
});

describe("computeDrift — both directions", () => {
  it("higher-is-better: positive when above target", () => {
    expect(computeDrift(SWE_BENCH_PRO_TARGET, 60)).toBeCloseTo(20, 5);
  });
  it("higher-is-better: negative when below target", () => {
    expect(computeDrift(SWE_BENCH_PRO_TARGET, 40)).toBeCloseTo(-20, 5);
  });
  it("lower-is-better: positive when under budget", () => {
    expect(computeDrift(GATEWAY_OVERHEAD_LATENCY_TARGET, 2)).toBeCloseTo(50, 5);
  });
  it("lower-is-better: negative when over budget", () => {
    expect(computeDrift(GATEWAY_OVERHEAD_LATENCY_TARGET, 8)).toBeCloseTo(
      -100,
      5,
    );
  });
});

describe("classifyDrift — thresholds at 0/-10/-25", () => {
  it(">= 0 → achieved", () => {
    expect(classifyDrift(0)).toBe("achieved");
    expect(classifyDrift(20)).toBe("achieved");
  });
  it("[-10, 0) → on-track", () => {
    expect(classifyDrift(-1)).toBe("on-track");
    expect(classifyDrift(-10)).toBe("on-track");
  });
  it("[-25, -10) → at-risk", () => {
    expect(classifyDrift(-15)).toBe("at-risk");
    expect(classifyDrift(-25)).toBe("at-risk");
  });
  it("< -25 → behind", () => {
    expect(classifyDrift(-30)).toBe("behind");
  });
});

describe("classifyTargetStatus", () => {
  it("returns not-measured when result is null", () => {
    const c = classifyTargetStatus(SWE_BENCH_PRO_TARGET, null);
    expect(c.status).toBe("not-measured");
  });
  it("returns achieved when measured meets target", () => {
    const c = classifyTargetStatus(
      SWE_BENCH_PRO_TARGET,
      makeResult({ measuredValue: 60 }),
    );
    expect(c.status).toBe("achieved");
  });
  it("flags TARGET ONLY in reason when verificationKind=claimed-only", () => {
    const c = classifyTargetStatus(
      SWE_BENCH_PRO_TARGET,
      makeResult({ measuredValue: 49 }),
    );
    expect(c.reason).toContain("TARGET ONLY");
  });
});

describe("validateBenchmarkResult — anti-AI-washing", () => {
  it("ok on complete result", () => {
    expect(
      validateBenchmarkResult({
        result: makeResult(),
        target: SWE_BENCH_PRO_TARGET,
      }).ok,
    ).toBe(true);
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
        source: { harnessCommit: "", datasetVersion: "x", modelId: "y" },
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
      verificationKind: "independent-replayable",
    };
    const v = validateBenchmarkResult({
      result: makeResult({ verification: "internal-only" }),
      target,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("verification_too_weak");
  });
});

describe("leastSquaresFit + estimateTimeToTarget", () => {
  it("recovers known line y=2t+5", () => {
    const fit = leastSquaresFit([
      { t: 0, y: 5 },
      { t: 1, y: 7 },
      { t: 2, y: 9 },
      { t: 3, y: 11 },
    ]);
    expect(fit.slope).toBeCloseTo(2, 5);
    expect(fit.intercept).toBeCloseTo(5, 5);
  });
  it("returns null on insufficient distinct timestamps", () => {
    expect(
      leastSquaresFit([
        { t: 1, y: 10 },
        { t: 1, y: 20 },
      ]),
    ).toBeNull();
  });
  it("estimateTimeToTarget: 0 days when target already met", () => {
    const ttt = estimateTimeToTarget({
      target: SWE_BENCH_PRO_TARGET,
      history: [makeResult({ measuredValue: 55 })],
    });
    expect(ttt.estimatedDays).toBe(0);
  });
  it("estimateTimeToTarget: null when trend moves away", () => {
    const ttt = estimateTimeToTarget({
      target: SWE_BENCH_PRO_TARGET,
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
  it("estimateTimeToTarget: positive ETA on rising trend", () => {
    const ttt = estimateTimeToTarget({
      target: SWE_BENCH_PRO_TARGET,
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
    expect(ttt.estimatedDays).toBeGreaterThan(0);
  });
});

describe("gapReport — integration", () => {
  it("returns not-measured for empty history", () => {
    const r = gapReport({ target: SWE_BENCH_PRO_TARGET, history: [] });
    expect(r.status.status).toBe("not-measured");
    expect(r.measurementCount).toBe(0);
    expect(r.reproducibilityVerified).toBe(false);
  });
  it("reproducibilityVerified true only when target=independent-replayable AND runHash present", () => {
    const independentTarget = {
      ...SWE_BENCH_PRO_TARGET,
      verificationKind: "independent-replayable",
    };
    const r = gapReport({
      target: independentTarget,
      history: [
        makeResult({
          runHash: "abc",
          verification: "independent-replayable",
        }),
      ],
    });
    expect(r.reproducibilityVerified).toBe(true);
  });
});

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
  it("includes target id, measured value, runHash", () => {
    const m = buildBenchmarkAttestationMessage({
      target: SWE_BENCH_PRO_TARGET,
      result: makeResult(),
      attestedAt: "2026-04-30T15:00:00.000Z",
    });
    expect(m).toContain("targetId:swe-bench-pro");
    expect(m).toContain("measuredValue:47.2");
    expect(m).toContain("runHash:abc123hash");
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

describe("buildSignedAttestation + summarizeAttestationForReceipt", () => {
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
    expect(att.chainHash.length).toBe(64);
  });
  it("summarizeAttestationForReceipt contains key fields", () => {
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
  });
});
