/**
 * customer-stats-anonymizer — tests.
 *
 * Verifies:
 *   - bucketCount: suppression below threshold, correct bucket selection,
 *     boundary edges, "X+" label above the largest bucket.
 *   - publishStats: end-to-end raw → published shape.
 *   - Privacy invariant: at sub-threshold raw counts, the published
 *     bucket NEVER contains the raw number as a substring (a UI that
 *     parsed "5" out of "under 1,000" couldn't reverse-engineer a
 *     per-tenant volume — neither can a competitor).
 */

import { describe, it, expect } from "vitest";
import {
  bucketCount,
  publishStats,
  PUBLISHED_STATS_CONFIG,
  type RawPlatformStats,
} from "../customer-stats-anonymizer";

describe("customer-stats-anonymizer — bucketCount", () => {
  const cfg = {
    suppressionThreshold: 1_000,
    bucketBounds: [5_000, 25_000, 100_000, 1_000_000],
  };

  it("suppresses counts below threshold", () => {
    expect(bucketCount(0, cfg)).toBe("under 1,000");
    expect(bucketCount(500, cfg)).toBe("under 1,000");
    expect(bucketCount(999, cfg)).toBe("under 1,000");
  });

  it("picks the correct bucket above threshold", () => {
    expect(bucketCount(1_000, cfg)).toBe("1,000–5,000");
    expect(bucketCount(4_999, cfg)).toBe("1,000–5,000");
    expect(bucketCount(5_000, cfg)).toBe("5,000–25,000");
    expect(bucketCount(24_999, cfg)).toBe("5,000–25,000");
    expect(bucketCount(25_000, cfg)).toBe("25,000–100,000");
    expect(bucketCount(99_999, cfg)).toBe("25,000–100,000");
    expect(bucketCount(100_000, cfg)).toBe("100,000–1,000,000");
  });

  it("emits Nk+ label above the largest bucket", () => {
    expect(bucketCount(1_000_000, cfg)).toBe("1,000,000+");
    expect(bucketCount(999_999_999, cfg)).toBe("1,000,000+");
  });
});

describe("customer-stats-anonymizer — publishStats", () => {
  const baseRaw: RawPlatformStats = {
    totalRuns: 12_345,
    totalSuccesses: 11_500,
    distinctUsers: 87,
    distinctAgents: 42,
    avgDurationMs: 2_345,
    windowDays: 14,
  };

  it("produces a shape with all expected fields", () => {
    const out = publishStats(baseRaw);
    expect(out).toHaveProperty("headline");
    expect(out).toHaveProperty("successRatePct");
    expect(out).toHaveProperty("runVolumeBucket");
    expect(out).toHaveProperty("userVolumeBucket");
    expect(out).toHaveProperty("avgLatencySec");
    expect(out).toHaveProperty("distinctAgents");
    expect(out).toHaveProperty("windowDays");
  });

  it("computes success rate to 1 decimal", () => {
    const out = publishStats(baseRaw);
    // 11500/12345 = 0.93154..., × 100 = 93.154 → 93.2
    expect(out.successRatePct).toBe(93.2);
  });

  it("converts ms latency to seconds with 1 decimal", () => {
    const out = publishStats(baseRaw);
    // 2345ms = 2.345s → 2.3
    expect(out.avgLatencySec).toBe(2.3);
  });

  it("returns null successRate when no runs (no division by zero)", () => {
    const out = publishStats({ ...baseRaw, totalRuns: 0, totalSuccesses: 0 });
    expect(out.successRatePct).toBeNull();
  });

  it("returns null avgLatency when raw is null", () => {
    const out = publishStats({ ...baseRaw, avgDurationMs: null });
    expect(out.avgLatencySec).toBeNull();
  });

  it("PRIVACY: sub-threshold user counts NEVER expose the raw number", () => {
    const raw: RawPlatformStats = {
      ...baseRaw,
      distinctUsers: 7, // below the 25-user suppression threshold
    };
    const out = publishStats(raw);
    expect(out.userVolumeBucket).not.toContain("7");
    expect(out.userVolumeBucket).toBe("under 25");
  });

  it("PRIVACY: sub-threshold run counts NEVER expose the raw number", () => {
    const raw: RawPlatformStats = {
      ...baseRaw,
      totalRuns: 234,
      totalSuccesses: 200,
    };
    const out = publishStats(raw);
    expect(out.runVolumeBucket).not.toContain("234");
    expect(out.runVolumeBucket).toBe("under 1,000");
  });

  it("distinctAgents is reported exactly (agents are public)", () => {
    const out = publishStats(baseRaw);
    expect(out.distinctAgents).toBe(42);
  });
});

describe("customer-stats-anonymizer — config integrity", () => {
  it("RUN_BUCKETS is sorted ascending (bucket selection depends on order)", () => {
    const buckets = [...PUBLISHED_STATS_CONFIG.RUN_BUCKETS];
    const sorted = [...buckets].sort((a, b) => a - b);
    expect(buckets).toEqual(sorted);
  });

  it("USER_BUCKETS is sorted ascending", () => {
    const buckets = [...PUBLISHED_STATS_CONFIG.USER_BUCKETS];
    const sorted = [...buckets].sort((a, b) => a - b);
    expect(buckets).toEqual(sorted);
  });

  it("suppression thresholds are below the smallest bucket", () => {
    expect(PUBLISHED_STATS_CONFIG.RUN_SUPPRESSION_THRESHOLD).toBeLessThan(
      PUBLISHED_STATS_CONFIG.RUN_BUCKETS[0],
    );
    expect(PUBLISHED_STATS_CONFIG.USER_SUPPRESSION_THRESHOLD).toBeLessThan(
      PUBLISHED_STATS_CONFIG.USER_BUCKETS[0],
    );
  });
});
