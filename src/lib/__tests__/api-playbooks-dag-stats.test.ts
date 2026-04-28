/**
 * /api/playbooks/dag/[id]/stats — endpoint tests.
 *
 * Verifies:
 *   - Auth gating
 *   - UUID guard on path param
 *   - Ownership check (404 on wrong-owner — same as not-found)
 *   - Stats shape passed through from store
 *   - Read-only (no audit log entry)
 *
 * Store-level math (success rate, p50/p95) is verified separately
 * since it requires real DB rows; here we mock the store.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockGetDag, mockGetDagStats, mockAuditLog } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetDag: vi.fn(),
  mockGetDagStats: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/playbook-dag-store", () => ({
  getDag: mockGetDag,
  getDagStats: mockGetDagStats,
}));

import { GET } from "@/app/api/playbooks/dag/[id]/stats/route";

const fakeUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockGetDag.mockReset();
  mockGetDagStats.mockReset();
  mockAuditLog.mockReset();
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const emptyStats = {
  totalRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
  runningRuns: 0,
  successRate: 0,
  p50DurationMs: null,
  p95DurationMs: null,
  lastRunAt: null,
  lastRunStatus: null,
  lastRunDurationMs: null,
  // Round 19 — recentRuns added to the contract for sparkline rendering.
  recentRuns: [],
};

describe("GET /api/playbooks/dag/[id]/stats", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(401);
  });

  it("returns 400 on a malformed UUID", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    const res = await GET(new Request("http://l/x"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockGetDag).not.toHaveBeenCalled();
    expect(mockGetDagStats).not.toHaveBeenCalled();
  });

  it("returns 404 when the DAG isn't owned by the user (no leak)", async () => {
    // Critical security property: stats must not leak across tenants.
    // The response is identical to "DAG doesn't exist".
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDag.mockResolvedValue(null);
    const res = await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(404);
    expect(mockGetDagStats).not.toHaveBeenCalled();
  });

  it("returns the stats shape on hit", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDag.mockResolvedValue({ id: fakeUuid });
    mockGetDagStats.mockResolvedValue({
      totalRuns: 12,
      completedRuns: 10,
      failedRuns: 2,
      runningRuns: 0,
      successRate: 10 / 12,
      p50DurationMs: 1200,
      p95DurationMs: 3400,
      lastRunAt: "2026-04-28T00:00:00.000Z",
      lastRunStatus: "completed" as const,
      lastRunDurationMs: 1100,
    });

    const res = await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.stats.totalRuns).toBe(12);
    expect(body.stats.successRate).toBeCloseTo(10 / 12);
    expect(body.stats.p50DurationMs).toBe(1200);
    expect(body.stats.p95DurationMs).toBe(3400);
  });

  it("returns empty-stats shape when the DAG has no runs", async () => {
    // Owner exists but no runs yet — clean zeros, not a 404.
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDag.mockResolvedValue({ id: fakeUuid });
    mockGetDagStats.mockResolvedValue(emptyStats);

    const res = await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.totalRuns).toBe(0);
    expect(body.stats.lastRunStatus).toBeNull();
  });

  it("forwards userId from auth into the store call (tenant isolation)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_42" });
    mockGetDag.mockResolvedValue({ id: fakeUuid });
    mockGetDagStats.mockResolvedValue(emptyStats);

    await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(mockGetDagStats).toHaveBeenCalledWith({
      dagId: fakeUuid,
      userId: "user_42",
    });
  });

  it("does NOT write an audit log entry (read-only endpoint)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDag.mockResolvedValue({ id: fakeUuid });
    mockGetDagStats.mockResolvedValue(emptyStats);

    await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("returns recentRuns for sparkline rendering (Round 19 contract)", async () => {
    // The sparkline depends on the `recentRuns` array being present
    // on every successful response. Empty array is fine; missing field
    // would break the client-side render.
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDag.mockResolvedValue({ id: fakeUuid });
    mockGetDagStats.mockResolvedValue({
      ...emptyStats,
      totalRuns: 3,
      completedRuns: 2,
      failedRuns: 1,
      successRate: 2 / 3,
      recentRuns: [
        {
          id: "r1",
          status: "completed" as const,
          totalDurationMs: 1000,
          createdAt: "2026-04-26T00:00:00.000Z",
        },
        {
          id: "r2",
          status: "failed" as const,
          totalDurationMs: 5000,
          createdAt: "2026-04-27T00:00:00.000Z",
        },
        {
          id: "r3",
          status: "completed" as const,
          totalDurationMs: 1100,
          createdAt: "2026-04-28T00:00:00.000Z",
        },
      ],
    });

    const res = await GET(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.stats.recentRuns)).toBe(true);
    expect(body.stats.recentRuns).toHaveLength(3);
    expect(body.stats.recentRuns[0].status).toBe("completed");
    expect(body.stats.recentRuns[1].status).toBe("failed");
    expect(body.stats.recentRuns[2].totalDurationMs).toBe(1100);
  });
});
