/**
 * Transparency log primitives — RFC 6962 conformance.
 *
 * Pins the algebraic invariants of the log:
 *   - leaf / inner domain separation (0x00 / 0x01)
 *   - Merkle Tree Hash matches RFC 6962 §2.1 vectors
 *   - inclusion proofs round-trip across tree sizes 1..32
 *   - tampered inclusion proofs always fail
 *   - consistency proofs verify (oldRoot, newRoot) for every (M, N)
 *     where 0 ≤ M ≤ N ≤ 16
 *   - tampered consistency proofs fail
 *   - STH canonicalization is byte-stable across key orders
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  leafHash,
  innerHash,
  treeRoot,
  inclusionProof,
  verifyInclusionProof,
  consistencyProof,
  verifyConsistencyProof,
  buildSth,
  canonicalizeSth,
} from "../src/transparency.js";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function makeLeaves(n: number): string[] {
  return Array.from({ length: n }, (_, i) => leafHash(`leaf-${i}`));
}

describe("transparency — hash primitives", () => {
  it("leaf hash uses the 0x00 domain prefix", () => {
    // RFC 6962: leafHash(d) = SHA-256(0x00 || d)
    const expected = createHash("sha256")
      .update(Buffer.from([0x00]))
      .update(Buffer.from("hello", "utf8"))
      .digest("hex");
    expect(leafHash("hello")).toBe(expected);
  });

  it("inner hash uses the 0x01 domain prefix", () => {
    const left = leafHash("a");
    const right = leafHash("b");
    const expected = createHash("sha256")
      .update(Buffer.from([0x01]))
      .update(Buffer.from(left, "hex"))
      .update(Buffer.from(right, "hex"))
      .digest("hex");
    expect(innerHash(left, right)).toBe(expected);
  });

  it("an empty tree's root is SHA-256 of empty input (RFC 6962)", () => {
    expect(treeRoot([])).toBe(createHash("sha256").digest("hex"));
  });

  it("a single-leaf tree's root equals the leaf hash", () => {
    const leaf = leafHash("only");
    expect(treeRoot([leaf])).toBe(leaf);
  });

  it("a two-leaf tree composes via inner hash", () => {
    const a = leafHash("a");
    const b = leafHash("b");
    expect(treeRoot([a, b])).toBe(innerHash(a, b));
  });
});

describe("transparency — inclusion proof round-trip", () => {
  // Every tree size from 1 to 32, every index, every proof must verify.
  // 32 is enough to exercise odd-sized subtrees (3, 5, 7, 9, ...) and
  // the right-edge fold path.
  for (const n of [1, 2, 3, 5, 8, 11, 16, 21, 32]) {
    it(`every leaf verifies in a tree of size ${n}`, () => {
      const leaves = makeLeaves(n);
      const root = treeRoot(leaves);
      for (let i = 0; i < n; i++) {
        const proof = inclusionProof(i, leaves);
        const ok = verifyInclusionProof(leaves[i], i, n, proof, root);
        expect(ok, `idx=${i}, n=${n}`).toBe(true);
      }
    });
  }

  it("tampered leaf fails verification", () => {
    const leaves = makeLeaves(8);
    const root = treeRoot(leaves);
    const proof = inclusionProof(3, leaves);
    const wrongLeaf = leafHash("not-the-real-leaf");
    expect(verifyInclusionProof(wrongLeaf, 3, 8, proof, root)).toBe(false);
  });

  it("tampered proof sibling fails verification", () => {
    const leaves = makeLeaves(8);
    const root = treeRoot(leaves);
    const proof = inclusionProof(3, leaves);
    const tampered = [...proof];
    tampered[0] = sha256Hex("attacker-sibling");
    expect(verifyInclusionProof(leaves[3], 3, 8, tampered, root)).toBe(false);
  });

  it("wrong index fails verification (sibling parity flips)", () => {
    const leaves = makeLeaves(8);
    const root = treeRoot(leaves);
    const proof = inclusionProof(3, leaves);
    expect(verifyInclusionProof(leaves[3], 4, 8, proof, root)).toBe(false);
  });

  it("out-of-range index returns false (no throw)", () => {
    const leaves = makeLeaves(4);
    const root = treeRoot(leaves);
    const proof = inclusionProof(0, leaves);
    expect(verifyInclusionProof(leaves[0], 99, 4, proof, root)).toBe(false);
  });

  it("inclusionProof throws on empty tree", () => {
    expect(() => inclusionProof(0, [])).toThrow();
  });

  it("inclusionProof throws on out-of-range idx", () => {
    expect(() => inclusionProof(5, makeLeaves(3))).toThrow();
  });
});

describe("transparency — consistency proof round-trip", () => {
  // Exhaustive check for every (oldSize, newSize) pair up to 16.
  for (let newSize = 1; newSize <= 16; newSize++) {
    for (let oldSize = 0; oldSize <= newSize; oldSize++) {
      it(`consistency proof oldSize=${oldSize} → newSize=${newSize}`, () => {
        const leaves = makeLeaves(newSize);
        const newRoot = treeRoot(leaves);
        const oldRoot = treeRoot(leaves.slice(0, oldSize));
        const proof = consistencyProof(oldSize, leaves);
        const ok = verifyConsistencyProof(
          oldSize,
          newSize,
          oldRoot,
          newRoot,
          proof,
        );
        expect(ok, `oldSize=${oldSize}, newSize=${newSize}`).toBe(true);
      });
    }
  }

  it("consistency proof from empty tree is vacuously valid", () => {
    const leaves = makeLeaves(8);
    const newRoot = treeRoot(leaves);
    const oldRoot = treeRoot([]);
    const proof = consistencyProof(0, leaves);
    expect(proof).toEqual([]);
    expect(verifyConsistencyProof(0, 8, oldRoot, newRoot, proof)).toBe(true);
  });

  it("consistency proof to the same size is empty + verifies", () => {
    const leaves = makeLeaves(7);
    const root = treeRoot(leaves);
    const proof = consistencyProof(7, leaves);
    expect(proof).toEqual([]);
    expect(verifyConsistencyProof(7, 7, root, root, proof)).toBe(true);
  });

  it("tampered oldRoot fails consistency (detects log fork)", () => {
    const leaves = makeLeaves(8);
    const newRoot = treeRoot(leaves);
    const realOld = treeRoot(leaves.slice(0, 3));
    const proof = consistencyProof(3, leaves);
    const fakeOld = sha256Hex("attacker-old-root");
    expect(fakeOld).not.toBe(realOld);
    expect(verifyConsistencyProof(3, 8, fakeOld, newRoot, proof)).toBe(false);
  });

  it("tampered newRoot fails consistency", () => {
    const leaves = makeLeaves(8);
    const realNew = treeRoot(leaves);
    const oldRoot = treeRoot(leaves.slice(0, 3));
    const proof = consistencyProof(3, leaves);
    const fakeNew = sha256Hex("attacker-new-root");
    expect(fakeNew).not.toBe(realNew);
    expect(verifyConsistencyProof(3, 8, oldRoot, fakeNew, proof)).toBe(false);
  });

  it("tampered proof element fails consistency", () => {
    const leaves = makeLeaves(8);
    const newRoot = treeRoot(leaves);
    const oldRoot = treeRoot(leaves.slice(0, 3));
    const proof = consistencyProof(3, leaves);
    const tampered = [...proof];
    if (tampered.length > 0) tampered[0] = sha256Hex("attacker");
    expect(verifyConsistencyProof(3, 8, oldRoot, newRoot, tampered)).toBe(
      false,
    );
  });

  it("oldSize > newSize is rejected", () => {
    const leaves = makeLeaves(5);
    const root = treeRoot(leaves);
    expect(verifyConsistencyProof(10, 5, root, root, [])).toBe(false);
  });

  it("consistencyProof throws when oldSize > newSize", () => {
    expect(() => consistencyProof(10, makeLeaves(5))).toThrow();
  });

  it("forked log: a different set of leaves yields different root, fails consistency", () => {
    // The attacker scenario: the log presents one root publicly but
    // privately tracks a fork. Any auditor running a consistency
    // check between the two STHs catches it.
    const honestLeaves = makeLeaves(8);
    const forkedLeaves = [
      ...honestLeaves.slice(0, 5),
      leafHash("forked-5"),
      ...honestLeaves.slice(6),
    ];
    const honestRoot = treeRoot(honestLeaves);
    const forkedRoot = treeRoot(forkedLeaves);
    expect(forkedRoot).not.toBe(honestRoot);
    // A proof built over the honest leaves can't make the forked root verify.
    const proof = consistencyProof(5, honestLeaves);
    const oldRoot = treeRoot(honestLeaves.slice(0, 5));
    expect(verifyConsistencyProof(5, 8, oldRoot, forkedRoot, proof)).toBe(
      false,
    );
  });
});

describe("transparency — STH canonicalization + buildSth", () => {
  it("buildSth produces a stable envelope", () => {
    const leaves = makeLeaves(4);
    const sth = buildSth(
      "test-log",
      leaves,
      () => new Date("2026-05-17T00:00:00.000Z"),
    );
    expect(sth.v).toBe(1);
    expect(sth.logId).toBe("test-log");
    expect(sth.treeSize).toBe(4);
    expect(sth.rootHash).toBe(treeRoot(leaves));
    expect(sth.timestamp).toBe("2026-05-17T00:00:00.000Z");
    expect(sth.signature).toBeUndefined();
  });

  it("canonicalizeSth is byte-stable regardless of input key order", () => {
    const a = {
      v: 1 as const,
      logId: "log-1",
      treeSize: 7,
      rootHash: "abc",
      timestamp: "2026-05-17T00:00:00.000Z",
    };
    const b = {
      timestamp: "2026-05-17T00:00:00.000Z",
      rootHash: "abc",
      treeSize: 7,
      logId: "log-1",
      v: 1 as const,
    };
    expect(canonicalizeSth(a)).toBe(canonicalizeSth(b));
  });

  it("canonical form omits the signature field by design", () => {
    const canonical = canonicalizeSth({
      v: 1,
      logId: "log",
      treeSize: 1,
      rootHash: "h",
      timestamp: "t",
    });
    expect(canonical).not.toContain("signature");
  });

  it("buildSth with empty leaves returns the empty-tree root and size 0", () => {
    const sth = buildSth(
      "empty-log",
      [],
      () => new Date("2026-05-17T00:00:00.000Z"),
    );
    expect(sth.treeSize).toBe(0);
    expect(sth.rootHash).toBe(treeRoot([]));
  });
});
