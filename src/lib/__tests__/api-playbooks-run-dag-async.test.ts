/**
 * /api/playbooks/run-dag — async path tests.
 *
 * Verifies the Round 12 smart sync-vs-async routing:
 *
 *   - mode='sync' OR ≤5 nodes → executes inline, response carries
 *     full result
 *   - mode='async' OR >5 nodes → creates pending run, returns
 *     {runId, pollUrl, async: true}, kicks off background work via
 *     after()
 *   - DB unavailable → async falls back to sync (createPendingRun
 *     returns null, route degrades gracefully)
 *
 * The actual after() execution isn't tested here (vitest doesn't
 * await Vercel's after-hook scheduler). We verify:
 *
 *   1. The dispatch response shape is correct.
 *   2. createPendingRun was called with the right args.
 *   3. The route returned BEFORE executing — the response landing
 *      doesn't depend on the worker finishing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequireAuth,
  mockAuditLog,
  mockRecordDagRun,
  mockCreatePendingRun,
  mockUpdateRunProgress,
  mockFinalizeRun,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockAuditLog: vi.fn(),
  mockRecordDagRun: vi.fn(),
  mockCreatePendingRun: vi.fn(),
  mockUpdateRunProgress: vi.fn(),
  mockFinalizeRun: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/playbook-dag-store", () => ({
  recordDagRun: mockRecordDagRun,
  createPendingRun: mockCreatePendingRun,
  updateRunProgress: mockUpdateRunProgress,
  finalizeRun: mockFinalizeRun,
}));
// We mock next/server's `after()` so the test isn't gated on Vercel's
// scheduler. Each test asserts on the body / mock state that the
// route synchronously sets BEFORE after() returns.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: vi.fn((fn: () => Promise<void> | void) => {
      // Fire-and-forget: don't await, mirroring real after() behavior
      // where the caller's response goes out before fn finishes.
      void Promise.resolve().then(() => fn());
    }),
  };
});

import { POST } from "@/app/api/playbooks/run-dag/route";

const fakeUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function dagWithNodes(n: number) {
  return {
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      agent: "leads",
      position: { x: i * 50, y: 0 },
      config: {},
    })),
    edges: [],
  };
}

function req(body: unknown): Request {
  return new Request("http://l/api/playbooks/run-dag", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
  mockRecordDagRun.mockReset();
  mockRecordDagRun.mockResolvedValue({ recorded: true, runId: "sync-run-1" });
  mockCreatePendingRun.mockReset();
  mockUpdateRunProgress.mockReset();
  mockUpdateRunProgress.mockResolvedValue({ updated: true });
  mockFinalizeRun.mockReset();
  mockFinalizeRun.mockResolvedValue({ finalized: true });
});

describe("POST /api/playbooks/run-dag — sync vs async routing", () => {
  it("≤5 nodes (auto): runs inline, response carries full result", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    // Mock fetch (the per-node agent gateway call) so executeDag
    // can complete synchronously.
    // mockImplementation, not mockResolvedValue — a Response body
    // can only be read once. Returning a fresh Response per call
    // keeps each agent fetch independent.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    try {
      const res = await POST(req({ dag: dagWithNodes(3) }) as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      // Sync response shape:
      expect(body.async).toBe(false);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.results)).toBe(true);
      // recordDagRun was used (sync path), createPendingRun was not.
      expect(mockRecordDagRun).toHaveBeenCalledTimes(1);
      expect(mockCreatePendingRun).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it(">5 nodes (auto): dispatches async, returns runId + pollUrl, no inline results", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCreatePendingRun.mockResolvedValue({ runId: fakeUuid });

    const res = await POST(req({ dag: dagWithNodes(8) }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Async response shape:
    expect(body.async).toBe(true);
    expect(body.runId).toBe(fakeUuid);
    expect(body.status).toBe("running");
    expect(body.pollUrl).toBe(`/api/playbooks/dag/runs/${fakeUuid}`);
    // createPendingRun was used; recordDagRun (the sync path) was not.
    expect(mockCreatePendingRun).toHaveBeenCalledTimes(1);
    expect(mockRecordDagRun).not.toHaveBeenCalled();
    // The dispatch should have happened with the right userId + dag.
    expect(mockCreatePendingRun).toHaveBeenCalledWith({
      userId: "user_1",
      dagId: null,
      dag: expect.objectContaining({ nodes: expect.any(Array) }),
    });
  });

  it("mode='async' on a 2-node DAG forces async dispatch", async () => {
    // Override the auto-pick. Useful for "preview run" UX where the
    // user wants the async UI flow even on a tiny DAG.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCreatePendingRun.mockResolvedValue({ runId: fakeUuid });

    const res = await POST(req({ dag: dagWithNodes(2), mode: "async" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.async).toBe(true);
    expect(body.runId).toBe(fakeUuid);
  });

  it("mode='sync' on a 50-node DAG forces sync execution", async () => {
    // Override the auto-pick. Useful for tests that want to exercise
    // the sync path without spinning up async infrastructure.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    // mockImplementation, not mockResolvedValue — a Response body
    // can only be read once. Returning a fresh Response per call
    // keeps each agent fetch independent.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    try {
      const res = await POST(req({ dag: dagWithNodes(50), mode: "sync" }) as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.async).toBe(false);
      expect(mockRecordDagRun).toHaveBeenCalledTimes(1);
      expect(mockCreatePendingRun).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("falls back to sync when createPendingRun returns null (DB offline)", async () => {
    // The async path requires persistence to be useful — without a
    // runId there's nothing to poll for. Falling back to sync means
    // the user still gets a result, just without the durability
    // benefits.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCreatePendingRun.mockResolvedValue(null);
    // mockImplementation, not mockResolvedValue — a Response body
    // can only be read once. Returning a fresh Response per call
    // keeps each agent fetch independent.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    try {
      const res = await POST(req({ dag: dagWithNodes(8) }) as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      // Falls through to sync path → async: false, recordDagRun called.
      expect(body.async).toBe(false);
      expect(mockRecordDagRun).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("validates mode enum — bad mode returns 400", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await POST(
      req({ dag: dagWithNodes(2), mode: "extreme" }) as never,
    );
    expect(res.status).toBe(400);
  });
});
