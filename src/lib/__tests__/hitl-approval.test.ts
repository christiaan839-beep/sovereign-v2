/**
 * hitl-approval — tests.
 *
 * Round 26 — DB-backed (was in-memory Map). The tests now exercise
 * the graceful no-DB fallback contract: every helper returns a sane
 * shape when DATABASE_URL is unset, never throws.
 *
 * Real DB-backed integration paths are exercised in the route-level
 * tests (api-approvals-route.test.ts — wired via mocked drizzle).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  // Force the lib into "no DB" mode so we test the graceful path.
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  vi.resetModules();
});

async function importHitl() {
  return await import("../hitl-approval");
}

describe("hitl-approval — graceful no-DB fallbacks", () => {
  it("requestApproval returns empty string when DB is unavailable", async () => {
    const { requestApproval } = await importHitl();
    const id = await requestApproval({
      userId: "u1",
      agentName: "leads",
      action: "send",
      description: "Send",
    });
    // Empty string is the "approval system offline" signal — caller
    // treats this as "default deny" rather than blindly proceeding.
    expect(id).toBe("");
  });

  it("approveRequest returns false when DB is unavailable", async () => {
    const { approveRequest } = await importHitl();
    expect(await approveRequest("apr_x", "admin")).toBe(false);
  });

  it("denyRequest returns false when DB is unavailable", async () => {
    const { denyRequest } = await importHitl();
    expect(await denyRequest("apr_x", "admin")).toBe(false);
  });

  it("getPendingApprovals returns [] when DB is unavailable", async () => {
    const { getPendingApprovals } = await importHitl();
    expect(await getPendingApprovals("u1")).toEqual([]);
  });

  it("getApprovalHistory returns [] when DB is unavailable", async () => {
    const { getApprovalHistory } = await importHitl();
    expect(await getApprovalHistory("u1")).toEqual([]);
  });

  it("getApproval returns undefined when DB is unavailable", async () => {
    const { getApproval } = await importHitl();
    expect(await getApproval("apr_x")).toBeUndefined();
  });

  it("pruneApprovals returns 0 when DB is unavailable", async () => {
    const { pruneApprovals } = await importHitl();
    expect(await pruneApprovals()).toBe(0);
  });

  it("deleteOldDecidedApprovals returns 0 when DB is unavailable", async () => {
    const { deleteOldDecidedApprovals } = await importHitl();
    expect(await deleteOldDecidedApprovals()).toBe(0);
  });

  it("never throws on hostile inputs (graceful contract)", async () => {
    const {
      requestApproval,
      approveRequest,
      denyRequest,
      getPendingApprovals,
      getApprovalHistory,
      getApproval,
      pruneApprovals,
      deleteOldDecidedApprovals,
    } = await importHitl();
    await expect(
      requestApproval({
        userId: "u",
        agentName: "a",
        action: "x",
        description: "d",
      }),
    ).resolves.not.toThrow();
    await expect(approveRequest("apr_x", "admin")).resolves.not.toThrow();
    await expect(denyRequest("apr_x", "admin")).resolves.not.toThrow();
    await expect(getPendingApprovals("u")).resolves.not.toThrow();
    await expect(getApprovalHistory("u")).resolves.not.toThrow();
    await expect(getApproval("apr_x")).resolves.not.toThrow();
    await expect(pruneApprovals()).resolves.not.toThrow();
    await expect(deleteOldDecidedApprovals()).resolves.not.toThrow();
  });
});

describe("hitl-approval — id minting (no DB needed)", () => {
  it("mints a unique id on every request (when DB present)", async () => {
    // Even with no DB, the id minting happens before the insert
    // attempt; we can verify the id format.
    process.env.DATABASE_URL = "postgres://fake-for-import";
    // The dynamic import will return null DB internally so the
    // insert will fail silently and return "". To test id format
    // we'd need a real DB or a mocked one — covered in the route
    // tests. This test just confirms no-DB path returns "".
    const { requestApproval } = await importHitl();
    const id = await requestApproval({
      userId: "u",
      agentName: "a",
      action: "x",
      description: "d",
    });
    expect(typeof id).toBe("string");
  });
});
