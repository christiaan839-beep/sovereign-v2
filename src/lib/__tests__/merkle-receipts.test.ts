/**
 * Tests for src/lib/merkle-receipts.ts — Wave 141.
 *
 * Pure-function tests pinning the Merkle construction + verification.
 * No DB. These tests are the cryptographic spec — if they pass, any
 * external verifier implementing the same RFC 9162-style padded
 * Merkle tree should accept our proofs.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  buildMerkleTree,
  computeMerklePath,
  verifyMerklePath,
  leafHash,
  canonicalReceiptString,
} from "@/lib/merkle-receipts";

describe("leafHash", () => {
  it("is deterministic for the same input", () => {
    expect(leafHash("alpha")).toBe(leafHash("alpha"));
  });

  it("changes on input change", () => {
    expect(leafHash("alpha")).not.toBe(leafHash("alpha2"));
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    const h = leafHash("test");
    expect(h.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });
});

describe("canonicalReceiptString", () => {
  it("joins fields in stable order with pipe separator", () => {
    const s = canonicalReceiptString({
      id: "abc",
      agentName: "audit",
      modelUsed: "nim",
      durationMs: 800,
      trustDecision: "auto-approved",
      signature: "sig",
      createdAt: new Date("2026-05-22T12:00:00Z"),
    });
    expect(s.split("|")).toEqual([
      "abc",
      "audit",
      "nim",
      "800",
      "auto-approved",
      "sig",
      "2026-05-22T12:00:00.000Z",
    ]);
  });

  it("accepts string createdAt", () => {
    const s = canonicalReceiptString({
      id: "x",
      agentName: "a",
      modelUsed: "m",
      durationMs: 0,
      trustDecision: "d",
      signature: "g",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(s.endsWith("2026-01-01T00:00:00.000Z")).toBe(true);
  });
});

describe("buildMerkleTree", () => {
  it("returns empty shape for empty input", () => {
    const t = buildMerkleTree([]);
    expect(t.root).toBe("");
    expect(t.leafCount).toBe(0);
  });

  it("single leaf → root equals the leaf", () => {
    const leaf = leafHash("only");
    const t = buildMerkleTree([leaf]);
    expect(t.root).toBe(leaf);
    expect(t.leafCount).toBe(1);
  });

  it("two leaves → root is hash of the pair", () => {
    const t = buildMerkleTree([leafHash("a"), leafHash("b")]);
    expect(t.root.length).toBe(64);
    expect(t.levels).toHaveLength(2);
  });

  it("four leaves → 3 levels", () => {
    const t = buildMerkleTree([
      leafHash("a"),
      leafHash("b"),
      leafHash("c"),
      leafHash("d"),
    ]);
    expect(t.levels).toHaveLength(3);
    expect(t.levels[2]).toHaveLength(1);
  });

  it("odd leaf count pads with duplicate of last", () => {
    const t = buildMerkleTree([leafHash("a"), leafHash("b"), leafHash("c")]);
    // 3 leaves → level1 has 2 nodes (c paired with itself) → root
    expect(t.levels[1]).toHaveLength(2);
    expect(t.levels).toHaveLength(3);
  });

  it("produces stable roots for same input", () => {
    const leaves = ["a", "b", "c", "d", "e"].map(leafHash);
    expect(buildMerkleTree(leaves).root).toBe(buildMerkleTree(leaves).root);
  });

  it("produces different roots for permuted inputs (order matters)", () => {
    const r1 = buildMerkleTree(["a", "b", "c"].map(leafHash)).root;
    const r2 = buildMerkleTree(["c", "b", "a"].map(leafHash)).root;
    expect(r1).not.toBe(r2);
  });
});

describe("computeMerklePath + verifyMerklePath", () => {
  it("returns null for out-of-range index", () => {
    const t = buildMerkleTree([leafHash("a"), leafHash("b")]);
    expect(computeMerklePath(t, 2)).toBeNull();
    expect(computeMerklePath(t, -1)).toBeNull();
  });

  it("single-leaf proof verifies with empty siblings", () => {
    const leaf = leafHash("only");
    const t = buildMerkleTree([leaf]);
    const proof = computeMerklePath(t, 0)!;
    expect(proof.siblings).toEqual([]);
    expect(verifyMerklePath(proof)).toBe(true);
  });

  it("verifies every leaf in a 4-leaf tree", () => {
    const leaves = ["a", "b", "c", "d"].map(leafHash);
    const t = buildMerkleTree(leaves);
    for (let i = 0; i < 4; i++) {
      const proof = computeMerklePath(t, i)!;
      expect(verifyMerklePath(proof)).toBe(true);
    }
  });

  it("verifies every leaf in a 7-leaf tree (odd padding)", () => {
    const leaves = ["a", "b", "c", "d", "e", "f", "g"].map(leafHash);
    const t = buildMerkleTree(leaves);
    for (let i = 0; i < 7; i++) {
      const proof = computeMerklePath(t, i)!;
      expect(verifyMerklePath(proof)).toBe(true);
    }
  });

  it("verifies every leaf in a 100-leaf tree", () => {
    const leaves = Array.from({ length: 100 }, (_, i) =>
      leafHash(`receipt-${i}`),
    );
    const t = buildMerkleTree(leaves);
    for (let i = 0; i < 100; i++) {
      const proof = computeMerklePath(t, i)!;
      expect(verifyMerklePath(proof)).toBe(true);
    }
  });

  it("rejects tampered leaf", () => {
    const leaves = ["a", "b", "c", "d"].map(leafHash);
    const t = buildMerkleTree(leaves);
    const proof = computeMerklePath(t, 1)!;
    const tampered = { ...proof, leafHash: leafHash("evil") };
    expect(verifyMerklePath(tampered)).toBe(false);
  });

  it("rejects tampered root", () => {
    const leaves = ["a", "b", "c", "d"].map(leafHash);
    const t = buildMerkleTree(leaves);
    const proof = computeMerklePath(t, 0)!;
    const tampered = { ...proof, root: leafHash("not the real root") };
    expect(verifyMerklePath(tampered)).toBe(false);
  });

  it("rejects tampered sibling", () => {
    const leaves = ["a", "b", "c", "d"].map(leafHash);
    const t = buildMerkleTree(leaves);
    const proof = computeMerklePath(t, 0)!;
    const tampered = {
      ...proof,
      siblings: [leafHash("evil"), ...proof.siblings.slice(1)],
    };
    expect(verifyMerklePath(tampered)).toBe(false);
  });

  it("rejects mismatched siblings/positions arrays", () => {
    const leaves = ["a", "b", "c", "d"].map(leafHash);
    const t = buildMerkleTree(leaves);
    const proof = computeMerklePath(t, 0)!;
    const broken = { ...proof, siblings: proof.siblings.slice(0, -1) };
    expect(verifyMerklePath(broken)).toBe(false);
  });

  it("rejects empty leaf or root", () => {
    expect(
      verifyMerklePath({
        leafHash: "",
        root: "x",
        siblings: [],
        positions: [],
      }),
    ).toBe(false);
    expect(
      verifyMerklePath({
        leafHash: "x",
        root: "",
        siblings: [],
        positions: [],
      }),
    ).toBe(false);
  });
});

describe("cross-verifier invariants (the moat properties)", () => {
  it("a receipt + proof + root is self-contained — no platform trust needed", () => {
    const receipts = Array.from({ length: 50 }, (_, i) =>
      canonicalReceiptString({
        id: `id-${i}`,
        agentName: "audit",
        modelUsed: "nim",
        durationMs: 800,
        trustDecision: "auto-approved",
        signature: `sig-${i}`,
        createdAt: new Date(2026, 4, 22, 0, 0, i),
      }),
    );
    const leaves = receipts.map(leafHash);
    const tree = buildMerkleTree(leaves);
    const publishedRoot = tree.root;

    // Hold a single receipt + its proof
    const myReceipt = receipts[23];
    const myProof = computeMerklePath(tree, 23)!;

    // Reconstruct verification from scratch — no tree access
    expect(myProof.leafHash).toBe(leafHash(myReceipt));
    expect(myProof.root).toBe(publishedRoot);
    expect(verifyMerklePath(myProof)).toBe(true);
  });

  it("a single byte flip in any receipt invalidates the entire root", () => {
    const leaves = ["a", "b", "c", "d", "e"].map(leafHash);
    const root1 = buildMerkleTree(leaves).root;
    const tampered = [...leaves];
    tampered[2] = leafHash("c-tampered");
    const root2 = buildMerkleTree(tampered).root;
    expect(root1).not.toBe(root2);
  });
});
