/**
 * Tests for /api/replay/[receiptId] — receipt-driven agent replay.
 *
 * Locks the contract that makes replays trustworthy:
 *   - 400 on malformed receipt id (no DB hit)
 *   - 404 on missing receipt (info-leak guard for private receipts)
 *   - 404 cross-tenant (never reveal a private receipt to a non-owner)
 *   - 410 when the original agent is no longer registered
 *   - 5xx upstream errors are surfaced as 5xx with structured codes
 *   - 200 happy path returns drift + score + diffs + timing
 *
 * `getRun`, `AGENT_REGISTRY`, `detectDrift`, and Clerk `auth` are
 * mocked so the test suite exercises ROUTING + AUTHORIZATION logic
 * only. The drift detector has its own dedicated test suite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/agent-runs", () => ({
  getRun: vi.fn(),
}));
vi.mock("@/lib/drift-detector", () => ({
  detectDrift: vi.fn(),
}));
vi.mock("@/app/api/agents/registry", () => ({
  AGENT_REGISTRY: {} as Record<string, () => Promise<unknown>>,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { POST } from "./route";
import { getRun } from "@/lib/agent-runs";
import { detectDrift } from "@/lib/drift-detector";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { auth } from "@clerk/nextjs/server";

const getRunMock = vi.mocked(getRun);
const detectDriftMock = vi.mocked(detectDrift);
const authMock = vi.mocked(auth);

const VALID_ID = "abcdef0123456789abcdef0123456789";

function makeRequest(): Request {
  return new Request("https://test.local/api/replay/" + VALID_ID, {
    method: "POST",
  });
}

function makeParams(id: string): { params: Promise<{ receiptId: string }> } {
  return { params: Promise.resolve({ receiptId: id }) };
}

beforeEach(() => {
  getRunMock.mockReset();
  detectDriftMock.mockReset();
  authMock.mockReset();
  // Reset registry between tests (mutable for fixture installation)
  for (const k of Object.keys(AGENT_REGISTRY)) delete AGENT_REGISTRY[k];
});

describe("POST /api/replay/[receiptId] — input validation", () => {
  it("rejects a malformed receipt id with 400 BEFORE hitting the DB", async () => {
    const res = await POST(makeRequest(), makeParams("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(getRunMock).not.toHaveBeenCalled();
  });

  it("accepts a valid 32-char hex id and proceeds to lookup", async () => {
    getRunMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(404); // not-found, but we got past validation
    expect(getRunMock).toHaveBeenCalledWith(VALID_ID);
  });
});

describe("POST /api/replay/[receiptId] — receipt resolution", () => {
  it("returns 404 (not 5xx) when the receipt doesn't exist", async () => {
    getRunMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 5xx) when getRun throws — never leaks DB errors", async () => {
    getRunMock.mockRejectedValueOnce(new Error("DB exploded"));
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/replay/[receiptId] — authorization", () => {
  it("allows public receipts without auth", async () => {
    getRunMock.mockResolvedValueOnce({
      id: VALID_ID,
      userId: "owner-1",
      tenantId: "t1",
      agentName: "no-such-agent",
      modelUsed: "test",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public",
      signature: "sig",
      createdAt: new Date(),
    });
    // Agent not in registry → 410
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(410);
    // auth was NOT called for public receipts
    expect(authMock).not.toHaveBeenCalled();
  });

  it("requires auth for unlisted receipts (404 if anonymous)", async () => {
    getRunMock.mockResolvedValueOnce({
      id: VALID_ID,
      userId: "owner-1",
      tenantId: "t1",
      agentName: "no-such-agent",
      modelUsed: "test",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "unlisted",
      signature: "sig",
      createdAt: new Date(),
    });
    authMock.mockResolvedValueOnce({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("blocks cross-tenant access on private receipts with 404 (info-leak guard)", async () => {
    getRunMock.mockResolvedValueOnce({
      id: VALID_ID,
      userId: "owner-1",
      tenantId: "t1",
      agentName: "no-such-agent",
      modelUsed: "test",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "sig",
      createdAt: new Date(),
    });
    authMock.mockResolvedValueOnce({ userId: "different-user" } as Awaited<
      ReturnType<typeof auth>
    >);
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("allows the owner to replay their own private receipt", async () => {
    getRunMock.mockResolvedValueOnce({
      id: VALID_ID,
      userId: "owner-1",
      tenantId: "t1",
      agentName: "no-such-agent",
      modelUsed: "test",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "sig",
      createdAt: new Date(),
    });
    authMock.mockResolvedValueOnce({ userId: "owner-1" } as Awaited<
      ReturnType<typeof auth>
    >);
    // Agent not in registry → 410 (auth passed, just no agent)
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(410);
  });
});

describe("POST /api/replay/[receiptId] — agent dispatch", () => {
  function publicReceipt(agentName: string) {
    return {
      id: VALID_ID,
      userId: null,
      tenantId: null,
      agentName,
      modelUsed: "test",
      input: { foo: "bar" },
      output: { ok: true, answer: "original" },
      safetyResult: {},
      durationMs: 100,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public" as const,
      signature: "sig",
      createdAt: new Date(),
    };
  }

  it("returns 410 when the original agent is no longer registered", async () => {
    getRunMock.mockResolvedValueOnce(publicReceipt("retired-agent"));
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(410);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("AGENT_RETIRED");
  });

  it("returns 500 when the agent module fails to load", async () => {
    getRunMock.mockResolvedValueOnce(publicReceipt("broken-loader"));
    AGENT_REGISTRY["broken-loader"] = () =>
      Promise.reject(new Error("module load failed"));
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("LOAD_FAILED");
  });

  it("returns 500 when the loaded module has no POST export", async () => {
    getRunMock.mockResolvedValueOnce(publicReceipt("no-handler"));
    AGENT_REGISTRY["no-handler"] = () => Promise.resolve({});
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NO_HANDLER");
  });

  it("returns 502 when the upstream agent returns non-2xx", async () => {
    getRunMock.mockResolvedValueOnce(publicReceipt("flaky-agent"));
    AGENT_REGISTRY["flaky-agent"] = () =>
      Promise.resolve({
        POST: async () =>
          new Response(JSON.stringify({ error: "rate limited" }), {
            status: 429,
          }),
      });
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string; replayStatus: number };
    expect(body.code).toBe("REPLAY_NON_2XX");
    expect(body.replayStatus).toBe(429);
  });

  it("returns 500 when the agent throws during invocation", async () => {
    getRunMock.mockResolvedValueOnce(publicReceipt("throwing-agent"));
    AGENT_REGISTRY["throwing-agent"] = () =>
      Promise.resolve({
        POST: async () => {
          throw new Error("boom");
        },
      });
    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVOCATION_FAILED");
  });
});

describe("POST /api/replay/[receiptId] — happy path", () => {
  it("returns drift report with score + diffs + timing on success", async () => {
    const receipt = {
      id: VALID_ID,
      userId: null,
      tenantId: null,
      agentName: "happy-agent",
      modelUsed: "nemotron-3-super",
      input: { question: "What is 2+2?" },
      output: { ok: true, answer: "4" },
      safetyResult: {},
      durationMs: 120,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public" as const,
      signature: "sig",
      createdAt: new Date("2026-01-01"),
    };
    getRunMock.mockResolvedValueOnce(receipt);
    AGENT_REGISTRY["happy-agent"] = () =>
      Promise.resolve({
        POST: async () =>
          new Response(JSON.stringify({ ok: true, answer: "4" }), {
            status: 200,
          }),
      });
    detectDriftMock.mockReturnValueOnce({
      score: { hash: 1, structural: 1, semantic: null, overall: 1 },
      drifted: false,
      summary: "Outputs are byte-identical (deterministic match).",
      diffs: [],
    });

    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      receiptId: string;
      agentName: string;
      drifted: boolean;
      score: { overall: number };
      diffs: unknown[];
      timing: { originalMs: number; replayMs: number };
      original: { output: { answer: string } };
      replay: { output: { answer: string } };
    };
    expect(body.ok).toBe(true);
    expect(body.receiptId).toBe(VALID_ID);
    expect(body.agentName).toBe("happy-agent");
    expect(body.drifted).toBe(false);
    expect(body.score.overall).toBe(1);
    expect(body.original.output.answer).toBe("4");
    expect(body.replay.output.answer).toBe("4");
    expect(body.timing.originalMs).toBe(120);
    expect(typeof body.timing.replayMs).toBe("number");
  });

  it("flags drift when detector returns drifted=true", async () => {
    const receipt = {
      id: VALID_ID,
      userId: null,
      tenantId: null,
      agentName: "drifty-agent",
      modelUsed: "nemotron-3-super",
      input: { question: "What is 2+2?" },
      output: { ok: true, answer: "4" },
      safetyResult: {},
      durationMs: 120,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public" as const,
      signature: "sig",
      createdAt: new Date("2026-01-01"),
    };
    getRunMock.mockResolvedValueOnce(receipt);
    AGENT_REGISTRY["drifty-agent"] = () =>
      Promise.resolve({
        POST: async () =>
          new Response(JSON.stringify({ ok: true, answer: "five" }), {
            status: 200,
          }),
      });
    detectDriftMock.mockReturnValueOnce({
      score: { hash: 0, structural: 1, semantic: 0.4, overall: 0.62 },
      drifted: true,
      summary: "Drift detected.",
      diffs: [
        {
          path: "$.answer",
          kind: "value-changed",
          before: "4",
          after: "five",
        },
      ],
    });

    const res = await POST(makeRequest(), makeParams(VALID_ID));
    expect(res.status).toBe(200); // 200 — drift is data, not an error
    const body = (await res.json()) as {
      drifted: boolean;
      diffs: { path: string }[];
    };
    expect(body.drifted).toBe(true);
    expect(body.diffs).toHaveLength(1);
    expect(body.diffs[0].path).toBe("$.answer");
  });
});
