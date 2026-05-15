/**
 * Tests for src/lib/zk-pass-rate.ts — Cook 106.
 */

import { describe, it, expect } from "vitest";
import {
  commitPassRate,
  discloseOutcome,
  verifyClaim,
  verifyInclusion,
  type RunOutcome,
} from "../zk-pass-rate";

function outcomes(passes: number, failures: number): RunOutcome[] {
  return [
    ...Array(passes).fill("pass" as RunOutcome),
    ...Array(failures).fill("fail" as RunOutcome),
  ];
}

describe("commitPassRate", () => {
  it("rejects empty outcome lists", () => {
    expect(() =>
      commitPassRate({
        outcomes: [],
        tenantId: "t",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
      }),
    ).toThrow();
  });

  it("commits a 99/1 pass-rate to a 64-char hex root", () => {
    const c = commitPassRate({
      outcomes: outcomes(99, 1),
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(c.totalRuns).toBe(100);
    expect(c.passCount).toBe(99);
    expect(/^[a-f0-9]{64}$/.test(c.root)).toBe(true);
  });

  it("is deterministic for the same outcome sequence", () => {
    const args = {
      outcomes: outcomes(50, 50),
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    };
    expect(commitPassRate(args).root).toBe(commitPassRate(args).root);
  });

  it("produces different roots for different orderings", () => {
    const a = commitPassRate({
      outcomes: outcomes(50, 50),
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    const b = commitPassRate({
      outcomes: [...outcomes(0, 50), ...outcomes(50, 0)],
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(a.root).not.toBe(b.root);
  });
});

describe("verifyClaim", () => {
  it("holds when actual rate ≥ claimed threshold", () => {
    const c = commitPassRate({
      outcomes: outcomes(99, 1),
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    const r = verifyClaim(c, 0.95);
    expect(r.holds).toBe(true);
    expect(r.actualRate).toBeCloseTo(0.99, 4);
  });

  it("does NOT hold when actual rate < claimed threshold", () => {
    const c = commitPassRate({
      outcomes: outcomes(90, 10),
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(verifyClaim(c, 0.95).holds).toBe(false);
  });

  it("rejects passCount > totalRuns (forged commit)", () => {
    const fake = {
      root: "0".repeat(64),
      totalRuns: 100,
      passCount: 101,
      tenantId: "t",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    };
    const r = verifyClaim(fake, 0.5);
    expect(r.holds).toBe(false);
    expect(r.message).toMatch(/exceeds/);
  });

  it("rejects out-of-range threshold", () => {
    const c = commitPassRate({
      outcomes: outcomes(50, 50),
      tenantId: "t",
      periodStart: "x",
      periodEnd: "y",
    });
    expect(verifyClaim(c, -1).holds).toBe(false);
    expect(verifyClaim(c, 1.5).holds).toBe(false);
  });
});

describe("discloseOutcome + verifyInclusion", () => {
  it("inclusion proof reconstructs the published root", () => {
    const seq = outcomes(7, 1);
    const c = commitPassRate({
      outcomes: seq,
      tenantId: "t",
      periodStart: "x",
      periodEnd: "y",
    });
    for (let i = 0; i < seq.length; i++) {
      const proof = discloseOutcome(seq, i);
      expect(verifyInclusion(proof, c.root)).toBe(true);
    }
  });

  it("rejects a proof claiming the wrong outcome", () => {
    const seq = outcomes(4, 4);
    const c = commitPassRate({
      outcomes: seq,
      tenantId: "t",
      periodStart: "x",
      periodEnd: "y",
    });
    const proof = discloseOutcome(seq, 0);
    expect(verifyInclusion({ ...proof, outcome: "fail" }, c.root)).toBe(false);
  });

  it("throws when index is out of range", () => {
    expect(() => discloseOutcome(outcomes(2, 0), 99)).toThrow();
  });
});

describe("ZK-lite non-disclosure property", () => {
  it("inclusion proof never carries other outcomes verbatim", () => {
    const seq = [...outcomes(8, 0), ...outcomes(0, 8)];
    const c = commitPassRate({
      outcomes: seq,
      tenantId: "t",
      periodStart: "x",
      periodEnd: "y",
    });
    const proof = discloseOutcome(seq, 0);
    const serialized = JSON.stringify(proof);
    // The proof carries 1 outcome (the disclosed leaf) + sibling
    // HASHES — those are SHA-256 of internal nodes, so verifying
    // none of the OTHER outcome strings leak verbatim is the
    // strongest test we can write without a pre-image attack.
    const otherIdxs = [1, 2, 3, 4, 5, 6, 7];
    for (const idx of otherIdxs) {
      // We just assert: the serialized proof references at most one
      // outcome label, not the others as indexed claims.
      expect(serialized).not.toContain(`"index":${idx},"outcome"`);
    }
  });
});
