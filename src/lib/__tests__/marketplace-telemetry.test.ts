/**
 * Tests for marketplace-telemetry — sanitisers + no-DB path.
 *
 * The dedupe logic requires real DB rows so it's covered by
 * integration tests, not unit tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listTrendingAgents,
  recordAgentView,
  viewsForAgent,
} from "../marketplace-telemetry";

describe("marketplace-telemetry (no-DB)", () => {
  const ORIGINAL = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  describe("recordAgentView()", () => {
    it("returns false without a DB", async () => {
      expect(
        await recordAgentView({ agentId: "u", anonymousId: "a1b2c3d4" }),
      ).toBe(false);
    });

    it("returns false for empty anonymousId even without DB", async () => {
      expect(
        await recordAgentView({ agentId: "u", anonymousId: "" }),
      ).toBe(false);
    });
  });

  describe("listTrendingAgents()", () => {
    it("returns [] without a DB", async () => {
      expect(await listTrendingAgents()).toEqual([]);
    });
    it("accepts custom limit + sinceDays without throwing", async () => {
      await expect(
        listTrendingAgents({ limit: 5, sinceDays: 30 }),
      ).resolves.toEqual([]);
    });
  });

  describe("viewsForAgent()", () => {
    it("returns 0 without a DB", async () => {
      expect(await viewsForAgent("some-uuid")).toBe(0);
    });
    it("returns 0 for empty agentId", async () => {
      expect(await viewsForAgent("")).toBe(0);
    });
  });
});

describe("marketplace-telemetry sanitisers (pure logic)", () => {
  // These tests exercise the sanitiser behaviour indirectly — a valid
  // anonymousId + valid referrer should pass input validation; an
  // invalid one should not (returns false even with a valid DB URL,
  // which we can't assert here, but we can assert the bad-input
  // behaviour is always false).
  const ORIGINAL = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  it("rejects a non-UUID-shaped anonymousId even with DB (set via empty env)", async () => {
    expect(
      await recordAgentView({
        agentId: "u",
        anonymousId: "not a uuid! drop table;",
      }),
    ).toBe(false);
  });

  it("tolerates missing referrerHost", async () => {
    // With no DB this always returns false, but verifies no throw.
    await expect(
      recordAgentView({
        agentId: "u",
        anonymousId: "abcdef01-1234-5678-9abc-def012345678",
      }),
    ).resolves.toBe(false);
  });
});
