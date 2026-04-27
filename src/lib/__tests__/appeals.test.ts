/**
 * /api/appeals — route handler tests.
 *
 * Verifies:
 *   - Auth gating (401) on the route handlers
 *   - Idempotency: filing twice for the same target returns the
 *     existing pending appeal with created=false
 *   - Validation: too-short message / missing target / bad targetKind
 *   - Audit-log fires the right `kind` for create vs duplicate
 *   - 503 when the store is unavailable (the route surfaces this so
 *     users know to retry, instead of dropping the appeal silently)
 *
 * Store-level graceful-no-DB tests live in appeals-store.test.ts —
 * separated because that file imports the real store while this one
 * mocks it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockAuditLog, mockCreateAppeal, mockListAppeals } =
  vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockAuditLog: vi.fn(),
    mockCreateAppeal: vi.fn(),
    mockListAppeals: vi.fn(),
  }));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/appeals-store", () => ({
  createAppeal: mockCreateAppeal,
  listAppeals: mockListAppeals,
}));

import { GET as appealsGet, POST as appealsPost } from "@/app/api/appeals/route";

function postReq(body: unknown): Request {
  return new Request("http://l/api/appeals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
  mockCreateAppeal.mockReset();
  mockListAppeals.mockReset();
});

describe("GET /api/appeals", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await appealsGet();
    expect(res.status).toBe(401);
  });

  it("returns the user's appeals", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockListAppeals.mockResolvedValue({
      appeals: [
        {
          id: "ap1",
          userId: "user_1",
          targetKind: "run",
          targetId: "run-x",
          message: "Please review",
          status: "pending",
          reviewerNotes: null,
          createdAt: "2026-04-27T00:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });
    const res = await appealsGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.appeals).toHaveLength(1);
    expect(body.appeals[0].id).toBe("ap1");
  });
});

describe("POST /api/appeals", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await appealsPost(
      postReq({ targetKind: "run", targetId: "x", message: "hello world" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on too-short message (zod min(10))", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await appealsPost(
      postReq({ targetKind: "run", targetId: "x", message: "short" }),
    );
    expect(res.status).toBe(400);
    expect(mockCreateAppeal).not.toHaveBeenCalled();
  });

  it("returns 400 on bad targetKind enum", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await appealsPost(
      postReq({ targetKind: "spaceship", targetId: "x", message: "this is fine" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const malformed = new Request("http://l/api/appeals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await appealsPost(malformed);
    expect(res.status).toBe(400);
  });

  it("returns 503 when the store says null (DB unavailable)", async () => {
    // Critical UX choice: filing an appeal must not be silently
    // dropped. 503 tells the user to retry rather than letting them
    // walk away thinking their appeal was filed.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCreateAppeal.mockResolvedValue(null);
    const res = await appealsPost(
      postReq({
        targetKind: "run",
        targetId: "x",
        message: "Please review this run carefully",
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 201 on a fresh creation, audit-logs with appeal.create", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCreateAppeal.mockResolvedValue({ id: "ap1", created: true });
    const res = await appealsPost(
      postReq({
        targetKind: "run",
        targetId: "run-x",
        message: "Please review this run carefully",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBe("ap1");
    expect(body.created).toBe(true);
    // Audit-log fired with the `appeal.create` kind.
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe("appeal.create");
  });

  it("returns 200 on an idempotent return (existing pending), audit-logs with appeal.duplicate_returned", async () => {
    // Idempotency: filing twice for the same target should NOT create
    // a duplicate row. The route returns 200 (not 201) so clients can
    // distinguish without parsing the body.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    mockCreateAppeal.mockResolvedValue({ id: "ap-existing", created: false });
    const res = await appealsPost(
      postReq({
        targetKind: "run",
        targetId: "run-x",
        message: "Trying to file again",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("ap-existing");
    expect(body.created).toBe(false);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe(
      "appeal.duplicate_returned",
    );
  });

  it("forwards userId from auth into the store call (tenant isolation)", async () => {
    // Critical security property: a hostile actor cannot file an
    // appeal on behalf of another user — the userId comes from the
    // authenticated session, not the request body.
    mockRequireAuth.mockResolvedValue({ userId: "user_42" });
    mockCreateAppeal.mockResolvedValue({ id: "ap1", created: true });
    await appealsPost(
      postReq({
        targetKind: "output",
        targetId: "out-x",
        message: "Please review this output",
      }),
    );
    expect(mockCreateAppeal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_42" }),
    );
  });
});
