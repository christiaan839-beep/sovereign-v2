/**
 * /api/admin/agents/* — moderation endpoint tests.
 *
 * Verifies admin gating via requireAdmin and the happy-path DB updates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAdmin, mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => mockSelect(),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => mockUpdate(),
        }),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  agentMetadata: {
    slug: "slug",
    displayName: "displayName",
    tagline: "tagline",
    description: "description",
    category: "category",
    pricingCents: "pricingCents",
    creatorUserId: "creatorUserId",
    creatorHandle: "creatorHandle",
    verified: "verified",
    createdAt: "createdAt",
    visibility: "visibility",
    updatedAt: "updatedAt",
  },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), desc: vi.fn() }));

import { GET as pendingGet } from "@/app/api/admin/agents/pending/route";
import { POST as approve } from "@/app/api/admin/agents/[slug]/approve/route";
import { POST as reject } from "@/app/api/admin/agents/[slug]/reject/route";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const unauthorizedResp = () => new Response("{}", { status: 401 });

beforeEach(() => {
  mockRequireAdmin.mockReset();
  mockSelect.mockReset();
  mockUpdate.mockReset();
});

describe("GET /api/admin/agents/pending", () => {
  it("returns 401 when requireAdmin denies", async () => {
    mockRequireAdmin.mockResolvedValue(unauthorizedResp());
    const res = await pendingGet();
    expect(res.status).toBe(401);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns unlisted agents when admin", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockSelect.mockResolvedValue([
      { slug: "a", displayName: "A", category: "general", pricingCents: 0 },
    ]);
    const res = await pendingGet();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agents).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

describe("POST /api/admin/agents/[slug]/approve", () => {
  it("returns 401 when requireAdmin denies", async () => {
    mockRequireAdmin.mockResolvedValue(unauthorizedResp());
    const req = new Request("http://l", { method: "POST", body: "{}" });
    const res = await approve(req, params("a"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when slug not found", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockUpdate.mockResolvedValue([]);
    const req = new Request("http://l", { method: "POST", body: "{}" });
    const res = await approve(req, params("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and marks verified by default", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockUpdate.mockResolvedValue([
      { slug: "a", displayName: "A", visibility: "public", verified: true },
    ]);
    const req = new Request("http://l", { method: "POST", body: "{}" });
    const res = await approve(req, params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.verified).toBe(true);
  });

  it("honors verified:false override", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockUpdate.mockResolvedValue([
      { slug: "a", displayName: "A", visibility: "public", verified: false },
    ]);
    const req = new Request("http://l", {
      method: "POST",
      body: JSON.stringify({ verified: false }),
    });
    const res = await approve(req, params("a"));
    const body = await res.json();
    expect(body.agent.verified).toBe(false);
  });
});

describe("POST /api/admin/agents/[slug]/reject", () => {
  it("returns 401 when requireAdmin denies", async () => {
    mockRequireAdmin.mockResolvedValue(unauthorizedResp());
    const req = new Request("http://l", { method: "POST" });
    const res = await reject(req, params("a"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when slug not found", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockUpdate.mockResolvedValue([]);
    const req = new Request("http://l", { method: "POST" });
    const res = await reject(req, params("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and sets visibility=private", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1", admin: true });
    mockUpdate.mockResolvedValue([
      { slug: "a", displayName: "A", visibility: "private" },
    ]);
    const req = new Request("http://l", { method: "POST" });
    const res = await reject(req, params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.visibility).toBe("private");
  });
});
