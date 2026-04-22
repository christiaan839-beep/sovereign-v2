/**
 * Tests for marketplace-query — graceful no-DB path.
 *
 * The DB-connected paths are covered by integration tests that run
 * against a local Neon branch (out of scope for unit tests). Here we
 * verify the safe-by-default behaviour: without a configured database,
 * lookups return null / [] without throwing, so unit tests and local
 * dev without Neon keep working.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fetchPublishedAgentBySlug,
  listPublishedAgents,
} from "../marketplace-query";

describe("marketplace-query (no-DB path)", () => {
  const ORIGINAL = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL;
    }
  });

  describe("fetchPublishedAgentBySlug()", () => {
    it("returns null without a DB", async () => {
      expect(await fetchPublishedAgentBySlug("extract-invoice")).toBeNull();
    });

    it("returns null for empty slug regardless of DB status", async () => {
      process.env.DATABASE_URL = "postgres://unused";
      expect(await fetchPublishedAgentBySlug("")).toBeNull();
    });

    it("does not throw on weird inputs", async () => {
      await expect(fetchPublishedAgentBySlug("")).resolves.toBeNull();
      await expect(fetchPublishedAgentBySlug("a")).resolves.toBeNull();
    });
  });

  describe("listPublishedAgents()", () => {
    it("returns [] without a DB", async () => {
      const list = await listPublishedAgents();
      expect(list).toEqual([]);
    });

    it("accepts a custom limit without throwing", async () => {
      await expect(listPublishedAgents(1)).resolves.toEqual([]);
      await expect(listPublishedAgents(500)).resolves.toEqual([]);
    });
  });
});
