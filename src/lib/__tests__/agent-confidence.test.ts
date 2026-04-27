import { describe, it, expect } from "vitest";
import {
  scoreConfidence,
  computeInputOutputOverlap,
} from "@/lib/agent-confidence";

describe("scoreConfidence", () => {
  const baseline = {
    schemaMatch: "no-schema" as const,
    modelsConsulted: 1,
    consensusAgreed: null,
    safetyFlagged: false,
    inputOutputOverlap: 0.2,
    evalPassRate: null,
  };

  it("clean schema + 2-model consensus + agreed = high", () => {
    const r = scoreConfidence({
      ...baseline,
      schemaMatch: "clean",
      modelsConsulted: 2,
      consensusAgreed: true,
      evalPassRate: 0.96,
    });
    expect(r.score).toBeGreaterThanOrEqual(0.85);
    expect(r.band).toBe("high");
  });

  it("safety flagged drives band down", () => {
    const r = scoreConfidence({
      ...baseline,
      schemaMatch: "clean",
      safetyFlagged: true,
    });
    // -0.15 from safety, baseline novelty + neutral diversity + neutral eval
    expect(r.score).toBeLessThan(0.7);
  });

  it("schema violation pulls confidence down", () => {
    const r = scoreConfidence({
      ...baseline,
      schemaMatch: "violation",
    });
    const breakdown = r.breakdown.find((b) => b.factor === "schema_match");
    expect(breakdown?.contribution).toBe(0.05);
  });

  it("parrot output (high overlap) → low novelty contribution", () => {
    const r = scoreConfidence({
      ...baseline,
      inputOutputOverlap: 0.85,
    });
    const breakdown = r.breakdown.find((b) => b.factor === "output_novelty");
    expect(breakdown?.contribution).toBe(0.04);
  });

  it("low eval pass rate → low contribution", () => {
    const r = scoreConfidence({
      ...baseline,
      evalPassRate: 0.5,
    });
    const breakdown = r.breakdown.find((b) => b.factor === "eval_pass_rate");
    expect(breakdown?.contribution).toBe(0.05);
  });

  it("scores are deterministic given identical inputs", () => {
    const a = scoreConfidence({ ...baseline, schemaMatch: "clean" });
    const b = scoreConfidence({ ...baseline, schemaMatch: "clean" });
    expect(a.score).toBe(b.score);
  });

  it("band thresholds: 0.85+ = high, 0.65-0.84 = moderate, 0.45-0.64 = review, <0.45 = draft", () => {
    expect(scoreConfidence({ ...baseline, schemaMatch: "clean", modelsConsulted: 2, consensusAgreed: true, evalPassRate: 0.96 }).band).toBe("high");
    expect(scoreConfidence({ ...baseline, schemaMatch: "clean" }).band).toBe("moderate");
    expect(scoreConfidence({ ...baseline, schemaMatch: "violation", inputOutputOverlap: 0.85, evalPassRate: 0.5 }).band).toBe("draft");
  });

  it("recommendedAction is non-empty for every band", () => {
    for (const sm of ["clean", "coerced", "violation", "no-schema"] as const) {
      const r = scoreConfidence({ ...baseline, schemaMatch: sm });
      expect(r.recommendedAction.length).toBeGreaterThan(20);
    }
  });
});

describe("computeInputOutputOverlap", () => {
  it("returns 0 for empty input or output", () => {
    expect(computeInputOutputOverlap("", "anything")).toBe(0);
    expect(computeInputOutputOverlap("anything", "")).toBe(0);
  });

  it("near-1 when output is mostly the input", () => {
    const input = "the quick brown fox jumps over the lazy dog";
    const output = "the quick brown fox indeed jumped over the lazy dog";
    const r = computeInputOutputOverlap(input, output);
    expect(r).toBeGreaterThan(0.7);
  });

  it("near-0 when output is novel", () => {
    const r = computeInputOutputOverlap(
      "blockchain interoperability framework",
      "summer afternoon ocean breeze",
    );
    expect(r).toBeLessThan(0.1);
  });

  it("filters out tokens shorter than 3 chars (noise reduction)", () => {
    const r = computeInputOutputOverlap("a b c d e f", "a b c d e f");
    // All tokens are 1 char and filtered out → no shared tokens → 0
    expect(r).toBe(0);
  });
});
