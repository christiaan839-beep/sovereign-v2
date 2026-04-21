import { describe, it, expect } from "vitest";
import { SLOS, classifyBreach, percentile, type SampleSummary } from "@/lib/slo-tracking";

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 0.95)).toBe(0);
  });

  it("returns the only value for a single-element array", () => {
    expect(percentile([42], 0.95)).toBe(42);
  });

  it("computes p95 correctly for 100 evenly-spaced values", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    // p95 of 1..100 → ceil(0.95 * 100) = 95 → values[94] = 95
    expect(percentile(values, 0.95)).toBe(95);
  });

  it("does not mutate the input array", () => {
    const input = [3, 1, 2];
    percentile(input, 0.5);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("classifyBreach — availability mode", () => {
  const slo = SLOS.health_availability; // 99.9% target

  it("returns not-breached when pass rate meets target", () => {
    const summary: SampleSummary = { count: 1000, passed: 999, failed: 1, values: [] };
    const report = classifyBreach(slo, summary);
    expect(report.breached).toBe(false);
    expect(report.current).toBeCloseTo(0.999);
  });

  it("returns breached when pass rate falls below target", () => {
    const summary: SampleSummary = { count: 1000, passed: 990, failed: 10, values: [] };
    const report = classifyBreach(slo, summary);
    expect(report.breached).toBe(true);
    expect(report.message).toContain("99.00%");
  });

  it("handles zero samples gracefully (no breach, no signal)", () => {
    const summary: SampleSummary = { count: 0, passed: 0, failed: 0, values: [] };
    const report = classifyBreach(slo, summary);
    expect(report.breached).toBe(false);
    expect(report.message).toContain("No samples");
  });
});

describe("classifyBreach — latency_p95 mode", () => {
  const slo = SLOS.agent_latency_p95; // 8000ms target

  it("passes when p95 is under target", () => {
    const values = Array.from({ length: 100 }, (_, i) => 1000 + i * 50); // 1000..5950
    const summary: SampleSummary = { count: 100, passed: 100, failed: 0, values };
    const report = classifyBreach(slo, summary);
    expect(report.breached).toBe(false);
    expect(report.current).toBeLessThan(8000);
  });

  it("breaches when p95 exceeds target", () => {
    const values = Array.from({ length: 100 }, (_, i) => 5000 + i * 100); // 5000..14900
    const summary: SampleSummary = { count: 100, passed: 100, failed: 0, values };
    const report = classifyBreach(slo, summary);
    expect(report.breached).toBe(true);
    expect(report.message).toContain("p95 latency");
  });
});

describe("SLOS registry", () => {
  it("exports all 5 definitions", () => {
    expect(Object.keys(SLOS)).toEqual([
      "health_availability",
      "agent_latency_p95",
      "playbook_completion",
      "stripe_webhook_ok",
      "voice_first_audio_p95",
    ]);
  });

  it("each SLO has either targetPct or targetMs, never both missing", () => {
    for (const [name, slo] of Object.entries(SLOS)) {
      const hasTarget = typeof slo.targetPct === "number" || typeof slo.targetMs === "number";
      expect(hasTarget, `${name} has no target`).toBe(true);
    }
  });

  it("availability SLOs have targetPct; latency SLOs have targetMs", () => {
    for (const slo of Object.values(SLOS)) {
      if (slo.mode === "availability") expect(typeof slo.targetPct).toBe("number");
      if (slo.mode === "latency_p95") expect(typeof slo.targetMs).toBe("number");
    }
  });
});
