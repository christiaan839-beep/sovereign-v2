/**
 * Tests for src/lib/audit-log-anchor.ts — OpenTimestamps anchor of the
 * audit-log chain head. Every test is hermetic (no real OTS calendar
 * contact); the OtsClient is mocked.
 */
import { describe, it, expect, vi } from "vitest";
import {
  anchorChainHead,
  digestForAnchor,
  makeOtsCalendarClient,
  DEFAULT_OTS_CALENDARS,
  type OtsClient,
} from "@/lib/audit-log-anchor";

const VALID_HEAD = "a".repeat(64); // any 64-char hex string passes the shape check

function makeClient(name: string, opts: { fail?: boolean } = {}): OtsClient {
  return {
    name,
    submit: vi.fn(async (digest: string) => {
      if (opts.fail) throw new Error(`${name} rejected`);
      // Return a deterministic fake proof so the test asserts proof
      // pass-through end-to-end.
      return `fake-proof-of-${digest.slice(0, 8)}-by-${name}`;
    }),
  };
}

describe("anchorChainHead", () => {
  it("throws when the chain head isn't 64-char hex", async () => {
    await expect(
      anchorChainHead("not-hex", [makeClient("alice")]),
    ).rejects.toThrow(/64-char hex/);
  });

  it("returns ok:false with no proofs when no calendars are configured", async () => {
    const r = await anchorChainHead(VALID_HEAD, []);
    expect(r.ok).toBe(false);
    expect(r.proofs).toEqual([]);
    expect(r.failures).toEqual([]);
    expect(r.digest).toBe(VALID_HEAD);
  });

  it("collects proofs from every successful calendar", async () => {
    const a = makeClient("alice");
    const b = makeClient("bob");
    const r = await anchorChainHead(VALID_HEAD, [a, b]);
    expect(r.ok).toBe(true);
    expect(r.proofs.map((p) => p.calendar).sort()).toEqual(["alice", "bob"]);
    expect(r.failures).toEqual([]);
    expect(a.submit).toHaveBeenCalledWith(VALID_HEAD);
    expect(b.submit).toHaveBeenCalledWith(VALID_HEAD);
  });

  it("tolerates partial calendar failure (ok=true with mixed results)", async () => {
    const a = makeClient("alice");
    const fail = makeClient("flaky", { fail: true });
    const r = await anchorChainHead(VALID_HEAD, [a, fail]);
    expect(r.ok).toBe(true);
    expect(r.proofs).toHaveLength(1);
    expect(r.proofs[0].calendar).toBe("alice");
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].calendar).toBe("flaky");
    expect(r.failures[0].reason).toMatch(/flaky rejected/);
  });

  it("returns ok:false when every calendar fails", async () => {
    const r = await anchorChainHead(VALID_HEAD, [
      makeClient("a", { fail: true }),
      makeClient("b", { fail: true }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.proofs).toEqual([]);
    expect(r.failures).toHaveLength(2);
  });

  it("stamps a single attestedAt timestamp across the batch", async () => {
    const r = await anchorChainHead(VALID_HEAD, [
      makeClient("a"),
      makeClient("b"),
    ]);
    expect(r.attestedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    // Every proof's submittedAt equals the batch attestedAt.
    for (const p of r.proofs) {
      expect(p.submittedAt).toBe(r.attestedAt);
    }
  });
});

describe("digestForAnchor", () => {
  it("returns a deterministic 64-char hex SHA-256", () => {
    const a = digestForAnchor("chain-head-1");
    const b = digestForAnchor("chain-head-1");
    const c = digestForAnchor("chain-head-2");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("makeOtsCalendarClient", () => {
  it("POSTs the 32-byte digest to <calendar>/digest", async () => {
    const fetchSpy = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        }) as unknown as Response,
    );
    const c = makeOtsCalendarClient("https://example.org", {
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    const proof = await c.submit(VALID_HEAD);
    expect(proof).toBe(Buffer.from([1, 2, 3, 4]).toString("base64"));

    const url = fetchSpy.mock.calls[0][0];
    expect(url).toBe("https://example.org/digest");

    const init = fetchSpy.mock.calls[0][1];
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toMatch(/opentimestamps/);
    expect(init.body).toBeInstanceOf(Buffer);
    expect((init.body as Buffer).length).toBe(32);
  });

  it("rejects a non-32-byte digest", async () => {
    const c = makeOtsCalendarClient("https://example.org", {
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(c.submit("deadbeef")).rejects.toThrow(/32 bytes/);
  });

  it("throws on non-2xx calendar response", async () => {
    const fetchSpy = vi.fn(
      async () => ({ ok: false, status: 502 }) as unknown as Response,
    );
    const c = makeOtsCalendarClient("https://example.org", {
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    await expect(c.submit(VALID_HEAD)).rejects.toThrow(/HTTP 502/);
  });

  it("strips trailing slash on the calendar URL", async () => {
    const fetchSpy = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(0),
        }) as unknown as Response,
    );
    const c = makeOtsCalendarClient("https://example.org/", {
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    await c.submit(VALID_HEAD);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://example.org/digest");
  });
});

describe("DEFAULT_OTS_CALENDARS", () => {
  it("lists at least 2 distinct public calendars (redundancy)", () => {
    expect(DEFAULT_OTS_CALENDARS.length).toBeGreaterThanOrEqual(2);
    const unique = new Set<string>(DEFAULT_OTS_CALENDARS);
    expect(unique.size).toBe(DEFAULT_OTS_CALENDARS.length);
    for (const url of DEFAULT_OTS_CALENDARS) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});
