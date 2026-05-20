/**
 * Contract tests for GET /api/cron/audit-retention.
 *
 * Locks the auth gate + response shape. The DELETE behavior itself is
 * tested in src/lib/__tests__/audit-retention.test.ts; this file
 * focuses on the cron route's auth + serialization contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { runMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/audit-retention", () => ({
  runRetentionCycle: runMock,
}));

import { GET } from "@/app/api/cron/audit-retention/route";

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  runMock.mockReset();
  process.env.CRON_SECRET = "test-cron-secret-32-chars-or-more-please";
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

function makeReq(suppliedSecret?: string): Request {
  const headers: Record<string, string> = {};
  if (suppliedSecret !== undefined) {
    headers["x-cron-secret"] = suppliedSecret;
  }
  return new Request("http://localhost/api/cron/audit-retention", {
    method: "GET",
    headers,
  });
}

describe("/api/cron/audit-retention — auth", () => {
  it("401 when CRON_SECRET is unset on the server", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq("anything"));
    expect(res.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("401 when supplied secret is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("401 when supplied secret is wrong (correct length)", async () => {
    const wrong = "a".repeat(process.env.CRON_SECRET!.length);
    const res = await GET(makeReq(wrong));
    expect(res.status).toBe(401);
  });

  it("401 when supplied secret has different length (no length-leak)", async () => {
    const res = await GET(makeReq("short"));
    expect(res.status).toBe(401);
  });

  it("200 when supplied secret matches", async () => {
    runMock.mockResolvedValueOnce({
      startedAt: "2026-05-20T12:00:00.000Z",
      durationMs: 42,
      totalDeleted: 0,
      perAction: [],
    });
    const res = await GET(makeReq(process.env.CRON_SECRET!));
    expect(res.status).toBe(200);
  });
});

describe("/api/cron/audit-retention — response shape", () => {
  it("surfaces per-action metrics from runRetentionCycle", async () => {
    runMock.mockResolvedValueOnce({
      startedAt: "2026-05-20T12:00:00.000Z",
      durationMs: 123,
      totalDeleted: 7,
      perAction: [
        {
          action: "honeypot.signal",
          retentionHours: 24,
          deleted: 4,
          capped: false,
        },
        {
          action: "honeypot.bulletin",
          retentionHours: 168,
          deleted: 3,
          capped: false,
        },
      ],
    });
    const res = await GET(makeReq(process.env.CRON_SECRET!));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalDeleted).toBe(7);
    expect(body.durationMs).toBe(123);
    expect(body.perAction).toHaveLength(2);
    expect(body.perAction[0].action).toBe("honeypot.signal");
  });

  it("does NOT leak the cron secret in the response body or headers", async () => {
    runMock.mockResolvedValueOnce({
      startedAt: "2026-05-20T12:00:00.000Z",
      durationMs: 0,
      totalDeleted: 0,
      perAction: [],
    });
    const res = await GET(makeReq(process.env.CRON_SECRET!));
    const body = await res.text();
    expect(body).not.toContain(process.env.CRON_SECRET!);
    // Defensive: also check headers don't echo it.
    for (const [k, v] of res.headers.entries()) {
      expect(v).not.toContain(process.env.CRON_SECRET!);
      expect(k.toLowerCase()).not.toBe("x-cron-secret");
    }
  });
});
