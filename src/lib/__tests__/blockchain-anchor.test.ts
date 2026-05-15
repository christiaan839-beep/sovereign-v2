/**
 * Tests for src/lib/blockchain-anchor.ts — Cook 169.
 */

import { describe, it, expect } from "vitest";
import {
  buildAnchor,
  digestOf,
  encodePayload,
  explorerUrl,
  recommendChainFor,
  verifyAnchor,
  type AnchorPayload,
  type AnchorRecord,
} from "../blockchain-anchor";

const ROOT = "a".repeat(64);
const NOW = 1_700_000_000_000;

function payload(over: Partial<AnchorPayload> = {}): AnchorPayload {
  return {
    magic: "SVRGN1",
    root: ROOT,
    cohortId: "csrd-cohort-2026q2",
    sealedAt: NOW,
    leafCount: 1024,
    ...over,
  };
}

function record(over: Partial<AnchorRecord> = {}): AnchorRecord {
  const p = payload();
  return {
    payload: p,
    chain: "bitcoin-mainnet",
    txid: "abc123",
    blockHeight: 820_000,
    submittedAt: NOW + 60_000,
    confirmedAt: NOW + 600_000,
    ...over,
  };
}

describe("buildAnchor + encodePayload", () => {
  it("builds a payload with the canonical magic", () => {
    const p = buildAnchor({
      root: ROOT,
      cohortId: "x",
      sealedAt: NOW,
      leafCount: 4,
    });
    expect(p.magic).toBe("SVRGN1");
  });

  it("rejects a malformed root in encodePayload", () => {
    expect(() => encodePayload({ ...payload(), root: "not-hex" })).toThrow();
  });

  it("rejects a malformed prevAnchor in encodePayload", () => {
    expect(() => encodePayload({ ...payload(), prevAnchor: "nope" })).toThrow();
  });

  it("fits inside 80 bytes when prevAnchor is absent (OP_RETURN-safe)", () => {
    const bytes = encodePayload(payload());
    expect(bytes.length).toBeLessThanOrEqual(80);
  });

  it("grows by 32 bytes when prevAnchor is included", () => {
    const base = encodePayload(payload()).length;
    const withPrev = encodePayload(
      payload({ prevAnchor: "b".repeat(64) }),
    ).length;
    expect(withPrev - base).toBe(32);
  });
});

describe("digestOf", () => {
  it("returns a 64-char hex digest", () => {
    expect(digestOf(payload())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical payloads", () => {
    expect(digestOf(payload())).toBe(digestOf(payload()));
  });

  it("changes when the root changes", () => {
    expect(digestOf(payload())).not.toBe(
      digestOf({ ...payload(), root: "b".repeat(64) }),
    );
  });

  it("changes when cohortId changes", () => {
    expect(digestOf(payload())).not.toBe(
      digestOf({ ...payload(), cohortId: "different" }),
    );
  });
});

describe("verifyAnchor", () => {
  it("accepts a well-formed confirmed record", () => {
    const r = record();
    const v = verifyAnchor({
      record: r,
      expectedChain: "bitcoin-mainnet",
      expectedDigest: digestOf(r.payload),
    });
    expect(v.ok).toBe(true);
  });

  it("rejects when chain doesn't match expectation", () => {
    const r = record();
    const v = verifyAnchor({
      record: r,
      expectedChain: "ethereum-mainnet",
      expectedDigest: digestOf(r.payload),
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("wrong-chain");
  });

  it("rejects unconfirmed anchors", () => {
    const r = record({ blockHeight: null, confirmedAt: null });
    const v = verifyAnchor({
      record: r,
      expectedChain: "bitcoin-mainnet",
      expectedDigest: digestOf(r.payload),
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("no-confirmation");
  });

  it("rejects stale submissions (lag > maxSubmissionLagMs)", () => {
    const r = record({ submittedAt: NOW + 48 * 60 * 60 * 1000 });
    const v = verifyAnchor({
      record: r,
      expectedChain: "bitcoin-mainnet",
      expectedDigest: digestOf(r.payload),
      maxSubmissionLagMs: 24 * 60 * 60 * 1000,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("stale-anchor");
  });

  it("rejects negative lag (submittedAt < sealedAt — impossible)", () => {
    const r = record({ submittedAt: NOW - 1000 });
    const v = verifyAnchor({
      record: r,
      expectedChain: "bitcoin-mainnet",
      expectedDigest: digestOf(r.payload),
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("stale-anchor");
  });

  it("rejects when payload-hash mismatches the expected digest", () => {
    const r = record();
    const v = verifyAnchor({
      record: r,
      expectedChain: "bitcoin-mainnet",
      expectedDigest: "0".repeat(64),
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("bad-payload-hash");
  });

  it("rejects bad magic", () => {
    const r = record({
      payload: { ...payload(), magic: "WRONG" } as unknown as AnchorPayload,
    });
    const v = verifyAnchor({
      record: r,
      expectedChain: "bitcoin-mainnet",
      expectedDigest: "0".repeat(64),
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("bad-magic");
  });
});

describe("explorerUrl", () => {
  it("returns the right URL per chain", () => {
    expect(explorerUrl(record({ chain: "bitcoin-mainnet" }))).toContain(
      "mempool.space",
    );
    expect(explorerUrl(record({ chain: "ethereum-mainnet" }))).toContain(
      "etherscan.io",
    );
    expect(explorerUrl(record({ chain: "polygon-mainnet" }))).toContain(
      "polygonscan.com",
    );
  });

  it("returns null when txid is missing", () => {
    expect(explorerUrl(record({ txid: "" }))).toBeNull();
  });
});

describe("recommendChainFor", () => {
  it("recommends bitcoin for defense + utilities (high settlement)", () => {
    expect(recommendChainFor("defense")).toBe("bitcoin-mainnet");
    expect(recommendChainFor("utilities")).toBe("bitcoin-mainnet");
  });

  it("recommends ethereum for CSRD + pharma (smart-contract hooks)", () => {
    expect(recommendChainFor("csrd")).toBe("ethereum-mainnet");
    expect(recommendChainFor("clinical-trials")).toBe("ethereum-mainnet");
    expect(recommendChainFor("pharmacovigilance")).toBe("ethereum-mainnet");
  });

  it("falls back to bitcoin for unknown / general", () => {
    expect(recommendChainFor("general")).toBe("bitcoin-mainnet");
  });
});
