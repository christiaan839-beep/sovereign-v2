/**
 * Tests for src/app/api/v1/audit/head/route.ts — public audit-chain
 * head endpoint (Move 16).
 *
 * Coverage:
 *   - Empty chain returns 200 chainEstablished:false (not 5xx)
 *   - Established chain returns rowHash + rowN + signedAt
 *   - X-Audit-Chain-Head header mirrors body
 *   - DB failure returns 503 with safe error shape (no stack)
 *   - CORS open + Cache-Control max-age=60
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadAuditChainHead = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: new Map(Object.entries(init?.headers ?? {})),
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/audit-log", () => ({
  readAuditChainHead: () => mockReadAuditChainHead(),
}));

import { GET } from "@/app/api/v1/audit/head/route";

describe("/api/v1/audit/head — public anchor for tamper-evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("empty chain → 200 chainEstablished:false (not 5xx)", async () => {
    mockReadAuditChainHead.mockResolvedValue(null);
    const res = (await GET()) as unknown as {
      status: number;
      body: { chainEstablished: boolean; rowN: number; rowHash: null };
    };
    expect(res.status).toBe(200);
    expect(res.body.chainEstablished).toBe(false);
    expect(res.body.rowN).toBe(0);
    expect(res.body.rowHash).toBe(null);
  });

  it("established chain → 200 with rowHash + rowN + signedAt + verify hints", async () => {
    mockReadAuditChainHead.mockResolvedValue({
      rowHash: "a".repeat(64),
      prevHash: "b".repeat(64),
      rowN: 12345,
      signedAt: "2026-04-30T12:00:00.000Z",
    });
    const res = (await GET()) as unknown as {
      status: number;
      body: {
        chainEstablished: boolean;
        rowHash: string;
        rowN: number;
        signedAt: string;
        verify: { replayEndpoint: string; inspectorCommand: string };
      };
    };
    expect(res.status).toBe(200);
    expect(res.body.chainEstablished).toBe(true);
    expect(res.body.rowHash).toBe("a".repeat(64));
    expect(res.body.rowN).toBe(12345);
    expect(res.body.signedAt).toBe("2026-04-30T12:00:00.000Z");
    expect(res.body.verify.replayEndpoint).toContain("/api/v1/verify/audit-chain");
    expect(res.body.verify.inspectorCommand).toContain("sovereign-inspect");
  });

  it("X-Audit-Chain-Head header mirrors body.rowHash", async () => {
    mockReadAuditChainHead.mockResolvedValue({
      rowHash: "c".repeat(64),
      prevHash: "GENESIS",
      rowN: 1,
      signedAt: "2026-04-30T12:00:00.000Z",
    });
    const res = (await GET()) as unknown as {
      headers: Map<string, string>;
      body: { rowHash: string };
    };
    expect(res.headers.get("X-Audit-Chain-Head")).toBe(res.body.rowHash);
    expect(res.headers.get("X-Audit-Chain-Row-N")).toBe("1");
  });

  it("CORS allows any origin", async () => {
    mockReadAuditChainHead.mockResolvedValue(null);
    const res = (await GET()) as unknown as { headers: Map<string, string> };
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("Cache-Control max-age=60 (anchor stable for 1 min)", async () => {
    mockReadAuditChainHead.mockResolvedValue({
      rowHash: "d".repeat(64),
      prevHash: "GENESIS",
      rowN: 1,
      signedAt: "2026-04-30T12:00:00.000Z",
    });
    const res = (await GET()) as unknown as { headers: Map<string, string> };
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("max-age=60");
  });

  it("DB error → 503 with safe error shape (no stack trace leaked)", async () => {
    mockReadAuditChainHead.mockRejectedValue(new Error("connection refused"));
    const res = (await GET()) as unknown as {
      status: number;
      body: { error: string; details: string };
    };
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("audit_head_unavailable");
    expect(res.body.details).not.toContain("connection refused");
  });
});
