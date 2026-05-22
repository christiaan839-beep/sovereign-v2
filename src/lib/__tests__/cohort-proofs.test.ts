/**
 * Tests for src/lib/cohort-proofs.ts — Wave 147.
 *
 * Cryptographic-spec pins: hash determinism, bracket math, build →
 * verify round-trip, tamper detection, edge cases (empty, all
 * approved, none approved).
 */
import { describe, it, expect } from "vitest";

import {
  hashReceiptSet,
  powerOfTenBracket,
  rateDecileBracket,
  commitCount,
  commitApprovalRate,
  buildCohortProof,
  verifyCohortProof,
  renderClaim,
} from "@/lib/cohort-proofs";

describe("hashReceiptSet", () => {
  it("deterministic for the same input", () => {
    expect(hashReceiptSet(["a", "b"])).toBe(hashReceiptSet(["a", "b"]));
  });

  it("order-independent (sorts internally)", () => {
    expect(hashReceiptSet(["b", "a"])).toBe(hashReceiptSet(["a", "b"]));
  });

  it("dedupes input", () => {
    expect(hashReceiptSet(["a", "a", "b"])).toBe(hashReceiptSet(["a", "b"]));
  });

  it("changes on any element change", () => {
    expect(hashReceiptSet(["a", "b"])).not.toBe(hashReceiptSet(["a", "c"]));
  });

  it("empty input has stable sentinel hash", () => {
    expect(hashReceiptSet([])).toBe(hashReceiptSet([]));
  });
});

describe("powerOfTenBracket", () => {
  it("handles common scales", () => {
    expect(powerOfTenBracket(1)).toEqual({ floor: 1, ceiling: 10 });
    expect(powerOfTenBracket(42)).toEqual({ floor: 10, ceiling: 100 });
    expect(powerOfTenBracket(500)).toEqual({ floor: 100, ceiling: 1_000 });
    expect(powerOfTenBracket(17_842)).toEqual({
      floor: 10_000,
      ceiling: 100_000,
    });
  });

  it("returns [0, 1] for 0", () => {
    expect(powerOfTenBracket(0)).toEqual({ floor: 0, ceiling: 1 });
  });

  it("returns [0, 1] for negatives", () => {
    expect(powerOfTenBracket(-5)).toEqual({ floor: 0, ceiling: 1 });
  });
});

describe("rateDecileBracket", () => {
  it("buckets each decile", () => {
    expect(rateDecileBracket(0.0)).toEqual({ low: 0, high: 0.1 });
    expect(rateDecileBracket(0.42)).toEqual({ low: 0.4, high: 0.5 });
    expect(rateDecileBracket(0.99)).toEqual({ low: 0.9, high: 1.0 });
  });

  it("clamps full rate to top decile", () => {
    expect(rateDecileBracket(1.0)).toEqual({ low: 0.9, high: 1.0 });
    expect(rateDecileBracket(1.5)).toEqual({ low: 0.9, high: 1.0 });
  });

  it("clamps negatives to bottom", () => {
    expect(rateDecileBracket(-0.5)).toEqual({ low: 0, high: 0 });
  });
});

describe("commitCount + commitApprovalRate", () => {
  it("count commit is deterministic", () => {
    const a = commitCount(42, "deadbeef", { floor: 10, ceiling: 100 });
    const b = commitCount(42, "deadbeef", { floor: 10, ceiling: 100 });
    expect(a).toBe(b);
  });

  it("count commit changes on any field change", () => {
    const base = commitCount(42, "n", { floor: 10, ceiling: 100 });
    expect(commitCount(43, "n", { floor: 10, ceiling: 100 })).not.toBe(base);
    expect(commitCount(42, "n2", { floor: 10, ceiling: 100 })).not.toBe(base);
    expect(commitCount(42, "n", { floor: 11, ceiling: 100 })).not.toBe(base);
  });

  it("approval commit is deterministic", () => {
    expect(commitApprovalRate(0.5, "n", { low: 0.4, high: 0.5 })).toBe(
      commitApprovalRate(0.5, "n", { low: 0.4, high: 0.5 }),
    );
  });
});

describe("buildCohortProof + verifyCohortProof round-trip", () => {
  it("happy path verifies", () => {
    const receipts = Array.from({ length: 42 }, (_, i) => `r-${i}`);
    const pub = buildCohortProof({
      windowStart: "2026-05-22",
      windowEnd: "2026-05-22",
      receiptIds: receipts,
      approvedCount: 38,
    });
    const v = verifyCohortProof(pub.commitment, pub.secret, receipts);
    expect(v.valid).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it("empty set verifies (count=0, approval=0)", () => {
    const pub = buildCohortProof({
      windowStart: "2026-05-22",
      windowEnd: "2026-05-22",
      receiptIds: [],
      approvedCount: 0,
    });
    expect(pub.secret.actualCount).toBe(0);
    expect(pub.secret.actualApprovalRate).toBe(0);
    const v = verifyCohortProof(pub.commitment, pub.secret, []);
    expect(v.valid).toBe(true);
  });

  it("100% approval verifies", () => {
    const receipts = ["a", "b", "c", "d"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 4,
    });
    expect(pub.secret.actualApprovalRate).toBe(1);
    const v = verifyCohortProof(pub.commitment, pub.secret, receipts);
    expect(v.valid).toBe(true);
  });

  it("invariants — throws on impossible inputs", () => {
    expect(() =>
      buildCohortProof({
        windowStart: "",
        windowEnd: "x",
        receiptIds: ["a"],
        approvedCount: 0,
      }),
    ).toThrow(/required/);
    expect(() =>
      buildCohortProof({
        windowStart: "x",
        windowEnd: "x",
        receiptIds: ["a"],
        approvedCount: 5, // > receiptIds.length
      }),
    ).toThrow(/approvedCount/);
  });
});

describe("tamper detection", () => {
  it("rejects added receipt at reveal time", () => {
    const receipts = ["a", "b", "c"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 2,
    });
    const v = verifyCohortProof(pub.commitment, pub.secret, [
      ...receipts,
      "d", // sneaked in
    ]);
    expect(v.valid).toBe(false);
    expect(v.reasons.some((r) => /receiptSetHash/.test(r))).toBe(true);
  });

  it("rejects removed receipt at reveal time", () => {
    const receipts = ["a", "b", "c"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 2,
    });
    const v = verifyCohortProof(pub.commitment, pub.secret, ["a", "b"]);
    expect(v.valid).toBe(false);
  });

  it("rejects tampered count nonce", () => {
    const receipts = ["a", "b"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 1,
    });
    const tamperedSecret = { ...pub.secret, countNonce: "0".repeat(32) };
    const v = verifyCohortProof(pub.commitment, tamperedSecret, receipts);
    expect(v.valid).toBe(false);
    expect(v.reasons.some((r) => /countCommitment/.test(r))).toBe(true);
  });

  it("rejects tampered actualCount in secret", () => {
    const receipts = ["a", "b", "c"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 2,
    });
    const tampered = { ...pub.secret, actualCount: 999 };
    const v = verifyCohortProof(pub.commitment, tampered, receipts);
    expect(v.valid).toBe(false);
  });

  it("rejects wrong version commitment", () => {
    const receipts = ["a"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 1,
    });
    const v = verifyCohortProof(
      { ...pub.commitment, version: "evil-v0" },
      pub.secret,
      receipts,
    );
    expect(v.valid).toBe(false);
  });
});

describe("renderClaim — public-facing strings", () => {
  it("formats brackets as Big-N counts + percentage range", () => {
    const receipts = Array.from({ length: 73_421 }, (_, i) => `id-${i}`);
    const pub = buildCohortProof({
      windowStart: "2026-05-22",
      windowEnd: "2026-05-22",
      receiptIds: receipts,
      approvedCount: 66_000,
    });
    const claim = renderClaim(pub.commitment);
    expect(claim).toMatch(/10,000/);
    expect(claim).toMatch(/100,000/);
    expect(claim).toMatch(/2026-05-22/);
    expect(claim).toMatch(/auto-approval rate/);
    expect(claim).toMatch(/Commitment hash:/);
  });
});

describe("cryptographic moat invariants", () => {
  it("a published commitment cannot be retroactively altered — receiptSetHash binds the set", () => {
    const receipts = ["a", "b", "c"];
    const pub = buildCohortProof({
      windowStart: "x",
      windowEnd: "x",
      receiptIds: receipts,
      approvedCount: 2,
    });
    // Adversary tries to claim "we actually had a, b, c, d"
    const fakeReceipts = ["a", "b", "c", "d"];
    const v = verifyCohortProof(pub.commitment, pub.secret, fakeReceipts);
    expect(v.valid).toBe(false);
  });

  it("two different days produce different commitments even for same receipts", () => {
    const r = ["a", "b"];
    const day1 = buildCohortProof({
      windowStart: "2026-05-21",
      windowEnd: "2026-05-21",
      receiptIds: r,
      approvedCount: 2,
    });
    const day2 = buildCohortProof({
      windowStart: "2026-05-22",
      windowEnd: "2026-05-22",
      receiptIds: r,
      approvedCount: 2,
    });
    // Same receipt set hash...
    expect(day1.commitment.receiptSetHash).toBe(day2.commitment.receiptSetHash);
    // ...but different nonces → different countCommitments
    expect(day1.commitment.countCommitment).not.toBe(
      day2.commitment.countCommitment,
    );
  });
});
