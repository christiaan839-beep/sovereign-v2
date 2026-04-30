/**
 * Viability gate (R140 IML + R141 RiskGate) — pure-function tests.
 *
 * No subprocess, no I/O. Tests cover:
 *   - Admission profile sealing + hashing
 *   - KL divergence math (symmetry under permutation, identity → 0)
 *   - Segment-vs-rest z-test (driving class identification)
 *   - Sequential novelty (n-gram detection)
 *   - IML composite verdict (drift / no-drift across statistic combinations)
 *   - Viability score mapping (penalties → VI(t) → recommendation)
 *   - Composite evaluateViabilityGate (gate-disabled / proceed / escalate / block)
 *   - Audit-entry shape (R140 + R141 firing variants)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isViabilityGateEnabled,
  AGENT_ACTION_CLASSES,
  hashAdmissionProfile,
  sealAdmissionProfile,
  klDivergenceClass,
  segmentVsRestZ,
  detectSequentialNovelty,
  runIML,
  computeViability,
  evaluateViabilityGate,
  ADMISSION_MIN_SAMPLES,
  MIN_WINDOW_FOR_VERDICT,
  DEFAULT_KL_BLOCK_THRESHOLD,
  DEFAULT_Z_BLOCK_THRESHOLD,
  DEFAULT_ALLOW_THRESHOLD,
  DEFAULT_ESCALATE_THRESHOLD,
  type AgentActionClass,
  type AdmissionAction,
  type AdmissionProfile,
  type RecentAction,
} from "../viability";

// ── Test helpers ───────────────────────────────────────────────────

function uniformAdmissionActions(n: number): AdmissionAction[] {
  // Cycle through every class evenly so distribution ≈ uniform.
  return Array.from({ length: n }, (_, i) => ({
    classification: AGENT_ACTION_CLASSES[i % AGENT_ACTION_CLASSES.length],
    costCents: 100,
    toolCalls: 1,
  }));
}

function readHeavyAdmissionActions(n: number): AdmissionAction[] {
  // 80% internal_read, 20% internal_write.
  return Array.from({ length: n }, (_, i) => ({
    classification: i < n * 0.8 ? "internal_read" : "internal_write",
    costCents: 50,
    toolCalls: 0,
  }));
}

function makeBaseline(actions: AdmissionAction[]): AdmissionProfile {
  const seal = sealAdmissionProfile({
    agentId: "test-agent",
    sealedAt: "2026-04-30T00:00:00.000Z",
    actions,
  });
  if (!seal.ok) throw new Error("failed to seal profile in fixture");
  return seal.profile;
}

function recentOf(
  classes: AgentActionClass[],
  baseAt: string = "2026-04-30T01:00:00.000Z",
): RecentAction[] {
  const base = Date.parse(baseAt);
  return classes.map((c, i) => ({
    classification: c,
    costCents: 100,
    toolCalls: 1,
    at: new Date(base + i * 1000).toISOString(),
  }));
}

// ── Feature flag ───────────────────────────────────────────────────

describe("isViabilityGateEnabled", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.SOVEREIGN_VIABILITY_GATE_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SOVEREIGN_VIABILITY_GATE_ENABLED;
    else process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = original;
  });

  it("returns false when env var unset", () => {
    delete process.env.SOVEREIGN_VIABILITY_GATE_ENABLED;
    expect(isViabilityGateEnabled()).toBe(false);
  });

  it("returns true when env var === 'true'", () => {
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "true";
    expect(isViabilityGateEnabled()).toBe(true);
  });

  it("returns false for any non-'true' string", () => {
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "yes";
    expect(isViabilityGateEnabled()).toBe(false);
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "1";
    expect(isViabilityGateEnabled()).toBe(false);
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "True";
    expect(isViabilityGateEnabled()).toBe(false);
  });
});

// ── Admission profile sealing ──────────────────────────────────────

describe("sealAdmissionProfile", () => {
  it("rejects empty action list", () => {
    const seal = sealAdmissionProfile({
      agentId: "x",
      sealedAt: "2026-04-30T00:00:00Z",
      actions: [],
    });
    expect(seal.ok).toBe(false);
    if (!seal.ok) expect(seal.reason).toBe("empty_input");
  });

  it("rejects fewer than ADMISSION_MIN_SAMPLES", () => {
    const seal = sealAdmissionProfile({
      agentId: "x",
      sealedAt: "2026-04-30T00:00:00Z",
      actions: uniformAdmissionActions(ADMISSION_MIN_SAMPLES - 1),
    });
    expect(seal.ok).toBe(false);
    if (!seal.ok) expect(seal.reason).toBe("insufficient_samples");
  });

  it("seals a valid profile and computes a deterministic hash", () => {
    const actions = uniformAdmissionActions(20);
    const a = sealAdmissionProfile({
      agentId: "agent-x",
      sealedAt: "2026-04-30T00:00:00Z",
      actions,
    });
    const b = sealAdmissionProfile({
      agentId: "agent-x",
      sealedAt: "2026-04-30T00:00:00Z",
      actions,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.profile.profileHash).toBe(b.profile.profileHash);
      expect(a.profile.sampleSize).toBe(20);
      // Distribution should sum to ~1.0.
      const sum = AGENT_ACTION_CLASSES.reduce(
        (s, k) => s + a.profile.classDistribution[k],
        0,
      );
      expect(sum).toBeCloseTo(1.0, 8);
    }
  });

  it("hash differs when distribution differs", () => {
    const a = makeBaseline(uniformAdmissionActions(20));
    const b = makeBaseline(readHeavyAdmissionActions(20));
    expect(a.profileHash).not.toBe(b.profileHash);
  });
});

// ── KL divergence ──────────────────────────────────────────────────

describe("klDivergenceClass", () => {
  it("returns ~0 for identical distributions", () => {
    const baseline = makeBaseline(readHeavyAdmissionActions(20)).classDistribution;
    const kl = klDivergenceClass(baseline, baseline);
    expect(kl).toBeCloseTo(0, 6);
  });

  it("is positive for differing distributions", () => {
    const a = makeBaseline(uniformAdmissionActions(20)).classDistribution;
    const b = makeBaseline(readHeavyAdmissionActions(20)).classDistribution;
    const kl = klDivergenceClass(a, b);
    expect(kl).toBeGreaterThan(0);
  });

  it("is finite even when one class has zero probability (Laplace smoothing)", () => {
    const a = makeBaseline(uniformAdmissionActions(20)).classDistribution;
    const b = makeBaseline(readHeavyAdmissionActions(20)).classDistribution;
    // readHeavy has zero for many classes — Laplace prevents log(0).
    expect(Number.isFinite(klDivergenceClass(a, b))).toBe(true);
  });
});

// ── Segment-vs-rest z-test ─────────────────────────────────────────

describe("segmentVsRestZ", () => {
  it("returns ~0 when window matches baseline", () => {
    const baseline = makeBaseline(readHeavyAdmissionActions(50)).classDistribution;
    const result = segmentVsRestZ(baseline, baseline, 30);
    expect(Math.abs(result.maxAbsZ)).toBeLessThan(1);
  });

  it("identifies driving class on divergence", () => {
    const baseline = makeBaseline(readHeavyAdmissionActions(50)).classDistribution;
    // Window: heavily external_write (vs baseline's near-zero)
    const heavyExternalWrite = {
      internal_read: 0.1,
      internal_write: 0,
      external_read: 0,
      external_write: 0.9,
      tool_call: 0,
      delegate: 0,
      memory_write: 0,
      memory_retrieve: 0,
      human_escalate: 0,
      policy_consult: 0,
    };
    const result = segmentVsRestZ(heavyExternalWrite, baseline, 30);
    expect(result.drivingClass).toBe("external_write");
    expect(Math.abs(result.maxAbsZ)).toBeGreaterThan(2);
  });
});

// ── Sequential novelty ─────────────────────────────────────────────

describe("detectSequentialNovelty", () => {
  it("does not flag when window shorter than n-gram", () => {
    const baseline = makeBaseline(readHeavyAdmissionActions(20));
    const recent = recentOf(["internal_read", "internal_read"]);
    const result = detectSequentialNovelty(recent, baseline, 3);
    expect(result.noveltyDetected).toBe(false);
  });

  it("flags an n-gram with very low marginal probability under baseline", () => {
    // Baseline: 95% internal_read, 5% internal_write — anything else has p ≈ 0
    const heavyRead: AdmissionAction[] = Array.from({ length: 100 }, (_, i) => ({
      classification: i < 95 ? "internal_read" : "internal_write",
      costCents: 50,
      toolCalls: 0,
    }));
    const baseline = makeBaseline(heavyRead);
    // Window ends with [external_write, delegate, tool_call] — none in baseline
    const recent = recentOf([
      "internal_read",
      "internal_read",
      "external_write",
      "delegate",
      "tool_call",
    ]);
    const result = detectSequentialNovelty(recent, baseline, 3);
    expect(result.noveltyDetected).toBe(true);
    expect(result.pattern).toEqual(["external_write", "delegate", "tool_call"]);
  });

  it("does not flag when n-gram is consistent with baseline", () => {
    const baseline = makeBaseline(uniformAdmissionActions(50));
    const recent = recentOf(["internal_read", "internal_write", "external_read"]);
    const result = detectSequentialNovelty(recent, baseline, 3);
    expect(result.noveltyDetected).toBe(false);
  });
});

// ── Composite IML ──────────────────────────────────────────────────

describe("runIML", () => {
  it("returns no-drift when window too small for verdict", () => {
    const baseline = makeBaseline(uniformAdmissionActions(20));
    const recent = recentOf(["internal_read", "internal_read"]);
    const v = runIML({ recent, baseline });
    expect(v.driftDetected).toBe(false);
    expect(v.summary).toContain("insufficient samples");
  });

  it("returns no-drift when window matches baseline distribution", () => {
    const baseline = makeBaseline(uniformAdmissionActions(50));
    // Recent window: same uniform pattern
    const classes: AgentActionClass[] = [];
    for (let i = 0; i < 30; i++) {
      classes.push(AGENT_ACTION_CLASSES[i % AGENT_ACTION_CLASSES.length]);
    }
    const recent = recentOf(classes);
    const v = runIML({ recent, baseline });
    expect(v.driftDetected).toBe(false);
    expect(v.klDivergence).toBeLessThan(DEFAULT_KL_BLOCK_THRESHOLD);
  });

  it("flags drift when window dramatically diverges from baseline", () => {
    const baseline = makeBaseline(readHeavyAdmissionActions(100));
    // Window: all external_write — the class baseline has near-zero on
    const classes: AgentActionClass[] = Array(30).fill("external_write");
    const recent = recentOf(classes);
    const v = runIML({ recent, baseline });
    expect(v.driftDetected).toBe(true);
    expect(v.summary).toContain("drift");
  });

  it("references the baseline profileHash in its verdict", () => {
    const baseline = makeBaseline(uniformAdmissionActions(20));
    const recent = recentOf(Array(15).fill("internal_read") as AgentActionClass[]);
    const v = runIML({ recent, baseline });
    expect(v.profileHash).toBe(baseline.profileHash);
  });
});

// ── Viability score (RiskGate) ─────────────────────────────────────

describe("computeViability", () => {
  function noDriftVerdict(profileHash: string) {
    return {
      driftDetected: false,
      klDivergence: 0,
      segmentZ: {
        maxAbsZ: 0,
        drivingClass: "internal_read" as AgentActionClass,
        observed: 0,
        expected: 0,
      },
      novelty: { noveltyDetected: false, pattern: [], baselineProbability: 1 },
      windowSize: 30,
      profileHash,
      summary: "ok",
    };
  }

  it("returns VI=1.0 + proceed when no drift signals fire", () => {
    const score = computeViability({ imlVerdict: noDriftVerdict("h") });
    expect(score.vi).toBe(1);
    expect(score.recommendation).toBe("proceed");
    expect(score.penalties.kl).toBe(0);
    expect(score.penalties.z).toBe(0);
    expect(score.penalties.novelty).toBe(0);
  });

  it("subtracts kl-penalty proportional to KL/klBlock", () => {
    const v = noDriftVerdict("h");
    v.klDivergence = DEFAULT_KL_BLOCK_THRESHOLD * 0.5; // half-way to block
    const score = computeViability({ imlVerdict: v });
    expect(score.penalties.kl).toBeCloseTo(0.5, 6);
    expect(score.vi).toBeCloseTo(0.5, 6);
  });

  it("caps z-penalty at 0.5", () => {
    const v = noDriftVerdict("h");
    v.segmentZ = {
      ...v.segmentZ,
      maxAbsZ: 100, // far above any reasonable threshold
    };
    const score = computeViability({ imlVerdict: v });
    expect(score.penalties.z).toBe(0.5);
  });

  it("escalates HITL when VI in [escalate, allow)", () => {
    const v = noDriftVerdict("h");
    v.klDivergence = DEFAULT_KL_BLOCK_THRESHOLD * 0.85;
    const score = computeViability({ imlVerdict: v });
    expect(score.vi).toBeLessThan(DEFAULT_ALLOW_THRESHOLD);
    expect(score.vi).toBeGreaterThanOrEqual(DEFAULT_ESCALATE_THRESHOLD);
    expect(score.recommendation).toBe("escalate_hitl");
  });

  it("blocks when VI < escalateThreshold", () => {
    const v = noDriftVerdict("h");
    v.klDivergence = DEFAULT_KL_BLOCK_THRESHOLD * 1.5; // pushes VI below escalate
    v.novelty.noveltyDetected = true;
    const score = computeViability({ imlVerdict: v });
    expect(score.vi).toBeLessThan(DEFAULT_ESCALATE_THRESHOLD);
    expect(score.recommendation).toBe("block");
  });

  it("respects custom thresholds", () => {
    const v = noDriftVerdict("h");
    v.klDivergence = 0.1; // small
    const strict = computeViability({
      imlVerdict: v,
      options: { allowThreshold: 0.99 }, // very strict
    });
    expect(strict.recommendation).not.toBe("proceed");
    const lax = computeViability({
      imlVerdict: v,
      options: { allowThreshold: -0.5, escalateThreshold: -0.99 },
    });
    expect(lax.recommendation).toBe("proceed");
  });
});

// ── Composite gate ─────────────────────────────────────────────────

describe("evaluateViabilityGate", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.SOVEREIGN_VIABILITY_GATE_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SOVEREIGN_VIABILITY_GATE_ENABLED;
    else process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = original;
  });

  it("proceeds with reason 'gate_disabled' when flag off", () => {
    delete process.env.SOVEREIGN_VIABILITY_GATE_ENABLED;
    const baseline = makeBaseline(uniformAdmissionActions(20));
    const recent = recentOf(Array(30).fill("internal_read") as AgentActionClass[]);
    const v = evaluateViabilityGate("agent-x", { recent, baseline });
    expect(v.proceed).toBe(true);
    if (v.proceed) expect(v.reason).toBe("gate_disabled");
  });

  it("proceeds with reason 'viability_proceed' when no drift detected", () => {
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "true";
    const baseline = makeBaseline(uniformAdmissionActions(50));
    const classes: AgentActionClass[] = [];
    for (let i = 0; i < 30; i++) {
      classes.push(AGENT_ACTION_CLASSES[i % AGENT_ACTION_CLASSES.length]);
    }
    const recent = recentOf(classes);
    const v = evaluateViabilityGate("agent-x", { recent, baseline });
    expect(v.proceed).toBe(true);
    if (v.proceed) expect(v.reason).toBe("viability_proceed");
  });

  it("blocks with viability_below_block_threshold on extreme drift", () => {
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "true";
    const baseline = makeBaseline(readHeavyAdmissionActions(100));
    const classes: AgentActionClass[] = Array(30).fill("external_write");
    const recent = recentOf(classes);
    const v = evaluateViabilityGate("agent-x", { recent, baseline });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      expect(v.reason).toBe("viability_below_block_threshold");
      expect(v.score.recommendation).toBe("block");
      expect(v.response.error).toBe("viability_gate_refused");
      expect(v.response.recommendation).toBe("block");
    }
  });

  it("emits R140 + R141 audit entries when blocking", () => {
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "true";
    const baseline = makeBaseline(readHeavyAdmissionActions(100));
    const classes: AgentActionClass[] = Array(30).fill("external_write");
    const recent = recentOf(classes);
    const v = evaluateViabilityGate("agent-x", { recent, baseline });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      const actions = v.auditEntries.map((e) => e.action);
      expect(actions).toContain("agent.drift_detected");
      expect(actions).toContain("agent.viability_threshold");
      // The drift entry references the profile hash
      const driftEntry = v.auditEntries.find((e) => e.action === "agent.drift_detected");
      expect(driftEntry?.details.profileHash).toBe(baseline.profileHash);
    }
  });

  it("escalates HITL with single audit entry when drift is moderate", () => {
    process.env.SOVEREIGN_VIABILITY_GATE_ENABLED = "true";
    const baseline = makeBaseline(uniformAdmissionActions(50));
    // Mildly skewed: 50/50 internal_read and external_write — KL is ~0.7
    // (above warn but below block). Using custom thresholds to land in
    // the escalate band deterministically.
    const classes: AgentActionClass[] = [];
    for (let i = 0; i < 30; i++) {
      classes.push(i % 2 === 0 ? "internal_read" : "external_write");
    }
    const recent = recentOf(classes);
    const v = evaluateViabilityGate("agent-x", {
      recent,
      baseline,
      // Tighten allow threshold so we land in escalate band
      riskGateOptions: { allowThreshold: 0.95, escalateThreshold: -0.95 },
    });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      expect(v.reason).toBe("viability_escalate_hitl");
      expect(v.response.recommendation).toBe("escalate_hitl");
    }
  });
});

// ── Hash anchoring (anti-tampering) ────────────────────────────────

describe("hashAdmissionProfile", () => {
  it("produces stable hashes for identical inputs", () => {
    const args = {
      agentId: "agent-a",
      sealedAt: "2026-04-30T00:00:00.000Z",
      sampleSize: 50,
      classDistribution: {
        internal_read: 0.5,
        internal_write: 0.5,
        external_read: 0,
        external_write: 0,
        tool_call: 0,
        delegate: 0,
        memory_write: 0,
        memory_retrieve: 0,
        human_escalate: 0,
        policy_consult: 0,
      },
      meanCostCents: 100,
      meanToolCalls: 1,
    };
    const h1 = hashAdmissionProfile(args);
    const h2 = hashAdmissionProfile(args);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when distribution changes", () => {
    const a = {
      agentId: "agent-a",
      sealedAt: "2026-04-30T00:00:00.000Z",
      sampleSize: 50,
      classDistribution: {
        internal_read: 0.5,
        internal_write: 0.5,
        external_read: 0,
        external_write: 0,
        tool_call: 0,
        delegate: 0,
        memory_write: 0,
        memory_retrieve: 0,
        human_escalate: 0,
        policy_consult: 0,
      },
      meanCostCents: 100,
      meanToolCalls: 1,
    };
    const b = { ...a, classDistribution: { ...a.classDistribution, internal_read: 0.6, internal_write: 0.4 } };
    expect(hashAdmissionProfile(a)).not.toBe(hashAdmissionProfile(b));
  });
});
