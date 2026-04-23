/**
 * Tests for agent-health — composite scoring math.
 *
 * DB queries are integration-tested against staging. Here we
 * exhaustively exercise the pure scoring function.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  composeHealthScore,
  getAgentHealth,
  getTopAgentHealth,
  scoreToGrade,
} from "../agent-health";

describe("scoreToGrade()", () => {
  it("maps score ranges to the expected letter", () => {
    expect(scoreToGrade(100)).toBe("A");
    expect(scoreToGrade(90)).toBe("A");
    expect(scoreToGrade(85)).toBe("A"); // threshold
    expect(scoreToGrade(84)).toBe("B");
    expect(scoreToGrade(75)).toBe("B");
    expect(scoreToGrade(70)).toBe("B"); // threshold
    expect(scoreToGrade(69)).toBe("C");
    expect(scoreToGrade(55)).toBe("C"); // threshold
    expect(scoreToGrade(54)).toBe("D");
    expect(scoreToGrade(40)).toBe("D"); // threshold
    expect(scoreToGrade(39)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });
});

describe("composeHealthScore() — safety as a floor", () => {
  it("returns F when safety score is below 40, regardless of other signals", () => {
    const r = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 100,
      safetyScore: 39,
      sampleSize: 10000,
    });
    expect(r.grade).toBe("F");
    expect(r.score).toBe(0);
  });

  it("allows an A when safety is at or above the floor", () => {
    const r = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 100,
      safetyScore: 95,
      sampleSize: 10000,
    });
    expect(r.grade).toBe("A");
    expect(r.score).toBeGreaterThanOrEqual(85);
  });
});

describe("composeHealthScore() — volume regression toward B", () => {
  it("pulls brand-new (sample=0) agents toward 65", () => {
    const r = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 0,
      safetyScore: 100,
      sampleSize: 0,
    });
    // At sampleSize=0, confidence is 0; result = 65 exactly
    expect(r.score).toBe(65);
    expect(r.grade).toBe("C");
  });

  it("lets high-volume agents fully realise their raw score", () => {
    const r = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 0,
      safetyScore: 100,
      sampleSize: 10_000,
    });
    // confidence ≈ 0.997; blended ≈ raw
    expect(r.score).toBeGreaterThanOrEqual(88);
    expect(r.grade).toBe("A");
  });

  it("gradually moves from C toward the raw score as sample size grows", () => {
    const params = {
      successRate: 0.9,
      p50LatencyMs: 2000,
      safetyScore: 80,
    };
    const a0 = composeHealthScore({ ...params, sampleSize: 0 }).score;
    const a30 = composeHealthScore({ ...params, sampleSize: 30 }).score;
    const a300 = composeHealthScore({ ...params, sampleSize: 300 }).score;
    // Score should monotonically approach the raw value as volume grows.
    expect(a30).toBeGreaterThan(a0);
    expect(a300).toBeGreaterThan(a30);
  });
});

describe("composeHealthScore() — latency contribution", () => {
  it("gives full latency credit at or below the baseline", () => {
    const r = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 1000,
      safetyScore: 100,
      sampleSize: 10_000,
      categoryLatencyBaselineMs: 5000,
    });
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it("penalises latency 3× over baseline down toward zero", () => {
    const slow = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 15_000, // 3× baseline
      safetyScore: 100,
      sampleSize: 10_000,
      categoryLatencyBaselineMs: 5000,
    });
    const fast = composeHealthScore({
      successRate: 1.0,
      p50LatencyMs: 500,
      safetyScore: 100,
      sampleSize: 10_000,
      categoryLatencyBaselineMs: 5000,
    });
    expect(fast.score).toBeGreaterThan(slow.score);
  });
});

describe("getTopAgentHealth() / getAgentHealth() — no-DB path", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("returns [] for the top list without a DB", async () => {
    const r = await getTopAgentHealth();
    expect(r).toEqual([]);
  });

  it("returns null for a single agent without a DB", async () => {
    const r = await getAgentHealth("some-uuid");
    expect(r).toBeNull();
  });
});
