/**
 * Tests for Merkle inclusion proofs in src/lib/receipt-chain.
 *
 * Properties pinned:
 *   - Empty receipt set → no proof for any id
 *   - Single receipt → 0-sibling proof, expectedRoot = leaf hash
 *   - Multi-receipt → proof has log2(N) siblings, verifies
 *   - Tampered leaf → verify fails
 *   - Tampered sibling → verify fails
 *   - Wrong index → verify fails (sibling order corrupts)
 *   - Odd-count level (3, 5, 7 receipts) → still verifies
 *   - Receipt not in set → buildInclusionProof returns null
 *   - Cross-tenant: a proof from chain A doesn't verify into chain B's root
 *   - Index parity: leaf at even idx → first sibling on right; odd → left
 */

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
});

import {
  buildInclusionProof,
  verifyInclusionProof,
  computeMerkleRoot,
  computeLeafHash,
  type ReceiptForChain,
} from "@/lib/receipt-chain";

function rec(
  id: string,
  sig: string,
  iso: string = "2026-05-10T00:00:00.000Z",
): ReceiptForChain {
  return { id, signature: `v1=${sig}`, createdAt: iso };
}

function chainOfN(n: number, tenantPrefix = "t"): ReceiptForChain[] {
  return Array.from({ length: n }, (_, i) =>
    rec(
      `${tenantPrefix}-${String(i).padStart(4, "0")}`,
      `${i}`.repeat(8).slice(0, 8),
      `2026-05-10T00:00:${String(i).padStart(2, "0")}.000Z`,
    ),
  );
}

describe("buildInclusionProof / verifyInclusionProof", () => {
  it("empty set → no proof", () => {
    expect(buildInclusionProof([], "anything")).toBeNull();
  });

  it("receipt not in set → null", () => {
    const chain = chainOfN(5);
    expect(buildInclusionProof(chain, "not-in-chain")).toBeNull();
  });

  it("single receipt → 0-sibling proof, root = leaf hash", () => {
    const single = chainOfN(1)[0]!;
    const proof = buildInclusionProof([single], single.id)!;
    expect(proof).not.toBeNull();
    expect(proof.siblings).toHaveLength(0);
    expect(proof.expectedRoot).toBe(
      computeLeafHash(single.id, single.signature),
    );
    expect(verifyInclusionProof(proof)).toBe(true);
  });

  it("4-receipt chain → 2-sibling proof, verifies", () => {
    const chain = chainOfN(4);
    for (const r of chain) {
      const proof = buildInclusionProof(chain, r.id)!;
      expect(proof.siblings).toHaveLength(2);
      expect(verifyInclusionProof(proof)).toBe(true);
    }
  });

  it("8-receipt chain → 3-sibling proof for every leaf", () => {
    const chain = chainOfN(8);
    for (const r of chain) {
      const proof = buildInclusionProof(chain, r.id)!;
      expect(proof.siblings).toHaveLength(3);
      expect(verifyInclusionProof(proof)).toBe(true);
    }
  });

  it("odd-count chain (3, 5, 7) — still verifies via duplicate-last convention", () => {
    for (const n of [3, 5, 7, 11, 13]) {
      const chain = chainOfN(n);
      for (const r of chain) {
        const proof = buildInclusionProof(chain, r.id)!;
        expect(
          verifyInclusionProof(proof),
          `n=${n} id=${r.id} should verify`,
        ).toBe(true);
      }
    }
  });

  it("expectedRoot in proof === computeMerkleRoot(set)", () => {
    const chain = chainOfN(7);
    const root = computeMerkleRoot(chain);
    for (const r of chain) {
      const proof = buildInclusionProof(chain, r.id)!;
      expect(proof.expectedRoot).toBe(root);
    }
  });

  it("tampered leaf hash → verify fails", () => {
    const chain = chainOfN(4);
    const proof = buildInclusionProof(chain, chain[1]!.id)!;
    const tampered = { ...proof, leaf: "f".repeat(64) };
    expect(verifyInclusionProof(tampered)).toBe(false);
  });

  it("tampered sibling hash → verify fails", () => {
    const chain = chainOfN(4);
    const proof = buildInclusionProof(chain, chain[1]!.id)!;
    const tampered = {
      ...proof,
      siblings: [
        { hash: "0".repeat(64), position: proof.siblings[0]!.position },
        ...proof.siblings.slice(1),
      ],
    };
    expect(verifyInclusionProof(tampered)).toBe(false);
  });

  it("flipped sibling position → verify fails", () => {
    const chain = chainOfN(4);
    const proof = buildInclusionProof(chain, chain[1]!.id)!;
    const tampered = {
      ...proof,
      siblings: proof.siblings.map((s) => ({
        ...s,
        position: (s.position === "left" ? "right" : "left") as
          | "left"
          | "right",
      })),
    };
    expect(verifyInclusionProof(tampered)).toBe(false);
  });

  it("malformed leaf / root rejected without crash", () => {
    const proof = buildInclusionProof(chainOfN(2), chainOfN(2)[0]!.id)!;
    expect(verifyInclusionProof({ ...proof, leaf: "not-hex" })).toBe(false);
    expect(
      verifyInclusionProof({ ...proof, expectedRoot: "x".repeat(64) }),
    ).toBe(false);
  });

  it("cross-tenant: proof from chain A does NOT verify into chain B's root", () => {
    const chainA = chainOfN(8, "a");
    const chainB = chainOfN(8, "b");
    const proofA = buildInclusionProof(chainA, chainA[3]!.id)!;
    const rootB = computeMerkleRoot(chainB);
    // The proof recomputes to chain A's root, NOT chain B's. Asserting
    // proof.expectedRoot === rootB would be the cross-check the verifier
    // does — and it should fail.
    expect(proofA.expectedRoot).not.toBe(rootB);
  });

  it("leaf at even index → first sibling on RIGHT; odd → first sibling on LEFT", () => {
    const chain = chainOfN(8);
    for (const r of chain) {
      const proof = buildInclusionProof(chain, r.id)!;
      const expectedFirstPos = proof.index % 2 === 0 ? "right" : "left";
      expect(proof.siblings[0]!.position).toBe(expectedFirstPos);
    }
  });
});
