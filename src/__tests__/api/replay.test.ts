/**
 * Tests for POST /api/agent-runs/[id]/replay — re-run a stored receipt.
 *
 * Covers:
 *   - 401 unauthenticated
 *   - 400 malformed id
 *   - 404 unknown id
 *   - 403 when caller isn't the original owner
 *   - happy path: forwards to /api/_agents/<slug>, stamps replayOf
 *   - strips internal underscored fields, adds _replayedFrom
 *   - 502 when forward fetch throws
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();
const mockGetRun = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));
vi.mock("@/lib/agent-runs", () => ({
  getRun: (...args: unknown[]) => mockGetRun(...args),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const realFetch = globalThis.fetch;

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/agent-runs/[id]/replay/route");
}

const VALID_ID = "00000000-0000-0000-0000-000000000001";

function makeReq(): Request {
  return new Request(`http://localhost/api/agent-runs/${VALID_ID}/replay`, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/agent-runs/[id]/replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://test.local";
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await loadRoute();
    const res = await POST(makeReq(), makeParams(VALID_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed id", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const { POST } = await loadRoute();
    const res = await POST(makeReq(), makeParams("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the original run doesn't exist", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockGetRun.mockResolvedValue(null);
    const { POST } = await loadRoute();
    const res = await POST(makeReq(), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not the owner (visibility doesn't grant replay)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_caller" });
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      agentName: "blog-gen",
      modelUsed: "claude",
      input: { topic: "x" },
      output: {},
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public",
      signature: "v1=abc",
      createdAt: new Date(),
      tenantId: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(makeReq(), makeParams(VALID_ID));
    expect(res.status).toBe(403);
  });

  it("forwards to /api/_agents/<slug> with cleaned input + _replayedFrom", async () => {
    mockAuth.mockResolvedValue({ userId: "u_owner" });
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      agentName: "blog-gen",
      modelUsed: "claude",
      input: { topic: "Original topic", _verifier: { ignore: true } },
      output: {},
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "v1=abc",
      createdAt: new Date(),
      tenantId: null,
    });

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      // Underscored field stripped, parent link added
      expect(body.topic).toBe("Original topic");
      expect(body._verifier).toBeUndefined();
      expect(body._replayedFrom).toBe(VALID_ID);
      return new Response(
        JSON.stringify({
          html: "<p>regenerated</p>",
          _receipt: { id: "new-run-id", signature: "v1=def", url: "/r/new" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { POST } = await loadRoute();
      const res = await POST(makeReq(), makeParams(VALID_ID));
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Replay-Of")).toBe(VALID_ID);
      const body = (await res.json()) as {
        replayOf: { id: string; agentName: string };
      };
      expect(body.replayOf.id).toBe(VALID_ID);
      expect(body.replayOf.agentName).toBe("blog-gen");
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0]![0]).toContain("/api/_agents/blog-gen");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("returns 422 when stored agentName is NOT in the slug registry (SSRF guard)", async () => {
    // Threat model: a poisoned agent_runs row (hand-edited DB, future
    // migration bug) carries an agentName like "../_admin/x" or any slug
    // that doesn't exist in AGENT_SLUGS. The replay route must reject
    // BEFORE forwarding the caller's Cookie/Authorization to an
    // attacker-controlled path.
    mockAuth.mockResolvedValue({ userId: "u_owner" });
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      agentName: "this-agent-does-not-exist-in-the-registry",
      modelUsed: "claude",
      input: { topic: "x" },
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "v1=abc",
      createdAt: new Date(),
      tenantId: null,
    });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      const { POST } = await loadRoute();
      const res = await POST(makeReq(), makeParams(VALID_ID));
      expect(res.status).toBe(422);
      expect(fetchSpy).not.toHaveBeenCalled(); // never reaches the forward
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("returns 503 when neither NEXT_PUBLIC_APP_URL nor VERCEL_URL is set (SSRF guard)", async () => {
    // Threat model: without an env-pinned origin, the previous
    // implementation fell back to request.headers.host — spoofable.
    // The new guard refuses to forward credentials to an unknown origin.
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    mockAuth.mockResolvedValue({ userId: "u_owner" });
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      agentName: "blog-gen",
      modelUsed: "claude",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "v1=abc",
      createdAt: new Date(),
      tenantId: null,
    });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      const { POST } = await loadRoute();
      const res = await POST(makeReq(), makeParams(VALID_ID));
      expect(res.status).toBe(503);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
      process.env.NEXT_PUBLIC_APP_URL = "http://test.local";
    }
  });

  it("returns 502 when forward fetch throws", async () => {
    mockAuth.mockResolvedValue({ userId: "u_owner" });
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      agentName: "blog-gen",
      modelUsed: "claude",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "v1=abc",
      createdAt: new Date(),
      tenantId: null,
    });
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;

    try {
      const { POST } = await loadRoute();
      const res = await POST(makeReq(), makeParams(VALID_ID));
      expect(res.status).toBe(502);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
