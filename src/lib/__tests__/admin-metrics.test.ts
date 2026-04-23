/**
 * Tests for admin-metrics — graceful no-DB returns zeroed aggregates.
 *
 * Query correctness is integration-tested against a seeded Neon branch.
 * Here we verify the safe-defaults contract the page renders against.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminMetrics } from "../admin-metrics";

describe("getAdminMetrics() — no-DB path", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("returns a fully-populated empty shape without a DB", async () => {
    const m = await getAdminMetrics();
    // Submissions: all counters zero, policies empty.
    expect(m.submissions.last24h).toBe(0);
    expect(m.submissions.last7d).toBe(0);
    expect(m.submissions.last30d).toBe(0);
    expect(m.submissions.pending).toBe(0);
    expect(m.submissions.verified).toBe(0);
    expect(m.submissions.rejected).toBe(0);
    expect(m.submissions.total).toBe(0);

    // Arrays exist (so the page can map() without guards).
    expect(m.policies).toEqual([]);
    expect(m.topAgents).toEqual([]);

    // Earnings aggregate zeroed.
    expect(m.earnings.lifetimeGrossCents).toBe(0);
    expect(m.earnings.lifetimePendingCents).toBe(0);
    expect(m.earnings.lifetimePaidCents).toBe(0);
    expect(m.earnings.last30dGrossCents).toBe(0);
    expect(m.earnings.uniqueCreators).toBe(0);

    // Timestamp is set — the page displays it in the header.
    expect(typeof m.generatedAt).toBe("string");
    expect(new Date(m.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("does not throw under any of the parallel queries failing", async () => {
    // Graceful no-DB means all four queries error-handle internally.
    // This test asserts we get a result at all.
    await expect(getAdminMetrics()).resolves.toBeDefined();
  });

  it("generatedAt is a valid ISO string", async () => {
    const m = await getAdminMetrics();
    expect(m.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
