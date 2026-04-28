/**
 * /api/playbooks/dag/* — route handler tests.
 *
 * Mocks the store layer so we can verify the wiring (auth gating,
 * parameter handling, response shapes, audit-log calls) without a
 * live DB. Store-internal logic is tested separately in
 * playbook-dag-store.test.ts.
 *
 * Endpoints covered:
 *   GET    /api/playbooks/dag         — list
 *   POST   /api/playbooks/dag         — create or update
 *   GET    /api/playbooks/dag/[id]    — fetch one
 *   DELETE /api/playbooks/dag/[id]    — soft-delete
 *   GET    /api/playbooks/dag/runs    — run history
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequireAuth,
  mockAuditLog,
  mockListDags,
  mockGetDag,
  mockInsertDag,
  mockUpdateDag,
  mockArchiveDag,
  mockListDagRuns,
  mockCreateDagVersion,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockAuditLog: vi.fn(),
  mockListDags: vi.fn(),
  mockGetDag: vi.fn(),
  mockInsertDag: vi.fn(),
  mockUpdateDag: vi.fn(),
  mockArchiveDag: vi.fn(),
  mockListDagRuns: vi.fn(),
  mockCreateDagVersion: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
// Round 24 added createDagVersion to the save POST flow.
// The mock returns a synthetic version row so the route's
// "if (!version) return 500" branch never fires in the happy path.
vi.mock("@/lib/playbook-dag-store", () => ({
  listDags: mockListDags,
  getDag: mockGetDag,
  insertDag: mockInsertDag,
  updateDag: mockUpdateDag,
  archiveDag: mockArchiveDag,
  listDagRuns: mockListDagRuns,
  createDagVersion: mockCreateDagVersion,
}));

import { GET as listGet, POST as savePost } from "@/app/api/playbooks/dag/route";
import { GET as oneGet, DELETE as oneDelete } from "@/app/api/playbooks/dag/[id]/route";
import { GET as runsGet } from "@/app/api/playbooks/dag/runs/route";

const validDag = {
  nodes: [
    { id: "n1", agent: "leads", position: { x: 0, y: 0 }, config: { count: 5 } },
    { id: "n2", agent: "outreach", position: { x: 200, y: 0 }, config: {} },
  ],
  edges: [{ from: "n1.leads", to: "n2.target" }],
};

// Real-shape UUID v4 (Zod v4 enforces version + variant bits, not just
// the dash pattern, so the lazy "11111111-..." form doesn't validate).
const fakeUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
  mockListDags.mockReset();
  mockGetDag.mockReset();
  mockInsertDag.mockReset();
  mockUpdateDag.mockReset();
  mockArchiveDag.mockReset();
  mockListDagRuns.mockReset();
});

describe("GET /api/playbooks/dag (list)", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await listGet();
    expect(res.status).toBe(401);
  });

  it("returns user's DAG summaries (dag payload stripped from list shape)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockListDags.mockResolvedValue({
      dags: [
        {
          id: fakeUuid,
          userId: "user_1",
          name: "My playbook",
          description: null,
          dag: validDag,
          status: "draft" as const,
          nodeCount: 2,
          edgeCount: 1,
          lastRunAt: null,
          lastRunStatus: null,
          lastRunDurationMs: null,
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z",
        },
      ],
    });
    const res = await listGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dags).toHaveLength(1);
    expect(body.dags[0].id).toBe(fakeUuid);
    expect(body.dags[0].name).toBe("My playbook");
    // Critical: the heavy `dag` field must NOT be in the list
    // response — clients hydrate it via GET /[id] when needed.
    expect(body.dags[0].dag).toBeUndefined();
  });
});

describe("POST /api/playbooks/dag (create / update)", () => {
  function req(body: unknown): Request {
    return new Request("http://l/api/playbooks/dag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await savePost(req({ dag: validDag }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on cyclic DAG", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const cyclic = {
      nodes: [
        { id: "n1", agent: "a", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", agent: "b", position: { x: 100, y: 0 }, config: {} },
      ],
      edges: [
        { from: "n1.x", to: "n2.x" },
        { from: "n2.y", to: "n1.y" },
      ],
    };
    const res = await savePost(req({ dag: cyclic }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cycle/i);
  });

  it("returns 400 on duplicate node ids", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const dup = {
      nodes: [
        { id: "n1", agent: "a", position: { x: 0, y: 0 }, config: {} },
        { id: "n1", agent: "b", position: { x: 100, y: 0 }, config: {} },
      ],
      edges: [],
    };
    const res = await savePost(req({ dag: dup }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duplicate/i);
  });

  it("returns 400 on edge referencing unknown node", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const orphan = {
      nodes: [{ id: "n1", agent: "a", position: { x: 0, y: 0 }, config: {} }],
      edges: [{ from: "n1.x", to: "ghost.y" }],
    };
    const res = await savePost(req({ dag: orphan }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown node/i);
  });

  it("creates a new DAG when no id is given, returns the new id and action='create'", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockInsertDag.mockResolvedValue({ id: fakeUuid, persisted: true });
    // Round 24 — save POST also calls createDagVersion to record v1.
    mockCreateDagVersion.mockResolvedValue({
      id: "ver_1",
      dagId: fakeUuid,
      userId: "user_1",
      version: 1,
      dag: validDag,
      note: null,
      restoredFromVersion: null,
      createdAt: new Date().toISOString(),
    });

    const res = await savePost(req({ dag: validDag, name: "fresh" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBe(fakeUuid);
    expect(body.action).toBe("create");
    expect(body.persisted).toBe(true);
    expect(Array.isArray(body.executionOrder)).toBe(true);
    // Round 24 — version surfaced in response.
    expect(body.version).toBe(1);

    // Audit-log for create.
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe("playbook_dag.create");
  });

  it("updates when id is provided and the user owns it", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    // Round 24 — UPDATE branch now reads via getDag first.
    mockGetDag.mockResolvedValue({
      id: fakeUuid,
      userId: "user_1",
      name: "old",
      description: null,
      dag: validDag,
      status: "draft",
      nodeCount: 2,
      edgeCount: 1,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunDurationMs: null,
      versionCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockUpdateDag.mockResolvedValue({ updated: true });
    mockCreateDagVersion.mockResolvedValue({
      id: "ver_6",
      dagId: fakeUuid,
      userId: "user_1",
      version: 6,
      dag: validDag,
      note: null,
      restoredFromVersion: null,
      createdAt: new Date().toISOString(),
    });

    const res = await savePost(req({ id: fakeUuid, dag: validDag, name: "renamed" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("update");
    expect(body.id).toBe(fakeUuid);
    expect(body.version).toBe(6);

    // Audit-log uses .update kind, not .create.
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe("playbook_dag.update");
  });

  it("returns 404 when updating a row the store says doesn't exist (or wrong owner)", async () => {
    // Important security property: a wrong-owner request looks
    // identical to "doesn't exist". No information leak via the
    // status code.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    // Round 24 — first gate is getDag returning null.
    mockGetDag.mockResolvedValue(null);

    const res = await savePost(req({ id: fakeUuid, dag: validDag }));
    expect(res.status).toBe(404);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("rejects malformed UUIDs in id (zod uuid())", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await savePost(req({ id: "not-a-uuid", dag: validDag }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/playbooks/dag/[id]", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await oneGet(new Request("http://l/api/playbooks/dag/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the store returns null (not found OR wrong owner)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockGetDag.mockResolvedValue(null);
    const res = await oneGet(new Request("http://l/api/playbooks/dag/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the full SavedDag including the dag payload on hit", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const stored = {
      id: fakeUuid,
      userId: "user_1",
      name: "x",
      description: null,
      dag: validDag,
      status: "draft" as const,
      nodeCount: 2,
      edgeCount: 1,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunDurationMs: null,
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    mockGetDag.mockResolvedValue(stored);
    const res = await oneGet(new Request("http://l/api/playbooks/dag/abc"), {
      params: Promise.resolve({ id: fakeUuid }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dag.id).toBe(fakeUuid);
    expect(body.dag.dag).toEqual(validDag);
  });
});

describe("DELETE /api/playbooks/dag/[id]", () => {
  it("returns 404 when the row doesn't exist or the user doesn't own it", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockArchiveDag.mockResolvedValue({ archived: false });
    const res = await oneDelete(new Request("http://l/api/playbooks/dag/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(404);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 + audit-logs on successful soft-delete", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockArchiveDag.mockResolvedValue({ archived: true });
    const res = await oneDelete(new Request("http://l/api/playbooks/dag/abc"), {
      params: Promise.resolve({ id: fakeUuid }),
    });
    expect(res.status).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe("playbook_dag.archive");
    expect(mockAuditLog.mock.calls[0][0].details.id).toBe(fakeUuid);
  });
});

describe("GET /api/playbooks/dag/runs", () => {
  function req(query = ""): Request {
    return new Request(`http://l/api/playbooks/dag/runs${query}`);
  }

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await runsGet(req());
    expect(res.status).toBe(401);
  });

  it("returns recent runs as lightweight summaries (no dagSnapshot, no full results)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockListDagRuns.mockResolvedValue({
      runs: [
        {
          id: "run-1",
          userId: "user_1",
          dagId: fakeUuid,
          dagSnapshot: validDag,
          status: "completed",
          nodeCount: 2,
          edgeCount: 1,
          results: [{ nodeId: "n1", agent: "leads", status: "completed", durationMs: 50 }],
          totalDurationMs: 100,
          failedAt: null,
          createdAt: "2026-04-27T00:00:00.000Z",
        },
      ],
    });
    const res = await runsGet(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    // The list endpoint MUST drop the heavy fields — clients fetch
    // detail elsewhere when needed.
    expect(body.runs[0].dagSnapshot).toBeUndefined();
    expect(body.runs[0].results).toBeUndefined();
    // But the summary fields are present:
    expect(body.runs[0].id).toBe("run-1");
    expect(body.runs[0].status).toBe("completed");
    expect(body.runs[0].totalDurationMs).toBe(100);
  });

  it("filters by dagId when provided in query", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockListDagRuns.mockResolvedValue({ runs: [] });
    await runsGet(req(`?dagId=${fakeUuid}`));
    expect(mockListDagRuns).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", dagId: fakeUuid }),
    );
  });

  it("rejects bogus dagId formats with 400", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await runsGet(req("?dagId=not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockListDagRuns).not.toHaveBeenCalled();
  });

  it("clamps the limit to a reasonable range", async () => {
    // The store has its own clamp but the route also clamps to keep
    // request payloads predictable. Pass an absurd limit; the store
    // call should still see a sensible value.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockListDagRuns.mockResolvedValue({ runs: [] });
    await runsGet(req("?limit=99999"));
    expect(mockListDagRuns).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });
});
