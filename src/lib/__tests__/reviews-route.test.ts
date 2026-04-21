/**
 * GET/POST /api/catalog/[slug]/reviews — review endpoints tests.
 *
 * GET  : public, sorted by createdAt desc, limit 20
 * POST : Clerk-required, Zod-validated (rating 1..5, comment ≤2000 chars),
 *        upserts — second POST from same user UPDATES rather than
 *        duplicates (unique index on (user_id, agent_slug)).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockSelect, mockInsert, mockGetAgent } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockGetAgent: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/agent-catalog", () => ({ getAgentPublic: mockGetAgent }));

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
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => mockInsert(),
        }),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  agentReviews: {
    id: "id",
    userId: "user_id",
    agentSlug: "agent_slug",
    rating: "rating",
    comment: "comment",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

import { GET, POST } from "@/app/api/catalog/[slug]/reviews/route";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  mockAuth.mockReset();
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockGetAgent.mockReset();
});

describe("GET /api/catalog/[slug]/reviews", () => {
  it("returns reviews without auth", async () => {
    mockSelect.mockResolvedValue([
      { id: "r1", userId: "u1", rating: 5, comment: "Love it", createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://l/api/catalog/a/reviews"), params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0].rating).toBe(5);
  });
});

describe("POST /api/catalog/[slug]/reviews", () => {
  const body = (payload: object) =>
    new Request("http://l/api/catalog/a/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(body({ rating: 5, comment: "hi" }), params("a"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent not in catalog", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue(null);
    const res = await POST(body({ rating: 5 }), params("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns 400 on rating out of range", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue({ slug: "a" });
    const res = await POST(body({ rating: 0, comment: "bad" }), params("a"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on rating=6 (above max)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue({ slug: "a" });
    const res = await POST(body({ rating: 6 }), params("a"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on comment over 2000 chars", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue({ slug: "a" });
    const res = await POST(body({ rating: 4, comment: "x".repeat(2001) }), params("a"));
    expect(res.status).toBe(400);
  });

  it("returns 200 + review on valid input", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue({ slug: "a" });
    mockInsert.mockResolvedValue([{ id: "r1", userId: "u_1", agentSlug: "a", rating: 5, comment: "great" }]);
    const res = await POST(body({ rating: 5, comment: "great" }), params("a"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.review.rating).toBe(5);
  });

  it("returns 200 on second review from same user (upsert)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue({ slug: "a" });
    mockInsert.mockResolvedValue([{ id: "r1", rating: 3 }]); // updated in place
    const res = await POST(body({ rating: 3, comment: "eh" }), params("a"));
    expect(res.status).toBe(200);
  });

  it("returns 400 on malformed JSON body", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetAgent.mockResolvedValue({ slug: "a" });
    const req = new Request("http://l/api/catalog/a/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req, params("a"));
    expect(res.status).toBe(400);
  });
});
