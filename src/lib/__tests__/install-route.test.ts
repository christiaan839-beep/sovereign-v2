/**
 * POST/DELETE /api/catalog/[slug]/install — install/uninstall tests.
 *
 * Install is idempotent via the unique index on (user_id, agent_slug).
 * Paid agents require credit balance >= pricingCents (checked upfront —
 * the actual deduction happens inside per-run credit holds, not install).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockGetAgentPublic,
  mockGetBalance,
  mockInsert,
  mockDelete,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetAgentPublic: vi.fn(),
  mockGetBalance: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/agent-catalog", () => ({ getAgentPublic: mockGetAgentPublic }));
vi.mock("@/lib/credits", () => ({ getBalance: mockGetBalance }));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => mockInsert(),
      }),
    }),
    delete: () => ({
      where: () => mockDelete(),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  agentInstalls: { userId: "user_id", agentSlug: "agent_slug" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

import { POST, DELETE } from "@/app/api/catalog/[slug]/install/route";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  mockAuth.mockReset();
  mockGetAgentPublic.mockReset();
  mockGetBalance.mockReset();
  mockInsert.mockReset();
  mockDelete.mockReset();
});

describe("POST /api/catalog/[slug]/install", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(new Request("http://l/api/catalog/a/install", { method: "POST" }), params("a"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent slug not in catalog", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgentPublic.mockResolvedValue(null);
    const res = await POST(new Request("http://l/api/catalog/ghost/install", { method: "POST" }), params("ghost"));
    expect(res.status).toBe(404);
  });

  it("installs free agent and returns 200 + installed:true", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgentPublic.mockResolvedValue({ slug: "a", displayName: "A", pricingCents: 0 });
    mockInsert.mockResolvedValue([{ id: "i1" }]);
    const res = await POST(new Request("http://l/api/catalog/a/install", { method: "POST" }), params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installed).toBe(true);
    // Free agent — must not hit credits service
    expect(mockGetBalance).not.toHaveBeenCalled();
  });

  it("returns 402 when paid agent and balance insufficient", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgentPublic.mockResolvedValue({ slug: "pro", displayName: "Pro", pricingCents: 500 });
    mockGetBalance.mockResolvedValue(100); // only 100c, needs 500c
    const res = await POST(new Request("http://l/api/catalog/pro/install", { method: "POST" }), params("pro"));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.required).toBe(500);
    expect(body.available).toBe(100);
    expect(body.topUpUrl).toContain("/dashboard/billing");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("installs paid agent when balance sufficient", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgentPublic.mockResolvedValue({ slug: "pro", displayName: "Pro", pricingCents: 500 });
    mockGetBalance.mockResolvedValue(1000);
    mockInsert.mockResolvedValue([{ id: "i1" }]);
    const res = await POST(new Request("http://l/api/catalog/pro/install", { method: "POST" }), params("pro"));
    expect(res.status).toBe(200);
  });

  it("is idempotent — second install of same agent still returns 200", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgentPublic.mockResolvedValue({ slug: "a", displayName: "A", pricingCents: 0 });
    // onConflictDoNothing returns [] the second time — still success
    mockInsert.mockResolvedValue([]);
    const res = await POST(new Request("http://l/api/catalog/a/install", { method: "POST" }), params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.installed).toBe(true);
  });
});

describe("DELETE /api/catalog/[slug]/install", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(new Request("http://l/api/catalog/a/install", { method: "DELETE" }), params("a"));
    expect(res.status).toBe(401);
  });

  it("uninstalls and returns 200", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockDelete.mockResolvedValue({ rowCount: 1 });
    const res = await DELETE(new Request("http://l/api/catalog/a/install", { method: "DELETE" }), params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uninstalled).toBe(true);
  });
});
