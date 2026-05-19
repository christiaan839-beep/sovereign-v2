/**
 * Contract tests for GET /api/privacy/deletion-receipt/:ticketId.
 *
 * Public endpoint consumed by former data subjects + their
 * regulators. Same 404-leak-guard pattern as transparency/trs and
 * security/eval (wave 95/96).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { dbLimitMock } = vi.hoisted(() => ({
  dbLimitMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(dbLimitMock()),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  auditLogs: {
    action: "auditLogs.action",
    resource: "auditLogs.resource",
    details: "auditLogs.details",
    createdAt: "auditLogs.createdAt",
  },
}));

import { GET } from "@/app/api/privacy/deletion-receipt/[ticketId]/route";

const VALID_TICKET = "12345678-1234-4567-8901-123456789abc";

beforeEach(() => {
  dbLimitMock.mockReset();
});

describe("/api/privacy/deletion-receipt/:ticketId", () => {
  it("returns 404 for an invalid ticketId shape", async () => {
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: "not-a-uuid" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 with generic message when no row exists", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: VALID_TICKET }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("no deletion receipt for this ticket");
  });

  it("returns 404 with the SAME generic message when DB throws (no deploy-state leak)", async () => {
    dbLimitMock.mockImplementation(() => {
      throw new Error("relation audit_logs does not exist");
    });
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: VALID_TICKET }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("no deletion receipt for this ticket");
    expect(body.error).not.toMatch(/audit_logs|table|deploy|relation/i);
  });

  it("returns the receipt envelope when a row exists", async () => {
    const persisted = {
      schema: "vaos-deletion-event-v1",
      ts: "2026-05-19T00:00:00.000Z",
      ticketId: VALID_TICKET,
      subjectKind: "user",
      subjectCommitment: "a".repeat(64),
      emailCommitment: "b".repeat(64),
      legalBasis: "gdpr-art-17",
      requestedByCommitment: "d".repeat(64),
      note: null,
      tablesAffected: [{ table: "settings", ok: true }],
      summary: { totalTables: 1, succeeded: 1, failed: 0 },
      summaryHash: "c".repeat(64),
      mldsa65Sig: "v3sig==",
      pqEnabled: true,
    };
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify(persisted),
        createdAt: new Date("2026-05-19T00:00:01.000Z"),
      },
    ]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: VALID_TICKET }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schema).toBe("vaos-deletion-event-v1");
    expect(body.ticketId).toBe(VALID_TICKET);
    expect(body.subjectCommitment).toBe("a".repeat(64));
    expect(body.emailCommitment).toBe("b".repeat(64));
    expect(body.legalBasis).toBe("gdpr-art-17");
    expect(body.mldsa65Sig).toBe("v3sig==");
    expect(body.pqEnabled).toBe(true);
    expect(body.howToVerify).toContain("subjectCommitment");
    expect(body.howToVerify).toContain("emailCommitment");
  });

  it("does NOT include raw subject identifiers (only commitments)", async () => {
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify({
          schema: "vaos-deletion-event-v1",
          ts: "2026-05-19T00:00:00.000Z",
          ticketId: VALID_TICKET,
          subjectKind: "user",
          subjectCommitment: "a".repeat(64),
          emailCommitment: "b".repeat(64),
          legalBasis: "gdpr-art-17",
          requestedByCommitment: "d".repeat(64),
          summary: { totalTables: 0, succeeded: 0, failed: 0 },
          summaryHash: "c".repeat(64),
        }),
        createdAt: new Date(),
      },
    ]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: VALID_TICKET }),
    });
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toMatch(/user_[A-Za-z0-9]{20,}/);
  });

  it("handles malformed details JSON gracefully", async () => {
    dbLimitMock.mockReturnValue([
      { details: "{not-valid", createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: VALID_TICKET }),
    });
    expect(res.status).toBe(404);
  });

  it("sets open CORS for regulator/subject access", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ ticketId: VALID_TICKET }),
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
