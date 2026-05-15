/**
 * Tests for src/lib/retention-proof.ts — Cook 168.
 */

import { describe, it, expect } from "vitest";
import {
  CANONICAL_POLICIES,
  isEligibleForTombstone,
  newTombstoneSecret,
  sealTombstone,
  tombstoneDigest,
  verifyTombstone,
  type ReceiptRetentionRecord,
  type RetentionPolicy,
} from "../retention-proof";

const NOW = 1_700_000_000_000;
const YEAR = 365 * 24 * 60 * 60 * 1000;

const POLICY: RetentionPolicy = {
  policyId: "test-1yr",
  retentionMs: YEAR,
};

function rec(createdAt = NOW): ReceiptRetentionRecord {
  return {
    receiptId: "rcpt_test",
    batchRoot: "a".repeat(64),
    leafIndex: 5,
    policyId: "test-1yr",
    createdAt,
  };
}

describe("newTombstoneSecret", () => {
  it("returns a 64-char hex string", () => {
    expect(newTombstoneSecret()).toMatch(/^[0-9a-f]{64}$/);
  });
  it("returns a fresh value each call", () => {
    expect(newTombstoneSecret()).not.toBe(newTombstoneSecret());
  });
});

describe("sealTombstone", () => {
  const secret = newTombstoneSecret();

  it("throws on malformed secret", () => {
    expect(() =>
      sealTombstone({
        secret: "not-hex",
        record: rec(),
        policy: POLICY,
        now: NOW + YEAR + 1,
      }),
    ).toThrow();
  });

  it("throws when record/policy id mismatch", () => {
    expect(() =>
      sealTombstone({
        secret,
        record: rec(),
        policy: { ...POLICY, policyId: "different" },
        now: NOW + YEAR + 1,
      }),
    ).toThrow();
  });

  it("throws when retention window has not elapsed", () => {
    expect(() =>
      sealTombstone({
        secret,
        record: rec(),
        policy: POLICY,
        now: NOW + YEAR - 1, // 1 ms early
      }),
    ).toThrow(/retention window not elapsed/);
  });

  it("seals after the retention window with a valid MAC", () => {
    const t = sealTombstone({
      secret,
      record: rec(),
      policy: POLICY,
      now: NOW + YEAR + 100,
    });
    expect(t.receiptId).toBe("rcpt_test");
    expect(t.policyId).toBe("test-1yr");
    expect(t.sealedAt).toBe(NOW + YEAR + 100);
    expect(t.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(t.mac).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyTombstone", () => {
  const secret = newTombstoneSecret();
  const good = () =>
    sealTombstone({
      secret,
      record: rec(),
      policy: POLICY,
      now: NOW + YEAR + 100,
    });

  it("accepts a sealed tombstone with correct policy + receipt", () => {
    const t = good();
    const v = verifyTombstone({
      secret,
      tombstone: t,
      expectedReceiptId: "rcpt_test",
      expectedPolicyId: "test-1yr",
      policy: POLICY,
    });
    expect(v).toEqual({ ok: true });
  });

  it("rejects receipt-id mismatch", () => {
    const t = good();
    const v = verifyTombstone({
      secret,
      tombstone: t,
      expectedReceiptId: "DIFFERENT",
      expectedPolicyId: "test-1yr",
      policy: POLICY,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("receipt-mismatch");
  });

  it("rejects policy-id mismatch", () => {
    const t = good();
    const v = verifyTombstone({
      secret,
      tombstone: t,
      expectedReceiptId: "rcpt_test",
      expectedPolicyId: "different-policy",
      policy: POLICY,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("policy-mismatch");
  });

  it("rejects when sealedAt < expiresAt (tampered sealedAt)", () => {
    const t = good();
    const tampered = { ...t, sealedAt: NOW + YEAR - 1000 };
    const v = verifyTombstone({
      secret,
      tombstone: tampered,
      expectedReceiptId: "rcpt_test",
      expectedPolicyId: "test-1yr",
      policy: POLICY,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("retention-not-elapsed");
  });

  it("rejects a tampered MAC", () => {
    const t = good();
    const tampered = {
      ...t,
      mac: t.mac.replace(/.$/, t.mac.endsWith("0") ? "1" : "0"),
    };
    const v = verifyTombstone({
      secret,
      tombstone: tampered,
      expectedReceiptId: "rcpt_test",
      expectedPolicyId: "test-1yr",
      policy: POLICY,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad-mac");
  });

  it("rejects a tombstone signed under a different secret", () => {
    const t = good();
    const v = verifyTombstone({
      secret: newTombstoneSecret(),
      tombstone: t,
      expectedReceiptId: "rcpt_test",
      expectedPolicyId: "test-1yr",
      policy: POLICY,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad-mac");
  });
});

describe("isEligibleForTombstone", () => {
  it("returns false before retention window", () => {
    expect(isEligibleForTombstone(rec(), POLICY, NOW + YEAR - 1)).toBe(false);
  });
  it("returns true after retention window", () => {
    expect(isEligibleForTombstone(rec(), POLICY, NOW + YEAR + 1)).toBe(true);
  });
  it("returns false when policy id mismatches the record", () => {
    expect(
      isEligibleForTombstone(
        rec(),
        { ...POLICY, policyId: "different" },
        NOW + YEAR + 1,
      ),
    ).toBe(false);
  });
});

describe("tombstoneDigest", () => {
  it("is deterministic for the same tombstone", () => {
    const secret = newTombstoneSecret();
    const t = sealTombstone({
      secret,
      record: rec(),
      policy: POLICY,
      now: NOW + YEAR + 100,
    });
    expect(tombstoneDigest(t)).toBe(tombstoneDigest(t));
    expect(tombstoneDigest(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("CANONICAL_POLICIES", () => {
  it("includes the canonical regulatory retention windows", () => {
    expect(CANONICAL_POLICIES["csrd-7yr"].retentionMs).toBe(7 * YEAR);
    expect(CANONICAL_POLICIES["pv-25yr"].retentionMs).toBe(25 * YEAR);
    expect(CANONICAL_POLICIES["fed-sr11-7-10yr"].retentionMs).toBe(10 * YEAR);
    expect(CANONICAL_POLICIES["fedramp-3yr"].retentionMs).toBe(3 * YEAR);
  });
});
