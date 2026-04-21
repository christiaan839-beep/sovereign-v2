/**
 * /api/cron/rollup-agent-stats — unit tests.
 *
 * The rollup itself is pure SQL (INSERT...SELECT...ON CONFLICT), so we
 * test the surrounding plumbing: auth gating, idempotency report, and
 * the two-phase rollup (counts from agent_activity, durations from
 * playbook_run_steps).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyCron, mockExecute } = vi.hoisted(() => ({
  mockVerifyCron: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCron: mockVerifyCron }));
vi.mock("@/db", () => ({ db: { execute: mockExecute } }));
vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (..._args: unknown[]) => ({ _sql: true }),
    { raw: (s: string) => s },
  ),
}));

import { POST, GET } from "@/app/api/cron/rollup-agent-stats/route";

beforeEach(() => {
  mockVerifyCron.mockReset();
  mockExecute.mockReset();
});

describe("/api/cron/rollup-agent-stats", () => {
  it("returns 401 when auth fails", async () => {
    mockVerifyCron.mockReturnValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );
    const res = await POST(new Request("http://l/api/cron/rollup-agent-stats", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("performs three-phase rollup and reports rows affected", async () => {
    mockVerifyCron.mockReturnValue(null);
    // Phase 1: counts (agent_activity) → 12
    // Phase 2: durations (playbook_run_steps) → 8
    // Phase 3: costs (credit_transactions) → 5
    mockExecute.mockResolvedValueOnce({ rowCount: 12 });
    mockExecute.mockResolvedValueOnce({ rowCount: 8 });
    mockExecute.mockResolvedValueOnce({ rowCount: 5 });

    const res = await POST(new Request("http://l/api/cron/rollup-agent-stats", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.countsAffected).toBe(12);
    expect(body.durationsAffected).toBe(8);
    expect(body.costsAffected).toBe(5);
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });

  it("returns 500 on SQL error with error payload", async () => {
    mockVerifyCron.mockReturnValue(null);
    mockExecute.mockRejectedValueOnce(new Error("connection lost"));
    const res = await POST(new Request("http://l/api/cron/rollup-agent-stats", { method: "POST" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("GET and POST both work (Vercel cron uses GET by default)", async () => {
    mockVerifyCron.mockReturnValue(null);
    mockExecute.mockResolvedValue({ rowCount: 0 });
    const res = await GET(new Request("http://l/api/cron/rollup-agent-stats"));
    expect(res.status).toBe(200);
  });
});
