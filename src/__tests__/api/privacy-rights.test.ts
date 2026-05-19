/**
 * Tests for /api/me/export + /api/me/delete — GDPR Art. 15/17 +
 * POPIA Section 23/24 surfaces.
 *
 * The DB is stubbed at the module boundary (drizzle's chained .from().where()
 * pattern is awkward to fake comprehensively, so each query returns []).
 * That's enough to exercise:
 *   - 401 when unauthenticated
 *   - 400 on missing / wrong confirmation body for delete
 *   - 200 attachment Content-Disposition for export
 *   - audit-log call BEFORE the cascade so the row survives
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();
const mockCurrentUser = vi.fn();
const mockAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));
vi.mock("@/lib/audit-log", () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Stub drizzle: every chained call resolves to [] (export) or a no-op
// awaitable (delete). The route's safeQuery / safeDelete wrapper handles
// errors gracefully, so a successful empty result is enough.
const emptyChain: unknown = {
  from: () => emptyChain,
  where: () => Promise.resolve([]),
  innerJoin: () => emptyChain,
  then: (cb: (rows: unknown[]) => unknown) => Promise.resolve(cb([])),
};
const dbStub = {
  select: () => emptyChain,
  delete: () => ({ where: () => Promise.resolve(undefined) }),
};
vi.mock("@/db", () => ({ db: dbStub }));

async function loadExport() {
  vi.resetModules();
  return await import("@/app/api/me/export/route");
}

async function loadDelete() {
  vi.resetModules();
  return await import("@/app/api/me/delete/route");
}

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/me/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ─── /api/me/export ──────────────────────────────────────────────────────

describe("GET /api/me/export", () => {
  // Wave-13: the ?signed=1 path needs AGENT_RUN_SIGNING_SECRET present
  // so signRun returns "v1=..." instead of "unsigned". Set once for the
  // describe block; restored implicitly when the process ends.
  if (!process.env.AGENT_RUN_SIGNING_SECRET) {
    process.env.AGENT_RUN_SIGNING_SECRET =
      "test-dsar-signing-secret-for-vitest-only";
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "alice@example.com" }],
    });
  });

  // Wave 13 added a Request parameter (the route reads ?signed=1).
  // Tests construct a minimal stub URL so the route can resolve query.
  const exportReq = () => new Request("http://localhost/api/me/export");

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await loadExport();
    const res = await GET(exportReq());
    expect(res.status).toBe(401);
  });

  it("returns 200 + Content-Disposition attachment for downloadable JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { GET } = await loadExport();
    const res = await GET(exportReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
  });

  it("audit-logs the export request (GDPR Art. 30 records of processing)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { GET } = await loadExport();
    await GET(exportReq());
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "data.export" }),
    );
  });

  it("?signed=1 appends a cryptographic attestation envelope (Wave 13)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { GET } = await loadExport();
    const res = await GET(
      new Request("http://localhost/api/me/export?signed=1"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(
      /vnd\.sovereign-dsar\+json/,
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.attestation).toBeTruthy();
    const att = body.attestation as Record<string, unknown>;
    expect(att.receiptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(att.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(att.signature).toMatch(/^v\d=/);
    expect(att.verifyUrl).toMatch(/^\/api\/dsar\/verify\//);
  });
});

// ─── /api/me/delete ──────────────────────────────────────────────────────

describe("POST /api/me/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "alice@example.com" }],
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await loadDelete();
    const res = await POST(makeRequest({ confirm: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is not JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { POST } = await loadDelete();
    // Send a non-JSON body
    const req = new Request("http://localhost/api/me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirm string is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { POST } = await loadDelete();
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("returns 400 when confirm string is wrong", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { POST } = await loadDelete();
    const res = await POST(makeRequest({ confirm: "delete" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 and runs the cascade with the correct confirmation", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { POST } = await loadDelete();
    const res = await POST(makeRequest({ confirm: "DELETE" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      tables: { succeeded: number };
    };
    expect(json.ok).toBe(true);
    expect(json.tables.succeeded).toBeGreaterThan(0);
  });

  it("emits a cascade-surviving deletion receipt (wave 97 — no raw identifiers persisted)", async () => {
    // Wave-97 change: the pre-cascade `auditLog({action:"data.delete"})`
    // call was removed because it stored raw email + userId in plaintext
    // AND was swept by the cascade anyway. The new evidence is the
    // post-cascade `data.delete-receipt` audit row with userId="system"
    // and sha256-committed subject identifiers (handled inside
    // emitDeletionReceipt → auditLog).
    mockAuth.mockResolvedValue({ userId: "user_test_123" });
    const { POST } = await loadDelete();
    await POST(makeRequest({ confirm: "DELETE" }));
    // Find the receipt-write call (action='data.delete-receipt').
    const receiptCalls = mockAuditLog.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as { action?: string })?.action === "data.delete-receipt",
    );
    expect(receiptCalls.length).toBeGreaterThan(0);
    const receipt = receiptCalls[0][0] as {
      userId: string;
      resource: string;
      details: Record<string, unknown>;
    };
    // CRITICAL guarantee: userId='system', NOT the deleted user's id —
    // otherwise the cascade's `delete(auditLogs).where(userId = X)`
    // would nuke the only proof the deletion happened.
    expect(receipt.userId).toBe("system");
    expect(receipt.resource).toMatch(/^deletion:[a-f0-9-]{36}$/);
    expect(receipt.details.schema).toBe("vaos-deletion-event-v1");
    expect(receipt.details.subjectCommitment).toMatch(/^[a-f0-9]{64}$/);
    // Raw userId MUST NOT appear in the persisted body.
    const serialized = JSON.stringify(receipt.details);
    expect(serialized).not.toContain("user_test_123");
  });
});
