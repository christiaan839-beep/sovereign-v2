/**
 * Tests for src/lib/merkle-receipt-batch.ts — Cook 167.
 */

import { describe, it, expect } from "vitest";
import {
  batchHeight,
  buildProof,
  commitBatch,
  verifyLeaf,
  verifyProof,
  type ReceiptInput,
} from "../merkle-receipt-batch";

function mk(n: number): ReceiptInput[] {
  return Array.from({ length: n }, (_, i) => ({
    receiptId: `rcpt_${i}`,
    canonical: `sovereign-receipt-v1|rcpt_${i}|tenant_a|agent|1.0|verdict|${i}`,
  }));
}

describe("commitBatch", () => {
  it("throws on empty input", () => {
    expect(() => commitBatch([])).toThrow();
  });

  it("returns a 64-char hex root", () => {
    const b = commitBatch(mk(4));
    expect(b.root).toMatch(/^[0-9a-f]{64}$/);
    expect(b.leafCount).toBe(4);
    expect(b.algorithm).toBe("sha256-v1");
  });

  it("is deterministic for the same ordered input", () => {
    expect(commitBatch(mk(8)).root).toBe(commitBatch(mk(8)).root);
  });

  it("differs when receipt order differs", () => {
    const r = mk(4);
    const reversed = [...r].reverse();
    expect(commitBatch(r).root).not.toBe(commitBatch(reversed).root);
  });

  it("handles single receipt (root = leaf hash)", () => {
    const b = commitBatch(mk(1));
    expect(b.leafCount).toBe(1);
    expect(b.root).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles odd-leaf counts (duplicates trailing)", () => {
    expect(() => commitBatch(mk(3))).not.toThrow();
    expect(() => commitBatch(mk(7))).not.toThrow();
  });
});

describe("buildProof + verifyProof", () => {
  it("rejects out-of-bounds leafIndex", () => {
    expect(() => buildProof(mk(4), -1)).toThrow();
    expect(() => buildProof(mk(4), 4)).toThrow();
  });

  it("produces a proof that verifies against the batch root", () => {
    const receipts = mk(4);
    const batch = commitBatch(receipts);
    for (let i = 0; i < 4; i++) {
      const p = buildProof(receipts, i);
      expect(verifyProof(p, batch.root)).toEqual({ ok: true });
    }
  });

  it("works for non-power-of-2 batches", () => {
    const receipts = mk(7);
    const batch = commitBatch(receipts);
    for (let i = 0; i < 7; i++) {
      const p = buildProof(receipts, i);
      expect(verifyProof(p, batch.root)).toEqual({ ok: true });
    }
  });

  it("works at scale (1024 receipts → O(log n) path)", () => {
    const receipts = mk(1024);
    const batch = commitBatch(receipts);
    const p = buildProof(receipts, 512);
    expect(p.path.length).toBe(10); // log2(1024) = 10
    expect(verifyProof(p, batch.root)).toEqual({ ok: true });
  });

  it("rejects a proof against the wrong root", () => {
    const receipts = mk(4);
    const p = buildProof(receipts, 0);
    const wrongRoot = "0".repeat(64);
    const v = verifyProof(p, wrongRoot);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("root-mismatch");
  });

  it("rejects a tampered path step", () => {
    const receipts = mk(4);
    const batch = commitBatch(receipts);
    const p = buildProof(receipts, 0);
    const tampered = {
      ...p,
      path: p.path.map((s, idx) =>
        idx === 0 ? { ...s, hash: "f".repeat(64) } : s,
      ),
    };
    const v = verifyProof(tampered, batch.root);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad-path");
  });
});

describe("verifyLeaf", () => {
  it("matches when receipt canonical hashes to the proof's leaf", () => {
    const receipts = mk(4);
    const p = buildProof(receipts, 2);
    expect(verifyLeaf(receipts[2], p)).toEqual({ ok: true });
  });

  it("rejects when receipt canonical was modified", () => {
    const receipts = mk(4);
    const p = buildProof(receipts, 2);
    const tampered: ReceiptInput = {
      ...receipts[2],
      canonical: receipts[2].canonical + "X",
    };
    const v = verifyLeaf(tampered, p);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("leaf-mismatch");
  });
});

describe("batchHeight", () => {
  it("returns 0 for 0 or 1 leaves", () => {
    expect(batchHeight(0)).toBe(0);
    expect(batchHeight(1)).toBe(0);
  });

  it("returns ceil(log2(n)) for n leaves", () => {
    expect(batchHeight(2)).toBe(1);
    expect(batchHeight(4)).toBe(2);
    expect(batchHeight(7)).toBe(3);
    expect(batchHeight(1024)).toBe(10);
  });
});
