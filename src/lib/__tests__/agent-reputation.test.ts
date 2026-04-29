/**
 * agent-reputation — tests.
 *
 * Pure-function calculator: same inputs → same outputs.
 *
 * Covers:
 *   - No-data → "no_score_yet"
 *   - Default agent (no signals) → "B" at base 75
 *   - Reversal penalties scale linearly
 *   - HITL rejection penalties scale linearly
 *   - Audit integrity is a binary swing
 *   - Manifest age bonus caps at 1 year
 *   - Usage bonus is log-scale
 *   - Cost efficiency: only cheaper-than-median bonus, never penalty
 *   - Anomaly events accumulate penalty up to a cap
 *   - Final clamp [0, 100]
 *   - Letter grade boundaries
 */

import { describe, it, expect } from "vitest";
import {
  computeReputationScore,
  gradeFromScore,
  type ReputationSignals,
} from "../agent-reputation";

function emptySignals(overrides: Partial<ReputationSignals> = {}): ReputationSignals {
  return {
    reversalCount30d: 0,
    totalChargeCount30d: 0,
    hitlDeniedCount30d: 0,
    totalHitlCount30d: 0,
    auditChainIntact: true,
    manifestAgeDays: 0,
    usageCount30d: 0,
    costVsMedianPct: 0,
    anomalyCount30d: 0,
    ...overrides,
  };
}

describe("agent-reputation — gradeFromScore", () => {
  it("maps boundary scores to expected grades", () => {
    expect(gradeFromScore(100)).toBe("A+");
    expect(gradeFromScore(95)).toBe("A+");
    expect(gradeFromScore(94)).toBe("A");
    expect(gradeFromScore(90)).toBe("A");
    expect(gradeFromScore(89)).toBe("A-");
    expect(gradeFromScore(85)).toBe("A-");
    expect(gradeFromScore(80)).toBe("B+");
    expect(gradeFromScore(75)).toBe("B");
    expect(gradeFromScore(70)).toBe("B-");
    expect(gradeFromScore(65)).toBe("C+");
    expect(gradeFromScore(60)).toBe("C");
    expect(gradeFromScore(55)).toBe("C-");
    expect(gradeFromScore(45)).toBe("D");
    expect(gradeFromScore(44)).toBe("F");
    expect(gradeFromScore(0)).toBe("F");
  });
});

describe("agent-reputation — no-data path", () => {
  it("agent with no signals → no_score_yet", () => {
    const r = computeReputationScore(emptySignals());
    expect(r.letterGrade).toBe("no_score_yet");
    expect(r.numericScore).toBe(0);
  });

  it("audit integrity alone doesn't elevate to a real score", () => {
    // Even though auditIntact is true, with no usage/manifest age,
    // we don't fabricate a score
    const r = computeReputationScore(emptySignals({ auditChainIntact: true }));
    expect(r.letterGrade).toBe("no_score_yet");
  });
});

describe("agent-reputation — single-signal cases", () => {
  it("agent with usage but no penalties → above-base score", () => {
    const r = computeReputationScore(
      emptySignals({
        manifestAgeDays: 30,
        usageCount30d: 10,
        auditChainIntact: true,
      }),
    );
    // Base 75 + audit_intact +15 + small age bonus + small usage bonus
    expect(r.numericScore).toBeGreaterThan(75);
    expect(r.numericScore).toBeLessThanOrEqual(100);
  });

  it("100% reversal rate → max penalty applied", () => {
    const r = computeReputationScore(
      emptySignals({
        reversalCount30d: 10,
        totalChargeCount30d: 10,
        manifestAgeDays: 30,
        usageCount30d: 10,
      }),
    );
    expect(r.signalsBreakdown.reversalPenalty).toBe(30);
    expect(r.reversalRatePct).toBe(100);
  });

  it("0% reversal rate → no reversal penalty", () => {
    const r = computeReputationScore(
      emptySignals({
        reversalCount30d: 0,
        totalChargeCount30d: 100,
        manifestAgeDays: 30,
        usageCount30d: 100,
      }),
    );
    expect(r.signalsBreakdown.reversalPenalty).toBe(0);
  });

  it("HITL rejection rate scales linearly", () => {
    const r = computeReputationScore(
      emptySignals({
        hitlDeniedCount30d: 5,
        totalHitlCount30d: 10,
        manifestAgeDays: 30,
        usageCount30d: 10,
      }),
    );
    // 50% rejection → 12.5 penalty (50% of 25 max)
    expect(r.hitlRejectionPct).toBe(50);
    expect(r.signalsBreakdown.hitlPenalty).toBe(12.5);
  });

  it("audit chain broken → -15 penalty (and integrity flag false)", () => {
    const r = computeReputationScore(
      emptySignals({
        auditChainIntact: false,
        manifestAgeDays: 30,
        usageCount30d: 10,
      }),
    );
    expect(r.auditIntegrity).toBe(false);
    expect(r.signalsBreakdown.auditModifier).toBe(-15);
  });

  it("anomaly count ≥5 → max penalty (-20)", () => {
    const r = computeReputationScore(
      emptySignals({
        anomalyCount30d: 10,
        manifestAgeDays: 30,
        usageCount30d: 10,
      }),
    );
    expect(r.signalsBreakdown.anomalyPenalty).toBe(20);
  });

  it("manifest age bonus caps at 1 year", () => {
    const r = computeReputationScore(
      emptySignals({
        manifestAgeDays: 730, // 2 years
        usageCount30d: 10,
      }),
    );
    expect(r.signalsBreakdown.ageBonus).toBe(10);
  });

  it("usage bonus is log-scale (10 uses gets meaningful bonus)", () => {
    const r10 = computeReputationScore(
      emptySignals({
        usageCount30d: 10,
        manifestAgeDays: 30,
      }),
    );
    const r1000 = computeReputationScore(
      emptySignals({
        usageCount30d: 1000,
        manifestAgeDays: 30,
      }),
    );
    // 1000 should get more bonus than 10, but only modestly more
    // (log-scale)
    expect(r1000.signalsBreakdown.usageBonus).toBeGreaterThan(
      r10.signalsBreakdown.usageBonus,
    );
    expect(r1000.signalsBreakdown.usageBonus).toBe(15); // max
    expect(r10.signalsBreakdown.usageBonus).toBeGreaterThan(5);
  });

  it("cost: cheaper than median gets bonus", () => {
    const r = computeReputationScore(
      emptySignals({
        costVsMedianPct: -50, // 50% cheaper
        manifestAgeDays: 30,
        usageCount30d: 10,
      }),
    );
    expect(r.signalsBreakdown.costBonus).toBe(10);
  });

  it("cost: equal-or-above-median = no bonus, no penalty", () => {
    const r = computeReputationScore(
      emptySignals({
        costVsMedianPct: 50, // 50% MORE expensive
        manifestAgeDays: 30,
        usageCount30d: 10,
      }),
    );
    expect(r.signalsBreakdown.costBonus).toBe(0);
  });
});

describe("agent-reputation — clamping + grade composition", () => {
  it("perfect agent caps at 100 (A+)", () => {
    const r = computeReputationScore({
      reversalCount30d: 0,
      totalChargeCount30d: 1000,
      hitlDeniedCount30d: 0,
      totalHitlCount30d: 100,
      auditChainIntact: true,
      manifestAgeDays: 730,
      usageCount30d: 10000,
      costVsMedianPct: -80,
      anomalyCount30d: 0,
    });
    expect(r.numericScore).toBeLessThanOrEqual(100);
    expect(r.numericScore).toBeGreaterThanOrEqual(95);
    expect(r.letterGrade).toBe("A+");
  });

  it("worst agent floors at 0 (F)", () => {
    const r = computeReputationScore({
      reversalCount30d: 100,
      totalChargeCount30d: 100,
      hitlDeniedCount30d: 100,
      totalHitlCount30d: 100,
      auditChainIntact: false,
      manifestAgeDays: 0,
      usageCount30d: 10,
      costVsMedianPct: 200,
      anomalyCount30d: 50,
    });
    expect(r.numericScore).toBeGreaterThanOrEqual(0);
    expect(r.numericScore).toBeLessThan(50);
  });
});
