/**
 * Tests for GET /api/me/insights — receipt-backed analytics.
 *
 * Covers:
 *   - 401 unauthenticated
 *   - clamps days to [1, 90]
 *   - aggregates totals + safety pass rate from rows
 *   - latency percentiles computed correctly (sorted slice)
 *   - flagged counters match per-row safety results
 *   - daily buckets are pre-seeded (no gaps in the chart)
 *   - returns empty payload when DB blips (graceful)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

interface RowShape {
  agentName: string;
  durationMs: number;
  safetyResult: string;
  trustDecision: string;
  createdAt: Date | null;
}

let mockRows: RowShape[] = [];
let dbShouldThrow = false;

vi.mock("@/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => {
      if (dbShouldThrow) return Promise.reject(new Error("DB blip"));
      return Promise.resolve(mockRows);
    },
  };
  return { db: chain };
});

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/me/insights/route");
}

function row(overrides: Partial<RowShape> = {}): RowShape {
  return {
    agentName: "blog-gen",
    durationMs: 500,
    safetyResult: JSON.stringify({ jailbreak: "pass", pii: "pass" }),
    trustDecision: "auto-approved",
    createdAt: new Date(),
    ...overrides,
  };
}

function req(query = ""): Request {
  return new Request(`http://localhost/api/me/insights${query}`);
}

describe("GET /api/me/insights", () => {
  beforeEach(() => {
    mockRows = [];
    dbShouldThrow = false;
    vi.clearAllMocks();
  });

  it("returns 401 unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("clamps days to [1, 90]", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const { GET } = await loadRoute();
    const huge = (await (await GET(req("?days=9999"))).json()) as {
      windowDays: number;
    };
    expect(huge.windowDays).toBe(90);
    const tiny = (await (await GET(req("?days=0"))).json()) as {
      windowDays: number;
    };
    expect(tiny.windowDays).toBe(1);
  });

  it("aggregates totals + computes safety pass rate", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockRows = [
      row({ safetyResult: JSON.stringify({ jailbreak: "pass", pii: "pass" }) }),
      row({ safetyResult: JSON.stringify({ jailbreak: "pass", pii: "pass" }) }),
      row({
        safetyResult: JSON.stringify({ jailbreak: "fail", pii: "pass" }),
        trustDecision: "blocked",
      }),
    ];
    const { GET } = await loadRoute();
    const body = (await (await GET(req())).json()) as {
      totalRuns: number;
      safetyPassRate: number;
      blockedCount: number;
      flagged: { jailbreak: number };
    };
    expect(body.totalRuns).toBe(3);
    // 2 of 3 fully clean → 66.7%
    expect(body.safetyPassRate).toBeGreaterThan(60);
    expect(body.safetyPassRate).toBeLessThan(70);
    expect(body.blockedCount).toBe(1);
    expect(body.flagged.jailbreak).toBe(1);
  });

  it("computes latency percentiles from a sorted slice", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockRows = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((n) =>
      row({ durationMs: n }),
    );
    const { GET } = await loadRoute();
    const body = (await (await GET(req())).json()) as {
      latencyMs: { p50: number; p95: number; p99: number; avg: number };
    };
    expect(body.latencyMs.p50).toBe(600); // index 5 of 10
    expect(body.latencyMs.p95).toBe(1000); // floor(10*0.95)=9
    expect(body.latencyMs.avg).toBe(550);
  });

  it("daily buckets are pre-seeded (no gaps)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockRows = []; // zero runs but the chart should still have 30 days
    const { GET } = await loadRoute();
    const body = (await (await GET(req("?days=7"))).json()) as {
      dailyInvocations: { date: string; count: number }[];
    };
    expect(body.dailyInvocations).toHaveLength(7);
    expect(body.dailyInvocations.every((d) => d.count === 0)).toBe(true);
  });

  it("returns empty payload when DB blips (no 500)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    dbShouldThrow = true;
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalRuns: number };
    expect(body.totalRuns).toBe(0);
  });
});
