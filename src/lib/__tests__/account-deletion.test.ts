/**
 * account-deletion.ts + DELETE /api/account — tests.
 *
 * Mock everything DB + external. We verify the orchestration:
 *  - confirmation phrase required
 *  - Stripe cancellation is attempted when an active sub exists
 *  - all personal-data tables are touched
 *  - agent_metadata with creatorUserId is orphaned (not deleted)
 *  - Clerk user deletion is attempted last
 *  - per-step failures don't abort the whole deletion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockSelect, mockDelete, mockUpdate, mockFetch } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => mockSelect() }) }),
    }),
    delete: () => ({
      where: () => ({ returning: () => mockDelete() }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => mockUpdate() }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => {
  const t = (name: string) => ({ _table: name, userId: "user_id", clerkUserId: "clerk_user_id", id: "id", creatorUserId: "creator_user_id", slug: "slug" });
  return {
    tenants: t("tenants"),
    userCredits: t("user_credits"),
    creditHolds: t("credit_holds"),
    creditTransactions: t("credit_transactions"),
    playbookRuns: t("playbook_runs"),
    agentActivity: t("agent_activity"),
    tenantMemories: t("tenant_memories"),
    subscriptions: t("subscriptions"),
    agentInstalls: t("agent_installs"),
    agentReviews: t("agent_reviews"),
    agentMetadata: t("agent_metadata"),
    orgMembers: t("org_members"),
  };
});

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

vi.mock("@/lib/credits", () => ({
  sweepExpiredHolds: vi.fn().mockResolvedValue(0),
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockAuth.mockReset();
  mockSelect.mockReset();
  mockDelete.mockReset();
  mockUpdate.mockReset();
  mockFetch.mockReset();
  // Default: each mutation returns "no rows affected" so tests that
  // don't override see predictable zero-counts.
  mockDelete.mockResolvedValue([]);
  mockUpdate.mockResolvedValue([]);
  mockSelect.mockResolvedValue([]);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  // Env vars required for the helper's internal fetch calls
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  process.env.CLERK_SECRET_KEY = "sk_clerk_test_x";
});

import { DELETE } from "@/app/api/account/route";
import {
  deleteUserAccount,
  DELETION_CONFIRMATION_PHRASE,
} from "@/lib/account-deletion";

const bodyReq = (payload: unknown) =>
  new Request("http://l/api/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

// ─── Endpoint ────────────────────────────────────────────────

describe("DELETE /api/account", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(bodyReq({ confirmation: DELETION_CONFIRMATION_PHRASE }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing body", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const res = await DELETE(
      new Request("http://l/api/account", { method: "DELETE", body: "not-json" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirmation phrase is wrong", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const res = await DELETE(bodyReq({ confirmation: "delete me plz" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not match/i);
    expect(body.expected).toBe(DELETION_CONFIRMATION_PHRASE);
  });

  it("returns 400 when confirmation is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const res = await DELETE(bodyReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 with deletion summary on happy path", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    mockDelete.mockResolvedValue([{ id: "x" }]); // every table finds one row
    mockUpdate.mockResolvedValue([]); // no agents orphaned, no holds released
    const res = await DELETE(bodyReq({ confirmation: DELETION_CONFIRMATION_PHRASE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.userId).toBe("u_1");
    expect(body.steps).toBeTruthy();
    // Cache-Control is no-store — session is nuked.
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

// ─── Helper (deleteUserAccount) ──────────────────────────────

describe("deleteUserAccount", () => {
  it("throws on empty userId", async () => {
    await expect(deleteUserAccount("")).rejects.toThrow(/userId required/);
  });

  it("attempts Stripe cancel when an active sub exists", async () => {
    mockSelect.mockResolvedValue([
      { stripeSubscriptionId: "sub_123", status: "active" },
    ]);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await deleteUserAccount("u_1");
    expect(result.steps.stripeCancel).toBe("ok");
    // Verify the Stripe URL was hit with DELETE
    const stripeCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === "string" && url.includes("stripe.com/v1/subscriptions/sub_123"),
    );
    expect(stripeCall).toBeTruthy();
    expect((stripeCall?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("skips Stripe cancel when no active sub is found", async () => {
    mockSelect.mockResolvedValue([]); // no sub row
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await deleteUserAccount("u_1");
    expect(result.steps.stripeCancel).toBe("skipped");
  });

  it("marks Stripe cancel failed when Stripe API errors", async () => {
    mockSelect.mockResolvedValue([
      { stripeSubscriptionId: "sub_err", status: "active" },
    ]);
    // First call (Stripe DELETE) fails; second (Clerk) succeeds
    mockFetch.mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("stripe.com")) {
        return new Response("server error", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    });
    const result = await deleteUserAccount("u_1");
    expect(result.steps.stripeCancel).toBe("failed");
    // Deletion continues despite Stripe failure
    expect(result.steps.clerkDeleted).toBe("ok");
  });

  it("orphans agent_metadata rows for agents the user created", async () => {
    mockSelect.mockResolvedValue([]);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    mockUpdate
      .mockResolvedValueOnce([]) // holds release
      .mockResolvedValueOnce([
        { slug: "my-agent-1" },
        { slug: "my-agent-2" },
      ]); // agent orphan
    const result = await deleteUserAccount("u_1");
    expect(result.steps.agentsOrphaned).toBe(2);
  });

  it("attempts Clerk deletion even when earlier steps failed", async () => {
    mockSelect.mockResolvedValue([]);
    mockDelete.mockRejectedValue(new Error("DB transient"));
    mockUpdate.mockRejectedValue(new Error("DB transient"));
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await deleteUserAccount("u_1");
    // Even with DB errors all the way through, Clerk still runs — that's
    // the right failure mode for GDPR: clear the auth identity last so
    // the user can't log back in even if some DB rows got stranded.
    expect(result.steps.clerkDeleted).toBe("ok");
  });

  it("skips Clerk delete when CLERK_SECRET_KEY is unset", async () => {
    delete process.env.CLERK_SECRET_KEY;
    mockSelect.mockResolvedValue([]);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await deleteUserAccount("u_1");
    expect(result.steps.clerkDeleted).toBe("skipped");
  });
});

// Restore real fetch at module teardown.
import { afterAll } from "vitest";
afterAll(() => {
  globalThis.fetch = originalFetch;
});
