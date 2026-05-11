/**
 * Tests for the verify-ai-receipts GitHub Action.
 *
 * The action's job is high-stakes: it can fail a CI build. Pin every
 * branch of the input parser, the URL/host whitelist, and the
 * verification round-trip.
 *
 * Properties pinned:
 *   - extractReceiptIds: rejects cross-origin URLs (SSRF defense)
 *   - extractReceiptIds: matches /r/<id> AND /api/agent-runs/<id>
 *   - extractReceiptIds: matches bare hex IDs in free-form text
 *   - extractReceiptIds: deduplicates
 *   - validateHost rejects non-https (except localhost)
 *   - verifyOne handles network error, 404, malformed receipt,
 *     successful verify, signature-mismatch verify
 *   - run() aggregates all three input sources without double-counting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractReceiptIds, verifyOne, run } from "../index";

const HOST = "https://sovereignmatrix.agency";
const ID_A = "00000000-0000-0000-0000-000000000abc";
const ID_B = "11111111-1111-1111-1111-000000000def";

describe("extractReceiptIds", () => {
  it("matches /r/<id> URLs from the verifier host", () => {
    const text = `Verify this receipt: ${HOST}/r/${ID_A} please.`;
    expect(extractReceiptIds(text, HOST)).toEqual([ID_A]);
  });

  it("matches /api/agent-runs/<id> URLs", () => {
    const text = `Direct API: ${HOST}/api/agent-runs/${ID_A}`;
    expect(extractReceiptIds(text, HOST)).toEqual([ID_A]);
  });

  it("rejects URLs from a different origin (SSRF defense)", () => {
    const text = `Sneaky: https://attacker.example/r/${ID_A}`;
    expect(extractReceiptIds(text, HOST)).toEqual([]);
  });

  it("rejects URLs from a same-host different-protocol port mismatch", () => {
    const text = `Port shift: http://sovereignmatrix.agency:8080/r/${ID_A}`;
    expect(extractReceiptIds(text, HOST)).toEqual([]);
  });

  it("matches bare hex IDs in free-form text", () => {
    const text = `Receipt ${ID_A} verified by hand.`;
    expect(extractReceiptIds(text, HOST)).toEqual([ID_A]);
  });

  it("deduplicates IDs found via multiple paths", () => {
    const text = `${HOST}/r/${ID_A} and also ${ID_A} and ${HOST}/api/agent-runs/${ID_A}/proof`;
    expect(extractReceiptIds(text, HOST)).toEqual([ID_A]);
  });

  it("ignores non-receipt-ID hex strings (too short / wrong shape)", () => {
    const text = `commit deadbeef and id ${ID_A}`;
    expect(extractReceiptIds(text, HOST)).toEqual([ID_A]);
  });

  it("returns multiple IDs when several are present", () => {
    const text = `${HOST}/r/${ID_A} | ${HOST}/r/${ID_B}`;
    const out = extractReceiptIds(text, HOST).sort();
    expect(out).toEqual([ID_A, ID_B].sort());
  });

  it("throws on malformed verifier host", () => {
    expect(() => extractReceiptIds(`anything`, "not a url")).toThrow();
  });

  it("throws on http:// non-localhost verifier host", () => {
    expect(() =>
      extractReceiptIds(`anything`, "http://sovereignmatrix.agency"),
    ).toThrow();
  });

  it("allows localhost http:// for testing", () => {
    expect(() =>
      extractReceiptIds(`anything`, "http://localhost:3000"),
    ).not.toThrow();
  });
});

describe("verifyOne", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it("returns 'verified' when /api/verify says valid:true", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ canonical: "{}", signature: "v1=ff" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true }), { status: 200 }),
      );
    const r = await verifyOne(ID_A, HOST, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe("verified");
  });

  it("returns 'invalid' when /api/verify says valid:false", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ canonical: "{}", signature: "v1=ff" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: false }), { status: 200 }),
      );
    const r = await verifyOne(ID_A, HOST, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe("invalid");
  });

  it("returns 'unreachable' on 404 (private receipt or missing)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    const r = await verifyOne(ID_A, HOST, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe("unreachable");
    expect(r.error).toMatch(/404/);
  });

  it("returns 'unreachable' on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const r = await verifyOne(ID_A, HOST, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe("unreachable");
    expect(r.error).toMatch(/ECONNREFUSED/);
  });

  it("returns 'unreachable' when receipt JSON is missing canonical/signature", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: ID_A }), { status: 200 }),
    );
    const r = await verifyOne(ID_A, HOST, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe("unreachable");
  });

  it("returns 'unreachable' when /api/verify is non-200", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ canonical: "{}", signature: "v1=ff" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("nope", { status: 503 }));
    const r = await verifyOne(ID_A, HOST, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe("unreachable");
    expect(r.error).toMatch(/503/);
  });
});

describe("run() — aggregation", () => {
  it("dedupes across receipt-ids, receipt-urls, and text", async () => {
    // We don't care about verification outcome here — just dedup.
    // Stub global fetch with a 404 for everything so we land in
    // "unreachable" cleanly.
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response("nope", { status: 404 })) as
      | typeof fetch
      | typeof global.fetch;
    try {
      const outcome = await run({
        receiptIds: [ID_A],
        receiptUrls: [`${HOST}/r/${ID_A}`],
        text: `Mention again: ${HOST}/r/${ID_A} and ${ID_B}`,
        verifierHost: HOST,
        failOnInvalid: false,
        failOnZero: false,
      });
      expect(outcome.total).toBe(2);
      expect(new Set(outcome.ids)).toEqual(new Set([ID_A, ID_B]));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns 0/0/0 totals when no IDs are supplied", async () => {
    const outcome = await run({
      receiptIds: [],
      receiptUrls: [],
      text: "",
      verifierHost: HOST,
      failOnInvalid: true,
      failOnZero: false,
    });
    expect(outcome.total).toBe(0);
    expect(outcome.verified).toBe(0);
    expect(outcome.invalid).toBe(0);
  });

  it("rejects malformed receipt IDs from input rather than calling them", async () => {
    const fetchSpy = vi.fn(
      async () => new Response("never called", { status: 200 }),
    );
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const outcome = await run({
        receiptIds: ["not-a-valid-id", "<script>alert(1)</script>", ""],
        receiptUrls: [],
        text: "",
        verifierHost: HOST,
        failOnInvalid: false,
        failOnZero: false,
      });
      expect(outcome.total).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
