/**
 * Tests for src/lib/cohort-analytics.ts — Wave 127.
 *
 * Pure-function tests on the aggregator. No DB. Pins the cohort math:
 * window filter, anon skip, percentile math, super-user threshold,
 * weekly bucket grouping, retention rate, top-N truncation.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { aggregateCohorts, isoWeek, type RunRow } from "@/lib/cohort-analytics";

function row(userId: string | null, daysAgo: number): RunRow {
  return {
    userId,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  };
}

describe("isoWeek", () => {
  it("returns a YYYY-Wnn string", () => {
    const w = isoWeek(new Date("2026-05-22T12:00:00Z"));
    expect(w).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("formats single-digit weeks with a leading zero", () => {
    const w = isoWeek(new Date("2026-01-05T12:00:00Z"));
    expect(w.split("-W")[1]).toMatch(/^\d{2}$/);
  });
});

describe("aggregateCohorts — empty + edge", () => {
  it("returns a valid empty shape on no rows", () => {
    const r = aggregateCohorts([]);
    expect(r.totalUsers).toBe(0);
    expect(r.totalRuns).toBe(0);
    expect(r.medianRunsPerUser).toBe(0);
    expect(r.p90RunsPerUser).toBe(0);
    expect(r.superUsers).toBe(0);
    expect(r.weeklyCohorts).toEqual([]);
    expect(r.topUsers).toEqual([]);
  });

  it("filters out null userIds", () => {
    const r = aggregateCohorts([row(null, 1), row(null, 2), row("u1", 1)]);
    expect(r.totalUsers).toBe(1);
    expect(r.totalRuns).toBe(1);
  });

  it("filters out anon userId", () => {
    const r = aggregateCohorts([row("anon", 1), row("u1", 1)]);
    expect(r.totalUsers).toBe(1);
  });

  it("filters out runs outside the window", () => {
    const r = aggregateCohorts(
      [
        row("u1", 1), // in window
        row("u1", 200), // outside 90d window
        row("u2", 5), // in window
      ],
      90,
    );
    expect(r.totalUsers).toBe(2);
    expect(r.totalRuns).toBe(2);
  });
});

describe("aggregateCohorts — per-user counts + percentiles", () => {
  it("counts runs per user correctly", () => {
    const rows: RunRow[] = [];
    for (let i = 0; i < 50; i++) rows.push(row("alice", i));
    for (let i = 0; i < 5; i++) rows.push(row("bob", i));
    const r = aggregateCohorts(rows);
    expect(r.totalUsers).toBe(2);
    expect(r.totalRuns).toBe(55);
    const alice = r.topUsers.find((u) => u.userId === "alice");
    expect(alice?.totalRuns).toBe(50);
  });

  it("median + p90 across users", () => {
    // 10 users with runs [1,2,3,4,5,6,7,8,9,10]
    const rows: RunRow[] = [];
    for (let i = 1; i <= 10; i++) {
      for (let j = 0; j < i; j++) rows.push(row(`u${i}`, j));
    }
    const r = aggregateCohorts(rows);
    // sorted runs = [1,2,3,4,5,6,7,8,9,10]
    // floor(0.5 * 10) = 5 → index 5 → value 6
    expect(r.medianRunsPerUser).toBe(6);
    // floor(0.9 * 10) = 9 → index 9 → value 10
    expect(r.p90RunsPerUser).toBe(10);
  });

  it("identifies super users (>= 100 runs)", () => {
    const rows: RunRow[] = [];
    for (let i = 0; i < 100; i++) rows.push(row("power-1", i % 30));
    for (let i = 0; i < 99; i++) rows.push(row("power-99", i % 30));
    for (let i = 0; i < 5; i++) rows.push(row("casual", i));
    const r = aggregateCohorts(rows);
    // power-1 has 100, power-99 has 99 (just under), casual has 5
    expect(r.superUsers).toBe(1);
  });
});

describe("aggregateCohorts — top users sort + truncate", () => {
  it("sorts topUsers by totalRuns desc", () => {
    const rows: RunRow[] = [];
    for (let i = 0; i < 30; i++) rows.push(row("medium", i));
    for (let i = 0; i < 100; i++) rows.push(row("heavy", i % 30));
    for (let i = 0; i < 5; i++) rows.push(row("light", i));
    const r = aggregateCohorts(rows);
    expect(r.topUsers[0].userId).toBe("heavy");
    expect(r.topUsers[0].totalRuns).toBe(100);
    expect(r.topUsers[1].userId).toBe("medium");
    expect(r.topUsers[2].userId).toBe("light");
  });

  it("caps topUsers at 25 entries", () => {
    const rows: RunRow[] = [];
    for (let i = 0; i < 50; i++) rows.push(row(`u${i}`, 5));
    const r = aggregateCohorts(rows);
    expect(r.topUsers.length).toBe(25);
  });
});

describe("aggregateCohorts — weekly cohorts + retention", () => {
  it("groups users by week of first run", () => {
    // 3 users started > 14 days ago, 2 users started 1 day ago
    const rows: RunRow[] = [];
    for (let i = 0; i < 3; i++) {
      rows.push(row(`old-${i}`, 21)); // 3 weeks ago
      rows.push(row(`old-${i}`, 0)); // and active now
    }
    for (let i = 0; i < 2; i++) {
      rows.push(row(`new-${i}`, 1)); // 1 day ago
    }
    const r = aggregateCohorts(rows);
    expect(r.weeklyCohorts.length).toBeGreaterThanOrEqual(2);
    // sum of newUsers across cohorts = totalUsers
    const sumNew = r.weeklyCohorts.reduce((s, c) => s + c.newUsers, 0);
    expect(sumNew).toBe(r.totalUsers);
  });

  it("computes retention as active-last-week / new-users-in-cohort", () => {
    // 3 users started 30 days ago. 2 still active in last 7 days, 1 not.
    const rows: RunRow[] = [
      row("retained-1", 30),
      row("retained-1", 1),
      row("retained-2", 30),
      row("retained-2", 1),
      row("churned", 30),
      row("churned", 15), // not in last 7 days
    ];
    const r = aggregateCohorts(rows);
    const cohort = r.weeklyCohorts[0];
    expect(cohort.newUsers).toBe(3);
    expect(cohort.activeInLastWeek).toBe(2);
    expect(cohort.retention).toBeCloseTo(2 / 3, 4);
  });

  it("zero cohort retention when no one is active", () => {
    const rows: RunRow[] = [
      row("u", 30),
      row("u", 20), // last activity 20 days ago, outside 7-day window
    ];
    const r = aggregateCohorts(rows);
    expect(r.weeklyCohorts[0].activeInLastWeek).toBe(0);
    expect(r.weeklyCohorts[0].retention).toBe(0);
  });
});
