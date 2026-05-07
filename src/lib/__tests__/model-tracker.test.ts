/**
 * Tests for src/lib/model-tracker.ts — Model Performance Tracker
 */
import { describe, it, expect } from "vitest";
import {
  recordModelExecution,
  getModelPerformance,
  getBestModelFor,
  getAllModelPerformance,
} from "@/lib/model-tracker";

describe("model-tracker.ts", () => {
  const MODEL_A = "test/model-a";
  const MODEL_B = "test/model-b";

  // ── Recording ──

  it("returns null for unknown models", () => {
    expect(getModelPerformance("unknown/model-xyz")).toBeNull();
  });

  it("records executions and computes stats", () => {
    for (let i = 0; i < 10; i++) {
      recordModelExecution(MODEL_A, { latencyMs: 1000, success: true, quality: 0.8 });
    }
    const stats = getModelPerformance(MODEL_A);
    expect(stats).toBeTruthy();
    expect(stats!.executions).toBe(10);
    expect(stats!.avgLatencyMs).toBe(1000);
    expect(stats!.successRate).toBe(1);
    expect(stats!.avgQuality).toBe(0.8);
    expect(stats!.compositeScore).toBeGreaterThan(0.5);
  });

  it("tracks success rate correctly", () => {
    for (let i = 0; i < 8; i++) {
      recordModelExecution(MODEL_B, { latencyMs: 500, success: true });
    }
    for (let i = 0; i < 2; i++) {
      recordModelExecution(MODEL_B, { latencyMs: 500, success: false });
    }
    const stats = getModelPerformance(MODEL_B);
    expect(stats!.successRate).toBe(0.8);
  });

  it("handles null quality scores", () => {
    recordModelExecution("test/no-quality", { latencyMs: 1000, success: true });
    const stats = getModelPerformance("test/no-quality");
    expect(stats!.avgQuality).toBeNull();
  });

  // ── Task Affinity ──

  it("returns null for task with insufficient data", () => {
    expect(getBestModelFor("unknown-task")).toBeNull();
  });

  // ── getAllModelPerformance ──

  it("returns sorted list of all tracked models", () => {
    const all = getAllModelPerformance();
    expect(Array.isArray(all)).toBe(true);
    // Should be sorted by compositeScore descending
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].compositeScore).toBeGreaterThanOrEqual(all[i].compositeScore);
    }
  });

  // ── Composite Score ──

  it("faster models get higher speed component", () => {
    recordModelExecution("test/fast", { latencyMs: 200, success: true, quality: 0.7 });
    recordModelExecution("test/fast", { latencyMs: 200, success: true, quality: 0.7 });
    recordModelExecution("test/fast", { latencyMs: 200, success: true, quality: 0.7 });
    recordModelExecution("test/fast", { latencyMs: 200, success: true, quality: 0.7 });
    recordModelExecution("test/fast", { latencyMs: 200, success: true, quality: 0.7 });

    recordModelExecution("test/slow", { latencyMs: 8000, success: true, quality: 0.7 });
    recordModelExecution("test/slow", { latencyMs: 8000, success: true, quality: 0.7 });
    recordModelExecution("test/slow", { latencyMs: 8000, success: true, quality: 0.7 });
    recordModelExecution("test/slow", { latencyMs: 8000, success: true, quality: 0.7 });
    recordModelExecution("test/slow", { latencyMs: 8000, success: true, quality: 0.7 });

    const fast = getModelPerformance("test/fast")!;
    const slow = getModelPerformance("test/slow")!;
    expect(fast.compositeScore).toBeGreaterThan(slow.compositeScore);
  });
});
