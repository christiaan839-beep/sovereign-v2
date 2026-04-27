/**
 * /api/playbooks/dag/runs/[runId] AND /api/playbooks/dag/[id]/clone — tests.
 *
 * Verifies:
 *   - Auth gating (401)
 *   - Tenant isolation via 404 (no information leak via 403 vs 404)
 *   - UUID guards on path params
 *   - Audit-log fires the right `kind` for clone
 *   - Full SavedDagRun returned on detail endpoint (with dagSnapshot
 *     + results) — list endpoint strips these, detail endpoint must
 *     include them
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockAuditLog, mockGetDagRun, mockCloneDag } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockAuditLog: vi.fn(),
  mockGetDagRun: vi.fn(),
  mockCloneDag: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/playbook-dag-store", () => ({
  getDagRun: mockGetDagRun,
  cloneDag: mockCloneDag,
}));

import { GET as runDetailGet } from "@/app/api/playbooks/dag/runs/[runId]/route";
import { POST as clonePost } from "@/app/api/playbooks/dag/[id]/clone/route";

const fakeUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const otherUuid = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
  mockGetDagRun.mockReset();
  mockCloneDag.mockReset();
});

describe("GET /api/playbooks/dag/runs/[runId]", () => {
  function ctx(runId: string) {
    return { params: Promise.resolve({ runId }) };
  }

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await runDetailGet(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(401);
  });

  it("returns 400 on a malformed (non-UUID) runId", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await runDetailGet(new Request("http://l/x"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockGetDagRun).not.toHaveBeenCalled();
  });

  it("returns 404 when the store returns null (not found OR wrong owner)", async () => {
    // No information leak: wrong-owner and not-found return identical
    // status codes. The audit log is the place where we record who
    // tried to access what; the public response stays terse.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockGetDagRun.mockResolvedValue(null);
    const res = await runDetailGet(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(404);
  });

  it("returns the full SavedDagRun including dagSnapshot + results on hit", async () => {
    // Critical contract: the detail endpoint MUST include the heavy
    // payload (dagSnapshot + results[]) — that's what makes it the
    // "detail" endpoint vs the "list" endpoint. The list endpoint
    // strips these (tested elsewhere); detail must NOT.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const fullRun = {
      id: fakeUuid,
      userId: "user_1",
      dagId: otherUuid,
      dagSnapshot: {
        nodes: [{ id: "n1", agent: "leads", position: { x: 0, y: 0 }, config: {} }],
        edges: [],
      },
      status: "completed" as const,
      nodeCount: 1,
      edgeCount: 0,
      results: [
        {
          nodeId: "n1",
          agent: "leads",
          status: "completed" as const,
          output: { found: 5, _meta: { confidence: { score: 0.9, band: "high", recommendedAction: "ok" } } },
          durationMs: 250,
        },
      ],
      totalDurationMs: 280,
      failedAt: null,
      createdAt: "2026-04-27T00:00:00.000Z",
    };
    mockGetDagRun.mockResolvedValue(fullRun);
    const res = await runDetailGet(new Request("http://l/x"), ctx(fakeUuid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.run.id).toBe(fakeUuid);
    expect(body.run.dagSnapshot).toEqual(fullRun.dagSnapshot);
    expect(body.run.results).toHaveLength(1);
    expect(body.run.results[0].output.found).toBe(5);
  });

  it("forwards userId scoping to the store", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_42" });
    mockGetDagRun.mockResolvedValue(null);
    await runDetailGet(new Request("http://l/x"), ctx(fakeUuid));
    expect(mockGetDagRun).toHaveBeenCalledWith({
      id: fakeUuid,
      userId: "user_42",
    });
  });
});

describe("POST /api/playbooks/dag/[id]/clone", () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }
  function req(body?: unknown): Request {
    return new Request("http://l/api/playbooks/dag/abc/clone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? "" : JSON.stringify(body),
    });
  }

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await clonePost(req(), ctx(fakeUuid));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing id", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await clonePost(req(), ctx(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 when source not found OR wrong owner (no leak)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCloneDag.mockResolvedValue(null);
    const res = await clonePost(req(), ctx(fakeUuid));
    expect(res.status).toBe(404);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 + new id on successful clone", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCloneDag.mockResolvedValue({ id: otherUuid, persisted: true });
    const res = await clonePost(req(), ctx(fakeUuid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBe(otherUuid);
    expect(body.persisted).toBe(true);
    // Audit-log fired with the clone kind.
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe("playbook_dag.clone");
    expect(mockAuditLog.mock.calls[0][0].details.sourceId).toBe(fakeUuid);
    expect(mockAuditLog.mock.calls[0][0].details.newId).toBe(otherUuid);
  });

  it("accepts an empty body (the `name` field is optional)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCloneDag.mockResolvedValue({ id: otherUuid, persisted: true });
    const res = await clonePost(req(), ctx(fakeUuid));
    expect(res.status).toBe(200);
    expect(mockCloneDag).toHaveBeenCalledWith({
      sourceId: fakeUuid,
      userId: "user_1",
      name: undefined,
    });
  });

  it("forwards optional name override to the store", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCloneDag.mockResolvedValue({ id: otherUuid, persisted: true });
    await clonePost(req({ name: "My fork" }), ctx(fakeUuid));
    expect(mockCloneDag).toHaveBeenCalledWith({
      sourceId: fakeUuid,
      userId: "user_1",
      name: "My fork",
    });
  });
});
