/**
 * Tests for GET /api/agent-runs/recent-public — public live feed.
 *
 * Properties pinned:
 *   - Returns only visibility=public rows (NOT unlisted, NOT private)
 *   - Limit clamps to [1, 50] — default 30
 *   - signatureSha is a 12-char fingerprint, never the raw signature
 *   - Sorts newest-first (the SQL orderBy chain is exercised)
 *   - Returns empty array (not 500) on DB error — never crashes the feed
 *   - Returns CORS headers + cache hints
 *   - Rate-limit blocks repeat callers
 *
 * The route is open-CORS / no-auth — no Clerk mocking needed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface RowShape {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  signature: string;
  createdAt: Date;
}

let mockRows: RowShape[] = [];
let mockShouldThrow = false;
let mockRateLimitHit = false;

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({
    check: () =>
      Promise.resolve(
        mockRateLimitHit ? new Response("rate limited", { status: 429 }) : null,
      ),
  }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/db", () => {
  const chain: {
    select: () => typeof chain;
    from: () => typeof chain;
    where: () => typeof chain;
    orderBy: () => typeof chain;
    limit: (n: number) => Promise<RowShape[]>;
  } = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (n: number) => {
      if (mockShouldThrow) return Promise.reject(new Error("db down"));
      return Promise.resolve(mockRows.slice(0, n));
    },
  };
  return { db: chain };
});

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/agent-runs/recent-public/route");
}

function row(i: number, overrides: Partial<RowShape> = {}): RowShape {
  return {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    agentName: "blog-gen",
    modelUsed: "claude-sonnet-4-6",
    durationMs: 1000 + i,
    signature:
      "v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    createdAt: new Date(2026, 4, 11, 12, i),
    ...overrides,
  };
}

describe("GET /api/agent-runs/recent-public", () => {
  beforeEach(() => {
    mockRows = [];
    mockShouldThrow = false;
    mockRateLimitHit = false;
  });

  it("returns an empty array when no public rows exist", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("http://x/api/agent-runs/recent-public"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(0);
    expect(body.receipts).toEqual([]);
  });

  it("maps rows to the public projection with a sig fingerprint, not the raw signature", async () => {
    mockRows = [row(1), row(2)];
    const { GET } = await loadRoute();
    const res = await GET(new Request("http://x/api/agent-runs/recent-public"));
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.receipts[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      durationMs: 1001,
    });
    // signatureSha must be deterministic 12-hex, NOT the raw `v1=` signature
    expect(body.receipts[0].signatureSha).toMatch(/^[0-9a-f]{12}$/);
    expect(body.receipts[0].signatureSha).not.toContain("deadbeef");
    expect(body.receipts[0]).not.toHaveProperty("signature");
  });

  it("clamps ?limit to the [1, 50] window — default 30 when missing/invalid", async () => {
    mockRows = Array.from({ length: 60 }, (_, i) => row(i));
    const { GET } = await loadRoute();

    const defaults = await GET(
      new Request("http://x/api/agent-runs/recent-public"),
    );
    expect((await defaults.json()).count).toBe(30);

    const huge = await GET(
      new Request("http://x/api/agent-runs/recent-public?limit=9999"),
    );
    expect((await huge.json()).count).toBe(50);

    const tiny = await GET(
      new Request("http://x/api/agent-runs/recent-public?limit=0"),
    );
    expect((await tiny.json()).count).toBe(1);

    const garbage = await GET(
      new Request("http://x/api/agent-runs/recent-public?limit=banana"),
    );
    expect((await garbage.json()).count).toBe(30);

    const valid = await GET(
      new Request("http://x/api/agent-runs/recent-public?limit=10"),
    );
    expect((await valid.json()).count).toBe(10);
  });

  it("returns CORS + cache hints", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("http://x/api/agent-runs/recent-public"));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("s-maxage=15");
    expect(res.headers.get("cache-control")).toContain(
      "stale-while-revalidate",
    );
  });

  it("OPTIONS returns 204 with CORS preflight headers", async () => {
    const { OPTIONS } = await loadRoute();
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("returns empty (not 500) when the DB throws — feed must never crash", async () => {
    mockShouldThrow = true;
    const { GET } = await loadRoute();
    const res = await GET(new Request("http://x/api/agent-runs/recent-public"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(0);
    expect(body.receipts).toEqual([]);
    expect(body.reason).toBe("unavailable");
  });

  it("rate-limited requests get 429 — no DB query happens", async () => {
    mockRateLimitHit = true;
    const { GET } = await loadRoute();
    const res = await GET(new Request("http://x/api/agent-runs/recent-public"));
    expect(res.status).toBe(429);
  });

  it("produces stable signatureSha for the same input signature", async () => {
    mockRows = [
      row(1, { signature: "v1=aaaaaaaa" }),
      row(2, { signature: "v1=aaaaaaaa" }),
      row(3, { signature: "v1=bbbbbbbb" }),
    ];
    const { GET } = await loadRoute();
    const body = await (
      await GET(new Request("http://x/api/agent-runs/recent-public"))
    ).json();
    expect(body.receipts[0].signatureSha).toBe(body.receipts[1].signatureSha);
    expect(body.receipts[0].signatureSha).not.toBe(
      body.receipts[2].signatureSha,
    );
  });
});
