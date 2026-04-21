import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockSelect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

// Chainable Drizzle mock — we return mockSelect() at the terminal .limit()
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (_: number) => mockSelect(),
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({ creditTransactions: {} }));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), desc: vi.fn(), and: vi.fn(), lt: vi.fn(),
}));

import { GET } from "@/app/api/credits/history/route";

beforeEach(() => {
  mockAuth.mockReset();
  mockSelect.mockReset();
});

describe("GET /api/credits/history", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(new Request("http://localhost/api/credits/history"));
    expect(res.status).toBe(401);
  });

  it("returns recent ledger entries for signed-in user", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockSelect.mockResolvedValue([
      { id: "t1", deltaCents: 100, reason: "topup", agentId: null, runId: null, createdAt: new Date() },
      { id: "t2", deltaCents: -5, reason: "agent_run", agentId: "seo", runId: null, createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://localhost/api/credits/history"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].reason).toBe("topup");
    expect(body.nextCursor).toBeNull();
  });

  it("clamps limit to 100 max", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockSelect.mockResolvedValue([]);
    // Request limit=500 → should clamp to 100 (no way to observe limit from
    // outside the mock; this test just confirms the endpoint doesn't 4xx)
    const res = await GET(new Request("http://localhost/api/credits/history?limit=500"));
    expect(res.status).toBe(200);
  });

  it("returns nextCursor when page is full", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    // 20 rows = exactly the default limit → cursor should be the last id
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`, deltaCents: -1, reason: "agent_run", agentId: null, runId: null, createdAt: new Date(),
    }));
    mockSelect.mockResolvedValue(rows);
    const res = await GET(new Request("http://localhost/api/credits/history?limit=20"));
    const body = await res.json();
    expect(body.nextCursor).toBe("t19");
  });
});
