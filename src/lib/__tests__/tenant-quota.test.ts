/**
 * Tests for src/lib/tenant-quota.ts — Cook 118.
 */

import { describe, it, expect } from "vitest";
import { checkQuota, type QuotaPlan } from "../tenant-quota";

const PLAN: QuotaPlan = {
  planId: "node",
  runsPerMinute: 60,
  runsPerDay: 1000,
  runsPerMonth: 20_000,
};

const NOW = Date.parse("2026-05-15T12:30:45Z");

describe("checkQuota — allowed", () => {
  it("allows when every bucket has headroom", () => {
    // minute 10/60=16.7%, day 100/1000=10%, month 500/20000=2.5%
    // → minute is the hottest bucket.
    const d = checkQuota(
      PLAN,
      { minuteCount: 10, dayCount: 100, monthCount: 500 },
      NOW,
    );
    expect(d.allowed).toBe(true);
    expect(d.hotBucket).toBe("minute");
  });

  it("returns pressure proportional to the most-constrained bucket", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 59, dayCount: 10, monthCount: 10 },
      NOW,
    );
    expect(d.allowed).toBe(true);
    expect(d.hotBucket).toBe("minute");
    expect(d.pressure).toBeGreaterThan(0.99);
  });
});

describe("checkQuota — denied", () => {
  it("denies on minute-limit", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 60, dayCount: 10, monthCount: 10 },
      NOW,
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("minute-limit");
  });

  it("denies on day-limit", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 0, dayCount: 1000, monthCount: 10 },
      NOW,
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("day-limit");
  });

  it("denies on month-limit", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 0, dayCount: 0, monthCount: 20_000 },
      NOW,
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("month-limit");
  });
});

describe("checkQuota — reset times", () => {
  it("minute resetInMs ≤ 60_000", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 60, dayCount: 0, monthCount: 0 },
      NOW,
    );
    expect(d.resetInMs).toBeGreaterThan(0);
    expect(d.resetInMs).toBeLessThanOrEqual(60_000);
  });

  it("day resetInMs ≤ 24h", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 0, dayCount: 1000, monthCount: 10 },
      NOW,
    );
    expect(d.resetInMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("month resetInMs ≤ 31 days", () => {
    const d = checkQuota(
      PLAN,
      { minuteCount: 0, dayCount: 0, monthCount: 20_000 },
      NOW,
    );
    expect(d.resetInMs).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000);
  });
});
