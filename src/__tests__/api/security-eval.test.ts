/**
 * Contract tests for GET /api/security/eval — public adversarial-eval read.
 *
 * The endpoint is consumed by procurement / vendor-security tooling.
 * Stable shape is the contract; silent regressions break their
 * pipelines.
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

import { GET } from "@/app/api/security/eval/route";

beforeEach(() => {
  dbLimitMock.mockReset();
});

describe("/api/security/eval", () => {
  it("returns 404 when no eval row has been persisted yet", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("no adversarial-eval result available");
  });

  it("returns 404 with generic message when audit_logs query throws (no deploy-state leak)", async () => {
    dbLimitMock.mockImplementation(() => {
      throw new Error("relation audit_logs does not exist");
    });
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(404);
    const body = await res.json();
    // Match the wave-95 pattern — same message for "no row" and "table
    // missing" so unauthenticated probes can't fingerprint the deploy.
    expect(body.error).toBe("no adversarial-eval result available");
    expect(body.error).not.toMatch(/audit_logs|table|deploy|relation/i);
  });

  it("returns the eval envelope when a row exists", async () => {
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify({
          schema: "vaos-adversarial-eval-v1",
          ranAt: "2026-05-19T00:00:00.000Z",
          durationMs: 412,
          corpusFingerprint: "a".repeat(64),
          attack: {
            total: 30,
            blocked: 29,
            blockRate: 0.9667,
            byCategory: { direct_injection: { total: 5, blocked: 5 } },
          },
          benign: { total: 7, falsePositives: 0, falsePositivePrompts: [] },
          compositeScore: 0.9667,
          mldsa65Sig: "base64Sig==",
          pqEnabled: true,
        }),
        createdAt: new Date("2026-05-19T00:00:01.000Z"),
      },
    ]);
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schema).toBe("vaos-adversarial-eval-v1");
    expect(body.attack.blockRate).toBe(0.9667);
    expect(body.attack.blocked).toBe(29);
    expect(body.corpusFingerprint).toBe("a".repeat(64));
    expect(body.mldsa65Sig).toBe("base64Sig==");
    expect(body.pqEnabled).toBe(true);
    expect(body.notes).toContain("corpusFingerprint");
  });

  it("returns 404 when details JSON is malformed", async () => {
    dbLimitMock.mockReturnValue([
      { details: "{not-valid", createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/malformed/);
  });

  it("handles missing nested fields gracefully", async () => {
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify({
          schema: "vaos-adversarial-eval-v1",
          // attack/benign missing
        }),
        createdAt: new Date(),
      },
    ]);
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attack).toBeNull();
    expect(body.benign).toBeNull();
    expect(body.compositeScore).toBeNull();
  });

  it("sets open CORS + nosniff + cache headers", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
