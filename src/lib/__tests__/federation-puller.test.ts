/**
 * Tests for src/lib/federation-puller.ts.
 *
 * Locks the trust guarantees in code:
 *   - HTTPS-only peer URLs
 *   - SSRF guard rejects internal IPs
 *   - Per-peer timeout doesn't stall the cycle
 *   - TTL filter respected (expired peer bulletins dropped)
 *   - Shape validation drops malformed bulletins
 *   - MAX_BULLETINS_PER_PULL + MAX_FINGERPRINTS_PER_CYCLE caps enforced
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Mock the DNS resolver used by the wave-102 H1 fix. In tests we
// pretend every test hostname resolves to a public IP so the
// network safety / shape tests can exercise the post-DNS path.
// Specific tests for "resolved to private IP" can override per-call.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => ({ address: "8.8.8.8", family: 4 })),
}));

import {
  isValidPeerUrl,
  fetchPeerFeed,
  filterValidBulletins,
  extractFingerprintIds,
  resolvedHostIsSafe,
  runPullCycle,
  getConfiguredPeers,
  isStrictVerifyEnabled,
  verifyBulletinSig,
  MAX_BULLETINS_PER_PULL,
  MAX_FINGERPRINTS_PER_CYCLE,
  MAX_FEED_BYTES,
} from "../federation-puller";
import {
  extractAttackFingerprint,
  type AttackFingerprint,
} from "../attack-fingerprint";
import type { FederationBulletin } from "../federation-bulletin";

const originalFetch = globalThis.fetch;
const originalEnv = process.env.FEDERATION_PEERS;

beforeEach(() => {
  delete process.env.FEDERATION_PEERS;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv === undefined) {
    delete process.env.FEDERATION_PEERS;
  } else {
    process.env.FEDERATION_PEERS = originalEnv;
  }
});

function fp(payload = "x"): AttackFingerprint {
  return extractAttackFingerprint({
    request: new Request("https://x.com/y", { method: "GET" }),
    attackClass: "jailbreak-prompt",
    severity: 90,
    payload,
  });
}

function bulletin(
  fingerprints: AttackFingerprint[],
  opts: {
    expiresAt?: string;
    schema?: string;
    issuerId?: string;
  } = {},
): FederationBulletin {
  return {
    schema: (opts.schema ??
      "vaos-honeypot-bulletin-v1") as "vaos-honeypot-bulletin-v1",
    issuedAt: new Date().toISOString(),
    expiresAt: opts.expiresAt ?? new Date(Date.now() + 3600_000).toISOString(),
    issuerId: opts.issuerId ?? "peer_a",
    fingerprints,
    contentHash: "c".repeat(64),
    mldsa65Sig: null,
    pqEnabled: false,
  };
}

describe("resolvedHostIsSafe — DNS-rebinding defence (wave-102 H1)", () => {
  it("rejects RFC-1918 IPv4 addresses returned from DNS", () => {
    expect(resolvedHostIsSafe("10.0.0.1")).toBe(false);
    expect(resolvedHostIsSafe("192.168.1.1")).toBe(false);
    expect(resolvedHostIsSafe("172.16.0.1")).toBe(false);
    expect(resolvedHostIsSafe("172.31.255.254")).toBe(false);
  });

  it("rejects loopback IPv4", () => {
    expect(resolvedHostIsSafe("127.0.0.1")).toBe(false);
    expect(resolvedHostIsSafe("127.255.255.254")).toBe(false);
  });

  it("rejects link-local + cloud metadata", () => {
    expect(resolvedHostIsSafe("169.254.169.254")).toBe(false);
    expect(resolvedHostIsSafe("169.254.0.1")).toBe(false);
  });

  it("rejects 0.0.0.0", () => {
    expect(resolvedHostIsSafe("0.0.0.0")).toBe(false);
  });

  it("rejects IPv6 loopback + unique-local + link-local", () => {
    expect(resolvedHostIsSafe("::1")).toBe(false);
    expect(resolvedHostIsSafe("fc00::1")).toBe(false);
    expect(resolvedHostIsSafe("fd00::1")).toBe(false);
    expect(resolvedHostIsSafe("fe80::1")).toBe(false);
  });

  it("accepts public IPv4 + IPv6", () => {
    expect(resolvedHostIsSafe("8.8.8.8")).toBe(true);
    expect(resolvedHostIsSafe("76.76.21.21")).toBe(true);
    expect(resolvedHostIsSafe("2606:4700::1111")).toBe(true);
  });
});

describe("isValidPeerUrl — trust gates", () => {
  it("accepts https URLs to public hosts", () => {
    expect(isValidPeerUrl("https://peer.example.com/api/honeypot/feed")).toBe(
      true,
    );
  });

  it("rejects http (plaintext) URLs", () => {
    expect(isValidPeerUrl("http://peer.example.com/api/honeypot/feed")).toBe(
      false,
    );
  });

  it("rejects loopback and metadata endpoints (SSRF guard)", () => {
    expect(isValidPeerUrl("https://127.0.0.1/feed")).toBe(false);
    expect(isValidPeerUrl("https://169.254.169.254/latest/meta-data/")).toBe(
      false,
    );
    expect(isValidPeerUrl("https://localhost/feed")).toBe(false);
  });

  it("rejects RFC-1918 private space", () => {
    expect(isValidPeerUrl("https://10.0.0.1/feed")).toBe(false);
    expect(isValidPeerUrl("https://192.168.1.1/feed")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isValidPeerUrl("not-a-url")).toBe(false);
    expect(isValidPeerUrl("")).toBe(false);
    expect(isValidPeerUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("getConfiguredPeers", () => {
  it("returns empty list when FEDERATION_PEERS is unset", () => {
    expect(getConfiguredPeers()).toEqual([]);
  });

  it("splits + trims comma-separated list", () => {
    process.env.FEDERATION_PEERS =
      " https://a.example.com/feed , https://b.example.com/feed,https://c.example.com/feed";
    expect(getConfiguredPeers()).toEqual([
      "https://a.example.com/feed",
      "https://b.example.com/feed",
      "https://c.example.com/feed",
    ]);
  });
});

describe("fetchPeerFeed — network safety", () => {
  it("returns null for invalid peer URLs (no network call)", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const r = await fetchPeerFeed("http://10.0.0.1/feed");
    expect(r).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns null on non-2xx response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("oops", { status: 503 }),
      ) as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).toBeNull();
  });

  it("returns null on shape-invalid response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ wrong: "shape" }), { status: 200 }),
      ) as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).toBeNull();
  });

  it("returns null on fetch throw (timeout, abort)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("aborted")) as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).toBeNull();
  });

  it("returns parsed shape on success", async () => {
    const body = {
      generatedAt: "2026-05-19T00:00:00.000Z",
      totalActive: 1,
      bulletins: [bulletin([fp("a")])],
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status: 200 }),
      ) as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).not.toBeNull();
    expect(r!.bulletins).toHaveLength(1);
  });

  it("rejects fetch when DNS resolves to a private IP (wave-102 H1 — DNS rebinding)", async () => {
    const dns = await import("node:dns/promises");
    (dns.lookup as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      address: "10.0.0.1",
      family: 4,
    });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).toBeNull();
    // Critical: DNS resolved to private IP → fetch MUST NOT happen.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects fetch when DNS resolves to AWS metadata endpoint", async () => {
    const dns = await import("node:dns/promises");
    (dns.lookup as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      address: "169.254.169.254",
      family: 4,
    });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects responses with Content-Length exceeding MAX_FEED_BYTES (wave-102 H2)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: { "content-length": String(MAX_FEED_BYTES + 1) },
      }),
    ) as unknown as typeof fetch;
    const r = await fetchPeerFeed("https://peer.example.com/feed");
    expect(r).toBeNull();
  });

  it("sets a stable User-Agent for federation pulls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ generatedAt: "x", totalActive: 0, bulletins: [] }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await fetchPeerFeed("https://peer.example.com/feed");
    const call = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = call.headers as Record<string, string>;
    expect(headers["user-agent"]).toMatch(/sovereign-matrix-federation-puller/);
  });
});

describe("extractFingerprintIds — malformed fingerprint safety (wave-102 M3)", () => {
  it("does not throw when a peer sends a malformed fingerprint", () => {
    const malformed = bulletin([
      { not: "a fingerprint" } as unknown as AttackFingerprint,
      fp("valid-one"),
    ]);
    const out = extractFingerprintIds([malformed]);
    expect(out).toHaveLength(1);
  });
});

describe("filterValidBulletins — shape + TTL", () => {
  it("drops bulletins with wrong schema id", () => {
    const out = filterValidBulletins([
      bulletin([fp("x")], { schema: "some-other-schema" }),
      bulletin([fp("y")]),
    ]);
    expect(out).toHaveLength(1);
  });

  it("drops expired bulletins", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const out = filterValidBulletins([
      bulletin([fp("expired")], { expiresAt: past }),
      bulletin([fp("active")]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].fingerprints[0].payloadDigest).toBe(
      fp("active").payloadDigest,
    );
  });

  it("drops bulletins with empty issuerId", () => {
    const out = filterValidBulletins([bulletin([fp("x")], { issuerId: "" })]);
    expect(out).toHaveLength(0);
  });

  it("caps at MAX_BULLETINS_PER_PULL", () => {
    const lots = Array.from({ length: MAX_BULLETINS_PER_PULL + 5 }, (_, i) =>
      bulletin([fp(`p${i}`)]),
    );
    const out = filterValidBulletins(lots);
    expect(out.length).toBeLessThanOrEqual(MAX_BULLETINS_PER_PULL);
  });
});

describe("extractFingerprintIds — dedup + cap", () => {
  it("deduplicates identical fingerprints across bulletins", () => {
    const a = fp("same-attack");
    const out = extractFingerprintIds([bulletin([a]), bulletin([a])]);
    expect(out).toHaveLength(1);
  });

  it("collects distinct fingerprints", () => {
    const out = extractFingerprintIds([
      bulletin([fp("a"), fp("b")]),
      bulletin([fp("c")]),
    ]);
    expect(out).toHaveLength(3);
  });

  it("caps at MAX_FINGERPRINTS_PER_CYCLE", () => {
    const big = bulletin(
      Array.from({ length: MAX_FINGERPRINTS_PER_CYCLE + 50 }, (_, i) =>
        fp(`payload-${i}`),
      ),
    );
    const out = extractFingerprintIds([big]);
    expect(out.length).toBeLessThanOrEqual(MAX_FINGERPRINTS_PER_CYCLE);
  });
});

describe("runPullCycle — end-to-end", () => {
  it("returns empty result when no peers configured", async () => {
    const r = await runPullCycle();
    expect(r.peers).toEqual([]);
    expect(r.uniqueFingerprintIds).toEqual([]);
    expect(r.totalBulletinsAccepted).toBe(0);
  });

  it("pulls from configured peers in parallel", async () => {
    process.env.FEDERATION_PEERS =
      "https://peer-a.example.com/feed,https://peer-b.example.com/feed";
    const peerABody = {
      generatedAt: "x",
      totalActive: 1,
      bulletins: [bulletin([fp("attack-from-a")])],
    };
    const peerBBody = {
      generatedAt: "x",
      totalActive: 1,
      bulletins: [bulletin([fp("attack-from-b")])],
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(peerABody), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(peerBBody), { status: 200 }),
      ) as unknown as typeof fetch;

    const r = await runPullCycle();
    expect(r.peers).toHaveLength(2);
    expect(r.peers.every((p) => p.reached)).toBe(true);
    expect(r.uniqueFingerprintIds).toHaveLength(2);
  });

  it("a failing peer does NOT stall the others", async () => {
    process.env.FEDERATION_PEERS =
      "https://broken-peer.example.com/feed,https://working-peer.example.com/feed";
    const goodBody = {
      generatedAt: "x",
      totalActive: 1,
      bulletins: [bulletin([fp("good-attack")])],
    };
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(goodBody), { status: 200 }),
      ) as unknown as typeof fetch;

    const r = await runPullCycle();
    expect(r.peers).toHaveLength(2);
    expect(r.peers[0].reached).toBe(false);
    expect(r.peers[1].reached).toBe(true);
    expect(r.uniqueFingerprintIds).toHaveLength(1);
  });

  it("invalid peer URLs are pre-rejected without network calls", async () => {
    process.env.FEDERATION_PEERS =
      "http://insecure.example.com/feed,https://127.0.0.1/feed";
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const r = await runPullCycle();
    expect(r.peers).toHaveLength(2);
    expect(r.peers.every((p) => !p.reached)).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("dedups fingerprints across peers", async () => {
    process.env.FEDERATION_PEERS =
      "https://peer-a.example.com/feed,https://peer-b.example.com/feed";
    const sameAttack = fp("shared-attack");
    const aBody = {
      generatedAt: "x",
      totalActive: 1,
      bulletins: [bulletin([sameAttack])],
    };
    const bBody = {
      generatedAt: "x",
      totalActive: 1,
      bulletins: [bulletin([sameAttack])],
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(aBody), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(bBody), { status: 200 }),
      ) as unknown as typeof fetch;

    const r = await runPullCycle();
    expect(r.uniqueFingerprintIds).toHaveLength(1);
    expect(r.totalBulletinsAccepted).toBe(2);
  });
});

describe("FEDERATION_VERIFY_SIGS — strict verification gate (wave 103)", () => {
  const originalStrict = process.env.FEDERATION_VERIFY_SIGS;
  const originalKey = process.env.FEDERATION_PEER_MLDSA65_PK_PEER_A;

  afterEach(() => {
    if (originalStrict === undefined) {
      delete process.env.FEDERATION_VERIFY_SIGS;
    } else {
      process.env.FEDERATION_VERIFY_SIGS = originalStrict;
    }
    if (originalKey === undefined) {
      delete process.env.FEDERATION_PEER_MLDSA65_PK_PEER_A;
    } else {
      process.env.FEDERATION_PEER_MLDSA65_PK_PEER_A = originalKey;
    }
  });

  it("isStrictVerifyEnabled returns false by default", () => {
    delete process.env.FEDERATION_VERIFY_SIGS;
    expect(isStrictVerifyEnabled()).toBe(false);
  });

  it("isStrictVerifyEnabled returns true only for exact 'true'", () => {
    process.env.FEDERATION_VERIFY_SIGS = "true";
    expect(isStrictVerifyEnabled()).toBe(true);
    process.env.FEDERATION_VERIFY_SIGS = "1";
    expect(isStrictVerifyEnabled()).toBe(false);
    process.env.FEDERATION_VERIFY_SIGS = "yes";
    expect(isStrictVerifyEnabled()).toBe(false);
  });

  it("verifyBulletinSig: 'no-signature' when mldsa65Sig is null", () => {
    const b = bulletin([fp("x")]); // unsigned by default
    const r = verifyBulletinSig(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-signature");
  });

  it("verifyBulletinSig: 'no-pubkey' when no FEDERATION_PEER_MLDSA65_PK_<issuer> configured", () => {
    delete process.env.FEDERATION_PEER_MLDSA65_PK_PEER_A;
    const b: FederationBulletin = {
      ...bulletin([fp("x")], { issuerId: "peer_a" }),
      mldsa65Sig: "fake-sig-base64",
    };
    const r = verifyBulletinSig(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-pubkey");
  });

  it("verifyBulletinSig: 'verify-failed' when sig doesn't match pubkey", () => {
    // Set a fake pubkey + fake sig — they won't validate.
    process.env.FEDERATION_PEER_MLDSA65_PK_PEER_A = Buffer.from(
      "not-a-real-mldsa65-pubkey",
    ).toString("base64");
    const b: FederationBulletin = {
      ...bulletin([fp("x")], { issuerId: "peer_a" }),
      mldsa65Sig: Buffer.from("not-a-real-sig").toString("base64"),
    };
    const r = verifyBulletinSig(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("verify-failed");
  });

  it("filterValidBulletins: strict mode DROPS unsigned bulletins", () => {
    process.env.FEDERATION_VERIFY_SIGS = "true";
    const out = filterValidBulletins([bulletin([fp("x")])]);
    expect(out).toEqual([]);
  });

  it("filterValidBulletins: bootstrap mode (default) ACCEPTS unsigned bulletins", () => {
    delete process.env.FEDERATION_VERIFY_SIGS;
    const out = filterValidBulletins([bulletin([fp("x")])]);
    expect(out).toHaveLength(1);
  });

  it("filterValidBulletins: strict mode drops bulletins from unknown issuers", () => {
    process.env.FEDERATION_VERIFY_SIGS = "true";
    delete process.env.FEDERATION_PEER_MLDSA65_PK_PEER_A;
    const b: FederationBulletin = {
      ...bulletin([fp("x")], { issuerId: "peer_a" }),
      mldsa65Sig: "any-sig-base64",
    };
    const out = filterValidBulletins([b]);
    expect(out).toEqual([]);
  });
});
