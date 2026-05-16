/**
 * Tests for src/lib/status-metrics.ts — Wave 15.
 *
 * The pure reducers (percentile, reduceWindow, deriveOverall) get
 * thorough coverage; computeStatusMetrics is exercised via the
 * pure-function path so we don't need a live DB.
 */
import { describe, it, expect } from "vitest";
import { percentile, reduceWindow, deriveOverall } from "@/lib/status-metrics";

describe("percentile", () => {
  it("returns null for an empty array", () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it("returns the single value when n=1", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.99)).toBe(42);
  });

  it("computes p50 (median) correctly on an odd-length series", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("interpolates between adjacent samples on an even-length series", () => {
    // sorted [10, 20], p50 → rank 0.5 → 10 * 0.5 + 20 * 0.5 = 15
    expect(percentile([10, 20], 0.5)).toBe(15);
  });

  it("returns the max for p=1.0", () => {
    expect(percentile([1, 5, 9, 13], 1.0)).toBe(13);
  });

  it("returns the min for p=0.0", () => {
    expect(percentile([1, 5, 9, 13], 0.0)).toBe(1);
  });

  it("matches the canonical p95 on a 1000-sample uniform distribution", () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i + 1);
    const p95 = percentile(xs, 0.95);
    // For [1..1000], p95 rank = 0.95 * 999 = 949.05 → between xs[949]=950
    // and xs[950]=951, interpolated to 950.05.
    expect(p95).toBeCloseTo(950.05, 2);
  });
});

describe("reduceWindow", () => {
  it("returns an empty block when rows is empty", () => {
    const m = reduceWindow("24h", []);
    expect(m.window).toBe("24h");
    expect(m.count).toBe(0);
    expect(m.successCount).toBe(0);
    expect(m.successRate).toBe(1); // empty defaults to optimistic
    expect(m.latencyMs.p50).toBeNull();
    expect(m.latencyMs.p95).toBeNull();
    expect(m.latencyMs.p99).toBeNull();
    expect(m.latencyMs.max).toBeNull();
  });

  it("counts only blocked rows as failures", () => {
    const m = reduceWindow("24h", [
      { durationMs: 100, trustDecision: "auto-approved" },
      { durationMs: 200, trustDecision: "needs-approval" },
      { durationMs: 300, trustDecision: "blocked" },
    ]);
    expect(m.count).toBe(3);
    expect(m.successCount).toBe(2); // auto-approved + needs-approval
    expect(m.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("ignores non-finite / negative durations in percentile math", () => {
    const m = reduceWindow("24h", [
      { durationMs: 100, trustDecision: "auto-approved" },
      { durationMs: NaN, trustDecision: "auto-approved" },
      { durationMs: -5, trustDecision: "auto-approved" },
      { durationMs: 200, trustDecision: "auto-approved" },
    ]);
    expect(m.count).toBe(4); // count includes everything
    // But percentiles only consider [100, 200]
    expect(m.latencyMs.p50).toBe(150);
    expect(m.latencyMs.max).toBe(200);
  });

  it("computes latency percentiles correctly on a realistic series", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      durationMs: (i + 1) * 10,
      trustDecision: "auto-approved",
    }));
    const m = reduceWindow("7d", rows);
    expect(m.count).toBe(100);
    expect(m.successCount).toBe(100);
    expect(m.successRate).toBe(1);
    // sorted [10, 20, …, 1000]; p50 → rank 49.5 → (500 + 510) / 2 = 505
    expect(m.latencyMs.p50).toBe(505);
    expect(m.latencyMs.max).toBe(1000);
  });
});

describe("deriveOverall", () => {
  it("returns 'ok' for an empty/undefined 24h block (defaults optimistic)", () => {
    expect(deriveOverall(undefined)).toBe("ok");
    expect(
      deriveOverall({
        window: "24h",
        count: 0,
        successCount: 0,
        successRate: 1,
        latencyMs: { p50: null, p95: null, p99: null, max: null },
      }),
    ).toBe("ok");
  });

  it("returns 'ok' when success rate >= 99.5%", () => {
    expect(
      deriveOverall({
        window: "24h",
        count: 1000,
        successCount: 996,
        successRate: 0.996,
        latencyMs: { p50: 100, p95: 200, p99: 400, max: 800 },
      }),
    ).toBe("ok");
  });

  it("returns 'degraded' when success rate is in [95%, 99.5%)", () => {
    expect(
      deriveOverall({
        window: "24h",
        count: 1000,
        successCount: 970,
        successRate: 0.97,
        latencyMs: { p50: 100, p95: 200, p99: 400, max: 800 },
      }),
    ).toBe("degraded");
  });

  it("returns 'fail' when success rate < 95%", () => {
    expect(
      deriveOverall({
        window: "24h",
        count: 1000,
        successCount: 900,
        successRate: 0.9,
        latencyMs: { p50: 100, p95: 200, p99: 400, max: 800 },
      }),
    ).toBe("fail");
  });

  it("boundary: exactly 99.5% rounds to 'ok'", () => {
    expect(
      deriveOverall({
        window: "24h",
        count: 200,
        successCount: 199,
        successRate: 0.995,
        latencyMs: { p50: 100, p95: 200, p99: 400, max: 800 },
      }),
    ).toBe("ok");
  });

  it("boundary: exactly 95% rounds to 'degraded'", () => {
    expect(
      deriveOverall({
        window: "24h",
        count: 200,
        successCount: 190,
        successRate: 0.95,
        latencyMs: { p50: 100, p95: 200, p99: 400, max: 800 },
      }),
    ).toBe("degraded");
  });
});
