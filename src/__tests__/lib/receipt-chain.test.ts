/**
 * Tests for src/lib/receipt-chain — Merkle root over a tenant's
 * signed receipts.
 *
 * Properties pinned:
 *   - empty set → all-zero EMPTY_ROOT (distinguishable from any real root)
 *   - single receipt → leaf hash, NOT a node hash (no fake-branch attack)
 *   - root is invariant under input order (sort is deterministic)
 *   - root changes when ANY constituent receipt changes (id or signature)
 *   - root changes when a receipt is deleted or added
 *   - odd-count levels handled (Bitcoin convention: duplicate last)
 *   - signed envelope is recoverable from canonical
 *   - leaf vs branch hash domain-separation prevents collision
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
});

import {
  buildSignedChainRoot,
  canonicalizeChainRoot,
  computeMerkleRoot,
  type ReceiptForChain,
} from "@/lib/receipt-chain";

const EMPTY_ROOT =
  "0000000000000000000000000000000000000000000000000000000000000000";

function rec(
  id: string,
  sig: string,
  createdAt: string = "2026-05-10T00:00:00.000Z",
): ReceiptForChain {
  return { id, signature: `v1=${sig}`, createdAt };
}

describe("computeMerkleRoot", () => {
  it("empty set → 64-char zero hex", () => {
    expect(computeMerkleRoot([])).toBe(EMPTY_ROOT);
  });

  it("single receipt → 64-char hex (leaf hash, NOT zero)", () => {
    const root = computeMerkleRoot([rec("a", "deadbeef")]);
    expect(root).toMatch(/^[0-9a-f]{64}$/);
    expect(root).not.toBe(EMPTY_ROOT);
  });

  it("root is invariant under input order (deterministic sort)", () => {
    const a = rec("a", "111", "2026-05-10T00:00:00.000Z");
    const b = rec("b", "222", "2026-05-10T01:00:00.000Z");
    const c = rec("c", "333", "2026-05-10T02:00:00.000Z");
    expect(computeMerkleRoot([a, b, c])).toBe(computeMerkleRoot([c, a, b]));
    expect(computeMerkleRoot([a, b, c])).toBe(computeMerkleRoot([b, c, a]));
  });

  it("root changes when ANY signature changes", () => {
    const a = rec("a", "111");
    const b = rec("b", "222");
    const before = computeMerkleRoot([a, b]);
    const tampered = [a, { ...b, signature: "v1=999" }];
    expect(computeMerkleRoot(tampered)).not.toBe(before);
  });

  it("root changes when ANY id changes", () => {
    const a = rec("a", "111");
    const b = rec("b", "222");
    const before = computeMerkleRoot([a, b]);
    const tampered = [a, { ...b, id: "b-renamed" }];
    expect(computeMerkleRoot(tampered)).not.toBe(before);
  });

  it("root changes when a receipt is deleted (silent drop detection)", () => {
    const a = rec("a", "111");
    const b = rec("b", "222");
    const c = rec("c", "333");
    const full = computeMerkleRoot([a, b, c]);
    const dropped = computeMerkleRoot([a, c]);
    expect(full).not.toBe(dropped);
  });

  it("root changes when a receipt is added", () => {
    const a = rec("a", "111");
    const b = rec("b", "222");
    const before = computeMerkleRoot([a, b]);
    const after = computeMerkleRoot([a, b, rec("c", "333")]);
    expect(before).not.toBe(after);
  });

  it("handles odd-count level (3 receipts → 2 → 1)", () => {
    const a = rec("a", "111");
    const b = rec("b", "222");
    const c = rec("c", "333");
    const root = computeMerkleRoot([a, b, c]);
    expect(root).toMatch(/^[0-9a-f]{64}$/);
    expect(root).not.toBe(EMPTY_ROOT);
  });

  it("breaks ties on createdAt by id (still deterministic)", () => {
    const t = "2026-05-10T00:00:00.000Z";
    const a = rec("a", "111", t);
    const b = rec("b", "222", t);
    const c = rec("c", "333", t);
    expect(computeMerkleRoot([c, b, a])).toBe(computeMerkleRoot([a, b, c]));
  });

  it("leaf and branch hashes are domain-separated (no collision)", () => {
    // A 1-receipt tree is a leaf hash. A 2-receipt tree is a branch hash
    // over two leaves. The branch over duplicated leaf must NOT equal
    // the original leaf.
    const single = rec("only", "sig");
    const root1 = computeMerkleRoot([single]);
    const root2 = computeMerkleRoot([single, single]);
    expect(root1).not.toBe(root2);
  });
});

describe("buildSignedChainRoot", () => {
  it("packages root into a v1 envelope + canonical + signature", () => {
    const t = new Date("2026-05-10T00:00:00.000Z");
    const out = buildSignedChainRoot([rec("a", "111"), rec("b", "222")], t);
    expect(out.envelope.v).toBe(1);
    expect(out.envelope.count).toBe(2);
    expect(out.envelope.computedAt).toBe(t.toISOString());
    expect(out.envelope.root).toMatch(/^[0-9a-f]{64}$/);
    expect(out.canonical).toBe(JSON.stringify(out.envelope));
    expect(out.signature).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("emits EMPTY_ROOT envelope for an empty tenant", () => {
    const out = buildSignedChainRoot([], new Date(0));
    expect(out.envelope.root).toBe(EMPTY_ROOT);
    expect(out.envelope.count).toBe(0);
  });

  it("envelope is canonicalize-roundtrippable", () => {
    const out = buildSignedChainRoot(
      [rec("a", "111")],
      new Date("2026-05-10T00:00:00.000Z"),
    );
    expect(canonicalizeChainRoot(out.envelope)).toBe(out.canonical);
  });

  it("two consecutive builds with the same input produce the same root + canonical", () => {
    const t = new Date("2026-05-10T00:00:00.000Z");
    const a = buildSignedChainRoot([rec("x", "111"), rec("y", "222")], t);
    const b = buildSignedChainRoot([rec("x", "111"), rec("y", "222")], t);
    expect(a.canonical).toBe(b.canonical);
    expect(a.signature).toBe(b.signature);
  });
});
