/**
 * Tests for GET /api/agent-runs/latest-public — single freshest public receipt.
 *
 * Properties pinned:
 *   - Only enumerates visibility=public (NOT unlisted — share-by-link
 *     contract violation per security review)
 *   - Returns { receipt: null, reason: "no-public-receipts-yet" } on empty
 *   - Returns { receipt: null, reason: "unavailable" } on DB error
 *   - Echoes id, agent, canonical, signature on success
 *   - Open CORS + cache hints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

let mockSelectRows: { id: string }[] = [];
let mockSelectThrows = false;
let mockGetRunReturn: ReturnType<typeof makeRun> | null = null;

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-00000000abcd",
    userId: "user_x",
    tenantId: null,
    agentName: "blog-gen",
    modelUsed: "claude-sonnet-4-6",
    input: { topic: "x" },
    output: { html: "<p>hi</p>" },
    safetyResult: { jailbreak: "pass" },
    durationMs: 1000,
    chainDepth: 0,
    trustDecision: "auto-approved",
    visibility: "public" as const,
    signature: "v1=deadbeef",
    createdAt: new Date("2026-05-10T00:00:00Z"),
    ...overrides,
  };
}

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/agent-runs", () => ({
  getRun: vi.fn(async () => mockGetRunReturn),
  canonicalizeRun: vi.fn(() => '{"v":1,"canonical":"projection"}'),
}));

vi.mock("@/db", () => {
  const chain: {
    select: () => typeof chain;
    from: () => typeof chain;
    where: () => typeof chain;
    orderBy: () => typeof chain;
    limit: (n: number) => Promise<{ id: string }[]>;
  } = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => {
      if (mockSelectThrows) return Promise.reject(new Error("db down"));
      return Promise.resolve(mockSelectRows);
    },
  };
  return { db: chain };
});

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/agent-runs/latest-public/route");
}

describe("GET /api/agent-runs/latest-public", () => {
  beforeEach(() => {
    mockSelectRows = [];
    mockSelectThrows = false;
    mockGetRunReturn = null;
  });

  it("returns null receipt + no-public-receipts-yet when none exist", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receipt).toBeNull();
    expect(body.reason).toBe("no-public-receipts-yet");
  });

  it("returns null receipt + unavailable on DB error — never crashes", async () => {
    mockSelectThrows = true;
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receipt).toBeNull();
    expect(body.reason).toBe("unavailable");
  });

  it("returns canonical+signature for the freshest public receipt", async () => {
    mockSelectRows = [{ id: "00000000-0000-0000-0000-00000000abcd" }];
    mockGetRunReturn = makeRun();
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();
    expect(body.receipt).toMatchObject({
      id: "00000000-0000-0000-0000-00000000abcd",
      agent: "blog-gen",
      canonical: '{"v":1,"canonical":"projection"}',
      signature: "v1=deadbeef",
    });
  });

  it("handles a race where the id is returned but the row was deleted before getRun", async () => {
    mockSelectRows = [{ id: "00000000-0000-0000-0000-00000000abcd" }];
    mockGetRunReturn = null;
    const { GET } = await loadRoute();
    const res = await GET();
    const body = await res.json();
    expect(body.receipt).toBeNull();
    expect(body.reason).toBe("race-deleted");
  });

  it("returns CORS + cache hints", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("s-maxage=30");
  });

  it("OPTIONS preflight returns 204", async () => {
    const { OPTIONS } = await loadRoute();
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});
