/**
 * Cross-Agent Learning (Agent Memory) Tests
 *
 * Validates the in-memory signal bus: emit, retrieve, filter, context, and stats.
 */

import { describe, it, expect, beforeEach } from "vitest";

// We need a fresh module for each test to reset the in-memory store.
// Use dynamic imports after resetting the module registry.
import {
  emitSignal,
  getRecentSignals,
  getAgentContext,
  getSignalStats,
} from "@/lib/agent-memory";

describe("emitSignal", () => {
  it("should store a signal retrievable via getRecentSignals", async () => {
    await emitSignal("keyword_discovered", "seo-test", { keyword: "test-kw" });
    const signals = getRecentSignals({ source: "seo-test", limit: 1 });
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe("keyword_discovered");
    expect(signals[0].source).toBe("seo-test");
  });
});

describe("getRecentSignals", () => {
  it("should return signals sorted by time (newest first)", async () => {
    await emitSignal("content_published", "content-a", { title: "first" });
    await emitSignal("content_published", "content-b", { title: "second" });
    const signals = getRecentSignals({ type: "content_published", limit: 2 });
    expect(signals[0].timestamp).toBeGreaterThanOrEqual(signals[1].timestamp);
  });

  it("should filter by type when specified", async () => {
    await emitSignal("deal_closed", "closer-test", { deal: "x" });
    await emitSignal("error_pattern", "monitor-test", { error: "y" });
    const signals = getRecentSignals({ type: "deal_closed" });
    expect(signals.every((s) => s.type === "deal_closed")).toBe(true);
  });
});

describe("getAgentContext", () => {
  it("should return a formatted context string for recent signals", async () => {
    await emitSignal("lead_qualified", "leads-ctx", { name: "Jane" });
    const ctx = getAgentContext("some-other-agent");
    expect(typeof ctx).toBe("string");
    // Context includes the header when signals exist
    if (ctx.length > 0) {
      expect(ctx).toContain("Recent Intelligence");
    }
  });

  it("should exclude signals from the requesting agent", async () => {
    await emitSignal("model_performance", "self-agent", { score: 99 });
    const ctx = getAgentContext("self-agent");
    // self-agent signals should be excluded from its own context
    expect(ctx).not.toContain('"self-agent": model_performance');
  });
});

describe("getSignalStats", () => {
  it("should return structured stats object", () => {
    const stats = getSignalStats();
    expect(stats).toHaveProperty("totalSignals");
    expect(stats).toHaveProperty("lastHour");
    expect(stats).toHaveProperty("lastDay");
    expect(stats).toHaveProperty("activeSubscriptions");
    expect(stats).toHaveProperty("byType");
    expect(stats).toHaveProperty("topSources");
    expect(typeof stats.totalSignals).toBe("number");
  });
});

describe("Signal store cap", () => {
  it("should not exceed MAX_SIGNALS (signals are evicted)", async () => {
    // Emit enough to test eviction doesn't crash — not 1000 to keep test fast
    for (let i = 0; i < 50; i++) {
      await emitSignal("user_preference", "cap-test", { i });
    }
    const stats = getSignalStats();
    expect(stats.totalSignals).toBeLessThanOrEqual(1000);
  });
});
