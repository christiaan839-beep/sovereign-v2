/**
 * /api/playbooks/dag/runs/[runId]/share — route handler tests.
 *
 * Verifies the wiring (auth, ownership check, audit log) without
 * a live DB. Includes the per-share revoke endpoint and the public
 * /share resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequireAuth,
  mockAuditLog,
  mockGetDagRun,
  mockCreateShareToken,
  mockListShareTokensForRun,
  mockRevokeShareToken,
  mockResolveShareToken,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockAuditLog: vi.fn(),
  mockGetDagRun: vi.fn(),
  mockCreateShareToken: vi.fn(),
  mockListShareTokensForRun: vi.fn(),
  mockRevokeShareToken: vi.fn(),
  mockResolveShareToken: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/base-url", () => ({
  getBaseUrl: () => "https://sovereignmatrix.agency",
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/playbook-dag-store", () => ({ getDagRun: mockGetDagRun }));
vi.mock("@/lib/share-token-store", () => ({
  createShareToken: mockCreateShareToken,
  listShareTokensForRun: mockListShareTokensForRun,
  revokeShareToken: mockRevokeShareToken,
  resolveShareToken: mockResolveShareToken,
}));

import {
  GET as listGet,
  POST as createPost,
} from "@/app/api/playbooks/dag/runs/[runId]/share/route";
import { DELETE as revokeDelete } from "@/app/api/playbooks/dag/runs/[runId]/share/[shareId]/route";

const validRunId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const validShareId = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
  mockGetDagRun.mockReset();
  mockCreateShareToken.mockReset();
  mockListShareTokensForRun.mockReset();
  mockRevokeShareToken.mockReset();
  mockResolveShareToken.mockReset();
});

describe("GET /api/playbooks/dag/runs/[runId]/share", () => {
  function ctx(runId: string) {
    return { params: Promise.resolve({ runId }) };
  }

  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await listGet(new Request("http://l/x"), ctx(validRunId));
    expect(res.status).toBe(401);
  });

  it("returns 400 on bogus runId", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    const res = await listGet(new Request("http://l/x"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the user doesn't own the run (no leak)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue(null);
    const res = await listGet(new Request("http://l/x"), ctx(validRunId));
    expect(res.status).toBe(404);
    expect(mockListShareTokensForRun).not.toHaveBeenCalled();
  });

  it("strips revoked-share tokens from the response (no dead URLs surfaced)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue({ id: validRunId });
    mockListShareTokensForRun.mockResolvedValue({
      shares: [
        {
          id: "s1",
          token: "live-token",
          label: "Lawyer",
          expiresAt: "2099-01-01T00:00:00.000Z",
          revokedAt: null,
          lastAccessedAt: null,
          accessCount: 0,
          createdAt: "2026-04-28T00:00:00.000Z",
          active: true,
        },
        {
          id: "s2",
          token: "revoked-token",
          label: "Old",
          expiresAt: "2099-01-01T00:00:00.000Z",
          revokedAt: "2026-04-27T00:00:00.000Z",
          lastAccessedAt: null,
          accessCount: 0,
          createdAt: "2026-04-26T00:00:00.000Z",
          active: false,
        },
      ],
    });
    const res = await listGet(new Request("http://l/x"), ctx(validRunId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shares).toHaveLength(2);
    // Active share has the URL; revoked share has shareUrl=null.
    const active = body.shares.find((s: { id: string }) => s.id === "s1");
    const revoked = body.shares.find((s: { id: string }) => s.id === "s2");
    expect(active.shareUrl).toBe("https://sovereignmatrix.agency/share/live-token");
    expect(revoked.shareUrl).toBeNull();
    // Critical: the raw `token` field is NEVER in the response.
    expect(active).not.toHaveProperty("token");
    expect(revoked).not.toHaveProperty("token");
  });
});

describe("POST /api/playbooks/dag/runs/[runId]/share", () => {
  function ctx(runId: string) {
    return { params: Promise.resolve({ runId }) };
  }
  function req(body?: unknown): Request {
    return new Request("http://l/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? "" : JSON.stringify(body),
    });
  }

  it("returns 401 on auth failure", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await createPost(req(), ctx(validRunId));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid runId", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    const res = await createPost(req(), ctx("nope"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when ownership check fails", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue(null);
    const res = await createPost(req(), ctx(validRunId));
    expect(res.status).toBe(404);
    expect(mockCreateShareToken).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("returns 503 when the store says null (DB unavailable)", async () => {
    // Critical UX choice: share creation must NOT silently succeed
    // when the row didn't actually save. 503 tells the user to retry.
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue({ id: validRunId });
    mockCreateShareToken.mockResolvedValue(null);
    const res = await createPost(req(), ctx(validRunId));
    expect(res.status).toBe(503);
  });

  it("returns 201 + shareUrl on success, audit-logs the create", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue({ id: validRunId });
    mockCreateShareToken.mockResolvedValue({
      token: "abc123",
      id: validShareId,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const res = await createPost(req({ label: "Lawyer", ttlDays: 14 }), ctx(validRunId));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.shareUrl).toBe("https://sovereignmatrix.agency/share/abc123");
    expect(body.id).toBe(validShareId);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe(
      "dag_run_share.create",
    );
    expect(mockCreateShareToken).toHaveBeenCalledWith({
      runId: validRunId,
      userId: "u",
      label: "Lawyer",
      ttlDays: 14,
    });
  });

  it("rejects ttlDays > 90 via Zod", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue({ id: validRunId });
    const res = await createPost(req({ ttlDays: 365 }), ctx(validRunId));
    expect(res.status).toBe(400);
    expect(mockCreateShareToken).not.toHaveBeenCalled();
  });

  it("accepts an empty body (label + ttlDays optional)", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockGetDagRun.mockResolvedValue({ id: validRunId });
    mockCreateShareToken.mockResolvedValue({
      token: "abc123",
      id: validShareId,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const res = await createPost(req(), ctx(validRunId));
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/playbooks/dag/runs/[runId]/share/[shareId]", () => {
  function ctx(runId: string, shareId: string) {
    return { params: Promise.resolve({ runId, shareId }) };
  }

  it("returns 401 on auth failure", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await revokeDelete(
      new Request("http://l/x"),
      ctx(validRunId, validShareId),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid ids", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    const res = await revokeDelete(
      new Request("http://l/x"),
      ctx("nope", validShareId),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when the store says not-found OR wrong-owner", async () => {
    // No information leak: a hostile actor passing someone else's
    // shareId gets the same response as a non-existent one.
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockRevokeShareToken.mockResolvedValue({ revoked: false });
    const res = await revokeDelete(
      new Request("http://l/x"),
      ctx(validRunId, validShareId),
    );
    expect(res.status).toBe(404);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 + audit-logs on successful revoke", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "u" });
    mockRevokeShareToken.mockResolvedValue({ revoked: true });
    const res = await revokeDelete(
      new Request("http://l/x"),
      ctx(validRunId, validShareId),
    );
    expect(res.status).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0].details.kind).toBe(
      "dag_run_share.revoke",
    );
  });
});
