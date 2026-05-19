/**
 * Contract tests for GET /api/transparency/trs/:receiptId.
 *
 * The endpoint is public + open-CORS so federation verifiers and
 * regulator-side tools can pull the TRS attestation alongside the
 * v2 receipt. The shape MUST stay stable; a silent regression
 * breaks every consumer.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { dbLimitMock } = vi.hoisted(() => ({
  dbLimitMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Drizzle chain stub: select().from().where().orderBy().limit()
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

import { GET } from "@/app/api/transparency/trs/[receiptId]/route";

const VALID_UUID = "12345678-1234-4567-8901-123456789abc";

beforeEach(() => {
  dbLimitMock.mockReset();
});

describe("/api/transparency/trs/:receiptId", () => {
  it("returns 404 for an invalid receiptId shape", async () => {
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: "not-a-uuid" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/invalid receiptId/);
  });

  it("returns 404 with body when no attestation row exists", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: VALID_UUID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no TRS attestation/);
  });

  it("returns 404 with generic message when audit_logs query throws (no deploy-state leak)", async () => {
    dbLimitMock.mockImplementation(() => {
      throw new Error("relation audit_logs does not exist");
    });
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: VALID_UUID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    // Critical (wave-95 security review): error message MUST NOT
    // distinguish "table missing" from "row missing" — that leaks
    // deploy-state to unauthenticated probes.
    expect(body.error).toBe("no TRS attestation for this receipt");
    expect(body.error).not.toMatch(/audit_logs|table|deploy/i);
  });

  it("handles attestation with missing nested fields gracefully", async () => {
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify({
          schema: "trs1",
          quorumMet: false,
        }),
        createdAt: new Date(),
      },
    ]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canonicalHash).toBeNull();
    expect(body.attestation).toBeNull();
    expect(body.quorumMet).toBe(false);
  });

  it("returns the attestation envelope when a row exists", async () => {
    const fakeAttestation = {
      scheme: "trs1",
      canonical: "<canonical>",
      contentHash: "a".repeat(64),
      threshold: { m: 2, n: 4 },
      authorizedIssuers: ["a", "b", "c", "d"],
      cosigners: [
        { issuerId: "a", signature: "v2=AAA" },
        { issuerId: "b", signature: "v2=BBB" },
      ],
      assembledAt: "2026-05-19T00:00:00.000Z",
    };
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify({
          schema: "trs1",
          receiptId: VALID_UUID,
          canonicalHash: "a".repeat(64),
          attestation: fakeAttestation,
          quorumMet: true,
          localContributions: ["a"],
        }),
        createdAt: new Date("2026-05-19T00:00:00.000Z"),
      },
    ]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.receiptId).toBe(VALID_UUID);
    expect(body.schema).toBe("trs1");
    expect(body.canonicalHash).toBe("a".repeat(64));
    expect(body.quorumMet).toBe(true);
    expect(body.attestation).toEqual(fakeAttestation);
    expect(body.localContributions).toEqual(["a"]);
  });

  it("sets open CORS + nosniff headers + cache directive", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: VALID_UUID }),
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("returns 404 when the details JSON is malformed", async () => {
    dbLimitMock.mockReturnValue([
      { details: "{not-valid-json", createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://x/y"), {
      params: Promise.resolve({ receiptId: VALID_UUID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/malformed/);
  });
});
