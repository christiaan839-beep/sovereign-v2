/**
 * GET /api/leaderboard — tests.
 *
 * Query-param contract: sort ∈ {success, cost, speed, earnings},
 *                        window ∈ {7d, 30d, all}.
 * Returns top 50. Agents with 0 runs in the window are filtered out
 * (no meaningful ranking possible). Cache 60s at the edge.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));

vi.mock("@/db", () => {
  const chain = (resolver: () => Promise<unknown[]>) => {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.innerJoin = () => c;
    c.leftJoin = () => c;
    c.where = () => c;
    c.groupBy = () => c;
    c.having = () => c;
    c.orderBy = () => c;
    c.limit = () => c;
    (c as { then?: unknown }).then = (cb: (r: unknown[]) => unknown) =>
      resolver().then(cb);
    return c;
  };
  return {
    db: {
      select: () => ({
        from: () => chain(() => Promise.resolve(mockSelect())),
      }),
    },
  };
});

vi.mock("@/db/schema", () => ({
  agentMetadata: { slug: "slug", displayName: "displayName", category: "category", verified: "verified", creatorHandle: "creatorHandle" },
  agentStatsDaily: { agentSlug: "agent_slug", day: "day", runs: "runs", successes: "successes", avgDurationMs: "avg_duration_ms", totalCostCents: "total_cost_cents" },
}));

vi.mock("drizzle-orm", () => {
  // sql tag-template returns an object with `.as(name)` — match Drizzle's shape
  const makeSql = () => {
    const s: Record<string, unknown> = { _sql: true };
    s.as = (name: string) => ({ _sql: true, _alias: name, as: s.as });
    return s;
  };
  return {
    eq: vi.fn(),
    and: vi.fn(),
    gte: vi.fn(),
    desc: vi.fn((x: unknown) => ({ _desc: x })),
    asc: vi.fn((x: unknown) => ({ _asc: x })),
    sql: Object.assign(
      (..._args: unknown[]) => makeSql(),
      { raw: (s: string) => s },
    ),
  };
});

import { GET } from "@/app/api/leaderboard/route";

beforeEach(() => mockSelect.mockReset());

describe("GET /api/leaderboard", () => {
  it("returns the default leaderboard (success, 30d)", async () => {
    mockSelect.mockResolvedValue([
      { slug: "a", displayName: "A", category: "content", verified: true, runs: 100, successes: 95, avgDurationMs: 1000, totalCostCents: 500, successRate: 0.95 },
    ]);
    const res = await GET(new Request("http://l/api/leaderboard"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(1);
    expect(body.sort).toBe("success");
    expect(body.window).toBe("30d");
  });

  it("rejects invalid sort with 400", async () => {
    const res = await GET(new Request("http://l/api/leaderboard?sort=popularity"));
    expect(res.status).toBe(400);
  });

  it("rejects invalid window with 400", async () => {
    const res = await GET(new Request("http://l/api/leaderboard?window=90d"));
    expect(res.status).toBe(400);
  });

  it("accepts sort=speed", async () => {
    mockSelect.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/leaderboard?sort=speed"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sort).toBe("speed");
  });

  it("accepts window=all", async () => {
    mockSelect.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/leaderboard?window=all"));
    const body = await res.json();
    expect(body.window).toBe("all");
  });

  it("sets Cache-Control header", async () => {
    mockSelect.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/leaderboard"));
    expect(res.headers.get("Cache-Control")).toContain("max-age");
  });
});
