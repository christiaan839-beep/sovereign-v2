/**
 * Tests for creator-earnings — 70/30 split math + no-DB graceful path.
 *
 * Split math is pure and deterministic; exhaustive tests.
 * DB paths are integration-tested against a real Neon branch (scope
 * outside unit tests).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CREATOR_SHARE,
  creditEarning,
  earningsByAgentForCreator,
  splitEarnings,
  summarizeForCreator,
} from "../creator-earnings";

describe("splitEarnings() — the 70/30 rule", () => {
  it("gives the creator 70% on clean divisible amounts", () => {
    expect(splitEarnings(100)).toEqual({ creatorCents: 70, platformCents: 30 });
    expect(splitEarnings(1_000)).toEqual({
      creatorCents: 700,
      platformCents: 300,
    });
    expect(splitEarnings(10_000)).toEqual({
      creatorCents: 7_000,
      platformCents: 3_000,
    });
  });

  it("floors the creator share, so rounding favors the creator on odd cents", () => {
    // 5¢ gross → creator gets 3¢ (floor(3.5)=3), platform gets 2¢
    expect(splitEarnings(5)).toEqual({ creatorCents: 3, platformCents: 2 });
    // 7¢ → 4¢ / 3¢
    expect(splitEarnings(7)).toEqual({ creatorCents: 4, platformCents: 3 });
    // 99¢ → 69¢ / 30¢
    expect(splitEarnings(99)).toEqual({ creatorCents: 69, platformCents: 30 });
  });

  it("returns 0/0 for zero gross", () => {
    expect(splitEarnings(0)).toEqual({ creatorCents: 0, platformCents: 0 });
  });

  it("returns 0/0 for negative gross (defensive — never pay negative money)", () => {
    expect(splitEarnings(-5)).toEqual({ creatorCents: 0, platformCents: 0 });
  });

  it("returns 0/0 for non-finite input (NaN / Infinity)", () => {
    expect(splitEarnings(Number.NaN)).toEqual({
      creatorCents: 0,
      platformCents: 0,
    });
    expect(splitEarnings(Number.POSITIVE_INFINITY)).toEqual({
      creatorCents: 0,
      platformCents: 0,
    });
  });

  it("floors fractional input (never pay fractional cents)", () => {
    expect(splitEarnings(10.9)).toEqual({ creatorCents: 7, platformCents: 3 });
  });

  it("total always equals gross (invariant)", () => {
    for (const gross of [0, 1, 5, 7, 42, 99, 100, 1234, 99_999]) {
      const s = splitEarnings(gross);
      expect(s.creatorCents + s.platformCents).toBe(gross);
    }
  });

  it("exports the share constant for display purposes", () => {
    expect(CREATOR_SHARE).toBe(0.7);
  });
});

describe("creator-earnings DB functions — no-DB path", () => {
  const ORIGINAL = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  describe("creditEarning()", () => {
    it("returns false without a DB", async () => {
      const ok = await creditEarning({
        agentId: "00000000-0000-0000-0000-000000000000",
        creatorEmail: "a@b.com",
        grossCents: 100,
      });
      expect(ok).toBe(false);
    });

    it("returns false for empty agentId or email", async () => {
      expect(
        await creditEarning({
          agentId: "",
          creatorEmail: "a@b.com",
          grossCents: 100,
        }),
      ).toBe(false);
      expect(
        await creditEarning({
          agentId: "u",
          creatorEmail: "",
          grossCents: 100,
        }),
      ).toBe(false);
    });
  });

  describe("summarizeForCreator()", () => {
    it("returns a zeroed summary without a DB", async () => {
      const s = await summarizeForCreator("a@b.com");
      expect(s.lifetimeGrossCents).toBe(0);
      expect(s.lifetimeCreatorCents).toBe(0);
      expect(s.thirtyDayCreatorCents).toBe(0);
      expect(s.paidCreatorCents).toBe(0);
      expect(s.pendingCreatorCents).toBe(0);
      expect(s.invocations).toBe(0);
    });

    it("returns empty for empty email", async () => {
      const s = await summarizeForCreator("");
      expect(s.invocations).toBe(0);
    });
  });

  describe("earningsByAgentForCreator()", () => {
    it("returns [] without a DB", async () => {
      expect(await earningsByAgentForCreator("a@b.com")).toEqual([]);
    });
    it("accepts a custom window without throwing", async () => {
      await expect(
        earningsByAgentForCreator("a@b.com", 90),
      ).resolves.toEqual([]);
    });
  });
});
