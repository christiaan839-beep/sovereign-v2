/**
 * Tests for src/lib/cost-telemetry.ts — Cook 45.
 *
 *   - Empty events → zero-totals report.
 *   - byAgent / byModel / byTenant produce descending totals + share.
 *   - topN caps the result lists.
 *   - Window filter excludes events outside [start, end).
 *   - Anomaly flag: only events strictly above the percentile cutoff.
 *   - formatDollars helper.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateUsage,
  formatDollars,
  type UsageEvent,
} from "../cost-telemetry";

const NOW = 1_700_000_000_000;

function ev(
  agent: string,
  model: string,
  costCents: number,
  occurredAt = NOW,
  tenantId?: string,
): UsageEvent {
  return { agentSlug: agent, model, costCents, occurredAt, tenantId };
}

describe("aggregateUsage — empty", () => {
  it("returns a zero-totals report for empty events", () => {
    const r = aggregateUsage({ events: [] });
    expect(r.totalCents).toBe(0);
    expect(r.callCount).toBe(0);
    expect(r.byAgent).toEqual([]);
    expect(r.byModel).toEqual([]);
    expect(r.byTenant).toEqual([]);
  });
});

describe("aggregateUsage — grouping", () => {
  it("aggregates by agent with descending totals", () => {
    const events = [
      ev("lead-blitz", "nim", 100),
      ev("lead-blitz", "nim", 200),
      ev("content", "claude", 50),
    ];
    const r = aggregateUsage({ events });
    expect(r.byAgent.map((a) => a.key)).toEqual(["lead-blitz", "content"]);
    expect(r.byAgent[0].totalCents).toBe(300);
    expect(r.byAgent[0].callCount).toBe(2);
    expect(r.byAgent[0].avgCents).toBe(150);
    expect(r.byAgent[0].share).toBeCloseTo(300 / 350, 5);
  });

  it("aggregates by model", () => {
    const events = [
      ev("a", "claude", 100),
      ev("b", "claude", 200),
      ev("c", "nim", 50),
    ];
    const r = aggregateUsage({ events });
    expect(r.byModel.map((m) => m.key)).toEqual(["claude", "nim"]);
  });

  it("groups by tenant when present, ignores missing", () => {
    const events = [
      ev("a", "nim", 100, NOW, "t1"),
      ev("b", "nim", 50, NOW),
      ev("c", "nim", 20, NOW, "t2"),
      ev("d", "nim", 30, NOW, "t1"),
    ];
    const r = aggregateUsage({ events });
    expect(r.byTenant.map((t) => t.key)).toEqual(["t1", "t2"]);
    expect(r.byTenant[0].totalCents).toBe(130);
  });
});

describe("aggregateUsage — topN", () => {
  it("caps result lists to topN", () => {
    const events = Array.from({ length: 25 }, (_, i) =>
      ev(`agent-${i}`, "m", i + 1),
    );
    const r = aggregateUsage({ events, topN: 5 });
    expect(r.byAgent.length).toBe(5);
    // descending: the top 5 agents have the highest costs.
    expect(r.byAgent[0].key).toBe("agent-24");
  });
});

describe("aggregateUsage — windowing", () => {
  it("excludes events outside [windowStart, windowEnd)", () => {
    const events = [
      ev("a", "nim", 100, NOW - 1000),
      ev("b", "nim", 200, NOW),
      ev("c", "nim", 300, NOW + 1000),
    ];
    const r = aggregateUsage({
      events,
      windowStart: NOW,
      windowEnd: NOW + 1, // exclusive end
    });
    expect(r.callCount).toBe(1);
    expect(r.totalCents).toBe(200);
  });
});

describe("aggregateUsage — anomalies", () => {
  it("flags only events above the percentile cutoff", () => {
    const events = [
      ev("a", "nim", 10),
      ev("a", "nim", 10),
      ev("a", "nim", 10),
      ev("a", "nim", 10),
      ev("a", "nim", 1000), // outlier
    ];
    const r = aggregateUsage({ events, anomalyPercentile: 0.8 });
    expect(r.anomalies.length).toBe(1);
    expect(r.anomalies[0].costCents).toBe(1000);
  });

  it("returns no anomalies when costs are uniform", () => {
    const events = [ev("a", "nim", 10), ev("b", "nim", 10), ev("c", "nim", 10)];
    const r = aggregateUsage({ events });
    expect(r.anomalies).toEqual([]);
  });
});

describe("formatDollars", () => {
  it("renders cents as USD", () => {
    expect(formatDollars(0)).toBe("$0.00");
    expect(formatDollars(99)).toBe("$0.99");
    expect(formatDollars(12_345)).toBe("$123.45");
  });
});
