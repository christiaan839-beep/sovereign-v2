/**
 * Tests for src/lib/audit-log-integrity.ts — Cook 179.
 */

import { describe, it, expect } from "vitest";
import {
  canonicalRow,
  chainAppend,
  chainDigest,
  verifyChain,
  verifyRow,
  type AuditLogRow,
  type ChainedRow,
} from "../audit-log-integrity";

function row(over: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: "r1",
    occurredAt: 1_700_000_000_000,
    userIdHash: "sha256:abcdef",
    action: "auth:login",
    resource: "user:1",
    outcome: "success",
    ...over,
  };
}

function buildChain(specs: Partial<AuditLogRow>[]): ChainedRow[] {
  const chained: ChainedRow[] = [];
  let prev = "";
  for (let i = 0; i < specs.length; i++) {
    const r = row({
      id: `r${i}`,
      occurredAt: 1_700_000_000_000 + i * 1000,
      ...specs[i],
    });
    const head = chainAppend(prev, r);
    chained.push({ ...r, chainHead: head, prevHead: prev });
    prev = head;
  }
  return chained;
}

describe("canonicalRow", () => {
  it("returns a domain-separated string", () => {
    const s = canonicalRow(row());
    expect(s.startsWith("sovereign-audit-log-v1|")).toBe(true);
    expect(s).toContain("auth:login");
  });
  it("is deterministic", () => {
    expect(canonicalRow(row())).toBe(canonicalRow(row()));
  });
  it("differs when any field changes", () => {
    expect(canonicalRow(row())).not.toBe(
      canonicalRow(row({ action: "auth:logout" })),
    );
  });
});

describe("chainAppend", () => {
  it("returns a 64-char hex digest", () => {
    expect(chainAppend("", row())).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic", () => {
    expect(chainAppend("prev", row())).toBe(chainAppend("prev", row()));
  });
  it("changes when prevHead changes", () => {
    expect(chainAppend("", row())).not.toBe(chainAppend("different", row()));
  });
});

describe("verifyRow", () => {
  it("validates an unmodified row", () => {
    const r = row();
    const head = chainAppend("", r);
    expect(verifyRow({ ...r, chainHead: head, prevHead: "" })).toBe(true);
  });
  it("rejects when chainHead doesn't match", () => {
    const r = row();
    expect(verifyRow({ ...r, chainHead: "0".repeat(64), prevHead: "" })).toBe(
      false,
    );
  });
});

describe("verifyChain", () => {
  it("accepts an empty chain", () => {
    expect(verifyChain([])).toEqual({
      ok: true,
      failedAtRowId: null,
      failedAtIndex: null,
    });
  });
  it("accepts a clean 5-row chain", () => {
    const chain = buildChain([{}, {}, {}, {}, {}]);
    expect(verifyChain(chain)).toEqual({
      ok: true,
      failedAtRowId: null,
      failedAtIndex: null,
    });
  });
  it("detects a tampered body in the middle", () => {
    const chain = buildChain([{}, {}, {}, {}, {}]);
    const tampered = chain.map((r, i) =>
      i === 2 ? { ...r, action: "auth:logout-malicious" } : r,
    );
    const v = verifyChain(tampered);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("row-tampered");
    expect(v.failedAtIndex).toBe(2);
  });
  it("detects a chain-discontinuity (rows reordered)", () => {
    const chain = buildChain([{}, {}, {}]);
    const reordered = [chain[0], chain[2], chain[1]];
    const v = verifyChain(reordered);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("chain-discontinuity");
  });
  it("detects non-monotonic time", () => {
    const chain = buildChain([{}, {}, {}]);
    // Direct mutation of the middle row's occurredAt (without
    // recomputing chainHead) is detected as 'row-tampered'.
    // For non-monotonic specifically, we need a row whose chainHead
    // is internally consistent but whose time is out of order.
    const r1 = row({ id: "a", occurredAt: 1000 });
    const r2 = row({ id: "b", occurredAt: 500 }); // earlier than r1
    const h1 = chainAppend("", r1);
    const h2 = chainAppend(h1, r2);
    const v = verifyChain([
      { ...r1, chainHead: h1, prevHead: "" },
      { ...r2, chainHead: h2, prevHead: h1 },
    ]);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("non-monotonic-time");
  });
  it("verifies cross-batch via genesisPrevHead", () => {
    const batch1 = buildChain([{}, {}, {}]);
    const lastHead = batch1[batch1.length - 1].chainHead;
    // Continue from the last head as if it were a new batch.
    let prev = lastHead;
    const batch2: ChainedRow[] = [];
    for (let i = 0; i < 3; i++) {
      const r = row({
        id: `b${i}`,
        occurredAt: 1_700_000_010_000 + i * 1000,
      });
      const head = chainAppend(prev, r);
      batch2.push({ ...r, chainHead: head, prevHead: prev });
      prev = head;
    }
    expect(verifyChain(batch2, lastHead)).toEqual({
      ok: true,
      failedAtRowId: null,
      failedAtIndex: null,
    });
  });
});

describe("chainDigest", () => {
  it("hashes empty chain to a stable value", () => {
    expect(chainDigest([])).toMatch(/^[0-9a-f]{64}$/);
  });
  it("differs between two distinct chains", () => {
    const a = buildChain([{}]);
    const b = buildChain([{ action: "auth:logout" }]);
    expect(chainDigest(a)).not.toBe(chainDigest(b));
  });
  it("is deterministic", () => {
    const c = buildChain([{}, {}, {}]);
    expect(chainDigest(c)).toBe(chainDigest(c));
  });
});
