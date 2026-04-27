/**
 * /api/cron/dag-orphan-cleanup — cron handler tests.
 *
 * Verifies:
 *   - CRON_SECRET enforcement (verifyCron returns 401 without it)
 *   - Reap-zero case: returns 200 with reaped=0 (clean no-op)
 *   - Reap-some case: audit-logs each reaped row with the right
 *     per-user userId so tenant scoping in the audit chain holds
 *   - Reaper exception → 500 (so cron monitoring lights up)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyCron, mockReap, mockAuditLog } = vi.hoisted(() => ({
  mockVerifyCron: vi.fn(),
  mockReap: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCron: mockVerifyCron }));
vi.mock("@/lib/playbook-dag-store", () => ({ reapOrphanedRuns: mockReap }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET, POST } from "@/app/api/cron/dag-orphan-cleanup/route";

beforeEach(() => {
  mockVerifyCron.mockReset();
  mockReap.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
});

describe("GET /api/cron/dag-orphan-cleanup", () => {
  it("returns 401 when verifyCron fails", async () => {
    mockVerifyCron.mockReturnValue(new Response("{}", { status: 401 }));
    const res = await GET(new Request("http://l/x"));
    expect(res.status).toBe(401);
    expect(mockReap).not.toHaveBeenCalled();
  });

  it("returns 200 with reaped=0 on clean no-op (no orphans found)", async () => {
    mockVerifyCron.mockReturnValue(undefined);
    mockReap.mockResolvedValue({ reaped: 0, rows: [] });

    const res = await GET(new Request("http://l/x"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reaped).toBe(0);
    expect(typeof body.sweptAt).toBe("string");
    // No orphans → no audit log entries.
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("audit-logs one entry per reaped row with the correct userId", async () => {
    // Critical security property: even though the cron itself runs
    // at the system level (CRON_SECRET, no user session), every
    // resulting audit-log entry MUST carry the affected user's
    // userId so the tenant-scoped audit chain stays per-user.
    mockVerifyCron.mockReturnValue(undefined);
    mockReap.mockResolvedValue({
      reaped: 3,
      rows: [
        { id: "run-1", userId: "user_alice" },
        { id: "run-2", userId: "user_bob" },
        { id: "run-3", userId: "user_alice" },
      ],
    });

    const res = await GET(new Request("http://l/x"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reaped).toBe(3);

    // 3 audit-log entries, one per row, each scoped to the right user.
    expect(mockAuditLog).toHaveBeenCalledTimes(3);
    const calls = mockAuditLog.mock.calls.map((c) => c[0]);
    expect(calls[0].userId).toBe("user_alice");
    expect(calls[1].userId).toBe("user_bob");
    expect(calls[2].userId).toBe("user_alice");
    // All carry the orphan_reaped kind.
    for (const c of calls) {
      expect(c.details.kind).toBe("playbook_dag.run.orphan_reaped");
      expect(c.details.thresholdMinutes).toBe(10);
    }
  });

  it("returns 500 when reapOrphanedRuns throws", async () => {
    // Distinguishes "ran clean" from "infrastructure problem" so
    // Vercel cron monitoring can light up the on-call dashboard.
    mockVerifyCron.mockReturnValue(undefined);
    mockReap.mockRejectedValue(new Error("DB exploded"));

    const res = await GET(new Request("http://l/x"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/DB exploded/);
  });

  it("POST handler uses the same logic as GET", async () => {
    mockVerifyCron.mockReturnValue(undefined);
    mockReap.mockResolvedValue({ reaped: 0, rows: [] });
    const res = await POST(new Request("http://l/x", { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("does not fail the cron when an individual auditLog rejects", async () => {
    // Resilience property: a single audit-log failure shouldn't
    // poison the whole sweep. The cron should still return 200 with
    // the reaped count; the audit-log infra has its own monitoring.
    mockVerifyCron.mockReturnValue(undefined);
    mockReap.mockResolvedValue({
      reaped: 2,
      rows: [
        { id: "run-1", userId: "user_a" },
        { id: "run-2", userId: "user_b" },
      ],
    });
    mockAuditLog.mockRejectedValueOnce(new Error("audit chain down"));
    mockAuditLog.mockResolvedValueOnce(undefined);

    const res = await GET(new Request("http://l/x"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reaped).toBe(2);
  });
});
