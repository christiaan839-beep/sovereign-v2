/**
 * Public API contract tests for @sovereign-matrix/agent-sdk.
 *
 * These tests fix the SDK's externally-visible surface so a published
 * version can never silently drop a method or break call signatures.
 * Every test mocks `fetch` — no network is exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SovereignClient,
  SovereignError,
  verifyReceipt,
  type RunResult,
  type VerifyResult,
} from "../index";

const baseReceipt = {
  receiptId: "rcpt_test_01",
  issuedAt: "2026-05-16T00:00:00.000Z",
  issuer: "sovereignmatrix.agency",
  signature: "v2=Zm9vYmFy",
  contentHash:
    "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
};

function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    body: null,
  })) as unknown as typeof fetch;
}

describe("SovereignClient — construction", () => {
  it("throws SovereignError when apiKey is missing", () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => new SovereignClient({ apiKey: undefined as any }),
    ).toThrow(SovereignError);
  });

  it("throws SovereignError when apiKey is empty string", () => {
    expect(() => new SovereignClient({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("constructs with valid apiKey", () => {
    const sov = new SovereignClient({ apiKey: "sk_test" });
    expect(sov).toBeInstanceOf(SovereignClient);
  });

  it("trims trailing slash on baseUrl", () => {
    const fetchImpl = mockFetch({ verified: true });
    const sov = new SovereignClient({
      apiKey: "sk_test",
      baseUrl: "https://staging.sov.example/",
      fetchImpl,
    });
    // Use the client to make a call, then inspect the URL.
    void sov.verifyReceipt("rcpt_x");
    // First arg to fetch is the URL — assert no double-slash before /api.
    const url = (fetchImpl as unknown as { mock: { calls: string[][] } }).mock
      .calls[0][0];
    expect(url).toBe("https://staging.sov.example/api/verify?id=rcpt_x");
  });
});

describe("SovereignClient.runAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the server response as RunResult", async () => {
    const want: RunResult = {
      output: { headline: "ICP defined" },
      receipt: { ...baseReceipt, verified: true },
      usage: {
        inputTokens: 100,
        outputTokens: 200,
        model: "claude-sonnet-4-6",
      },
    };
    const sov = new SovereignClient({
      apiKey: "sk_test",
      fetchImpl: mockFetch(want),
    });
    const got = await sov.runAgent("lead-blitz", { icp: "founders" });
    expect(got).toEqual(want);
  });

  it("URL-encodes the agent slug", async () => {
    const fetchImpl = mockFetch({ output: {}, receipt: baseReceipt });
    const sov = new SovereignClient({ apiKey: "sk_test", fetchImpl });
    await sov.runAgent("agent/with slash", {});
    const url = (fetchImpl as unknown as { mock: { calls: string[][] } }).mock
      .calls[0][0];
    expect(url).toContain("/api/agents/agent%2Fwith%20slash");
  });

  it("sends Bearer authorization header", async () => {
    const fetchImpl = mockFetch({ output: {}, receipt: baseReceipt });
    const sov = new SovereignClient({ apiKey: "sk_my_token", fetchImpl });
    await sov.runAgent("x", {});
    const init = (
      fetchImpl as unknown as {
        mock: { calls: [string, RequestInit][] };
      }
    ).mock.calls[0][1];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk_my_token");
  });

  it("throws SovereignError with network kind on HTTP error", async () => {
    const sov = new SovereignClient({
      apiKey: "sk_test",
      fetchImpl: mockFetch({ error: "unauthorized" }, 401),
    });
    await expect(sov.runAgent("x", {})).rejects.toBeInstanceOf(SovereignError);
    await expect(sov.runAgent("x", {})).rejects.toMatchObject({
      kind: "network",
      status: 401,
    });
  });

  it("throws SovereignError with protocol kind on non-JSON response", async () => {
    const sov = new SovereignClient({
      apiKey: "sk_test",
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<!DOCTYPE html><html>bad gateway</html>",
        json: async () => {
          throw new Error("not json");
        },
        body: null,
      })) as unknown as typeof fetch,
    });
    await expect(sov.runAgent("x", {})).rejects.toMatchObject({
      kind: "protocol",
    });
  });
});

describe("SovereignClient.verifyReceipt", () => {
  it("hits /api/verify with the encoded id", async () => {
    const fetchImpl = mockFetch({
      verified: true,
      scheme: "ed25519",
      receipt: baseReceipt,
    } satisfies VerifyResult);
    const sov = new SovereignClient({ apiKey: "sk_test", fetchImpl });
    const r = await sov.verifyReceipt("rcpt with space");
    expect(r.verified).toBe(true);
    expect(r.scheme).toBe("ed25519");
    const url = (fetchImpl as unknown as { mock: { calls: string[][] } }).mock
      .calls[0][0];
    expect(url).toContain("id=rcpt%20with%20space");
  });
});

describe("verifyReceipt (standalone helper)", () => {
  it("works without a client (no API key required)", async () => {
    const fetchImpl = mockFetch({
      verified: true,
      scheme: "ed25519",
      receipt: baseReceipt,
    });
    const r = await verifyReceipt("rcpt_abc", { fetchImpl });
    expect(r.verified).toBe(true);
  });

  it("uses production base URL by default", async () => {
    const fetchImpl = mockFetch({ verified: true, receipt: baseReceipt });
    await verifyReceipt("rcpt_abc", { fetchImpl });
    const url = (fetchImpl as unknown as { mock: { calls: string[][] } }).mock
      .calls[0][0];
    expect(url).toContain("https://sovereignmatrix.agency/api/verify");
  });

  it("throws SovereignError on HTTP failure", async () => {
    await expect(
      verifyReceipt("rcpt_abc", {
        fetchImpl: mockFetch({ error: "not found" }, 404),
      }),
    ).rejects.toBeInstanceOf(SovereignError);
  });
});

describe("SovereignError", () => {
  it("carries kind and status", () => {
    const err = new SovereignError("boom", "network", 502);
    expect(err.name).toBe("SovereignError");
    expect(err.kind).toBe("network");
    expect(err.status).toBe(502);
    expect(err.message).toBe("boom");
  });
});
