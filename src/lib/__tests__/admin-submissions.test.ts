/**
 * Tests for admin-submissions — graceful no-DB path.
 *
 * DB-connected paths (actual approve/reject round-trips) are covered
 * by an integration test suite against a local Neon branch; here we
 * verify the no-DB degradation contract that the API routes and the
 * admin UI rely on.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveSamSubmission,
  getSamSubmission,
  listSamSubmissions,
  rejectSamSubmission,
} from "../admin-submissions";

describe("admin-submissions (no-DB path)", () => {
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

  describe("listSamSubmissions()", () => {
    it("returns [] without a DB", async () => {
      const rows = await listSamSubmissions();
      expect(rows).toEqual([]);
    });

    it("accepts valid status filters without throwing", async () => {
      await expect(listSamSubmissions({ status: "pending" })).resolves.toEqual([]);
      await expect(listSamSubmissions({ status: "verified" })).resolves.toEqual([]);
      await expect(listSamSubmissions({ status: "rejected" })).resolves.toEqual([]);
      await expect(listSamSubmissions({ status: "all" })).resolves.toEqual([]);
    });

    it("clamps large limit values (to prevent pathological queries)", async () => {
      // No DB so we just check it doesn't throw; real clamping is
      // covered by the integration test.
      await expect(listSamSubmissions({ limit: 99999 })).resolves.toEqual([]);
    });
  });

  describe("getSamSubmission()", () => {
    it("returns null without a DB", async () => {
      expect(await getSamSubmission("some-uuid")).toBeNull();
    });

    it("returns null for empty id regardless of DB state", async () => {
      process.env.DATABASE_URL = "postgres://unused";
      expect(await getSamSubmission("")).toBeNull();
    });
  });

  describe("approveSamSubmission()", () => {
    it("returns ok:false / db_unavailable without a DB", async () => {
      const r = await approveSamSubmission("some-uuid", "admin-user");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("db_unavailable");
    });
  });

  describe("rejectSamSubmission()", () => {
    it("throws when reason is empty (programmer error)", async () => {
      await expect(
        rejectSamSubmission("some-uuid", "admin-user", ""),
      ).rejects.toThrow(/reason is required/);
    });

    it("throws when reason is only whitespace", async () => {
      await expect(
        rejectSamSubmission("some-uuid", "admin-user", "   \n\t  "),
      ).rejects.toThrow(/reason is required/);
    });

    it("returns ok:false / db_unavailable when reason is valid but DB is missing", async () => {
      const r = await rejectSamSubmission("some-uuid", "admin-user", "Not SAM-compliant");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("db_unavailable");
    });
  });
});
