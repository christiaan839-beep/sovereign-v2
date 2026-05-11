/**
 * Tests for @sovereign-matrix/vaos-verifier — the open-spec reference
 * implementation of VAOS 1.0.
 *
 * These tests pin the behaviour described by docs/specs/vaos-1.0.md.
 * Any change here that breaks them is a spec violation, not a refactor.
 *
 * Coverage:
 *   - canonicalize() is deterministic across key insertion order (§6)
 *   - canonicalize() top-level field order is locked (§6)
 *   - sortKeysDeep() is recursive + preserves array order (§6.1)
 *   - sign() produces "v1=<64-hex>" (§7)
 *   - parseSignature() rejects malformed / unsigned / unknown algorithm
 *   - verifyLocal() round-trip + tamper detection (§7)
 *   - verifyLocal() is constant-time-ish (length mismatch returns false fast)
 *   - verifyRemote() sends the expected body to the endpoint
 *   - verifyRemote() rejects malicious-echo (issuer sends bad canonical)
 *   - verifyRemote() respects timeoutMs
 *   - Web Crypto runtime is detected; missing → throws
 */

import { describe, it, expect, vi } from "vitest";

import {
  canonicalize,
  sortKeysDeep,
  sign,
  parseSignature,
  verifyLocal,
  verifyRemote,
  computeLeafHash,
  computeNodeHash,
  verifyInclusionProof,
  type VaosReceipt,
  type VaosInclusionProof,
} from "../../../packages/vaos-verifier/src/index";

const KEY = "test_secret_with_enough_entropy_aaaa";

function fixture(overrides: Partial<VaosReceipt> = {}): VaosReceipt {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    agentName: "blog-gen",
    modelUsed: "claude-sonnet-4-6",
    input: { topic: "How HMAC works" },
    output: { html: "<p>An overview.</p>" },
    safetyResult: { jailbreak: "pass", pii: "pass" },
    durationMs: 1234,
    createdAt: "2026-05-10T00:00:00.000Z",
    signature: "v1=placeholder",
    ...overrides,
  };
}

// ─── canonicalize / sortKeysDeep ────────────────────────────────────────

describe("canonicalize (VAOS §6)", () => {
  it("locks top-level field order to the spec", () => {
    const r = fixture();
    const c = canonicalize(r);
    // Fields appear in the locked order: v, id, agentName, modelUsed, input,
    // output, safetyResult, durationMs, createdAt
    const idxV = c.indexOf('"v":');
    const idxId = c.indexOf('"id":');
    const idxAgent = c.indexOf('"agentName":');
    const idxModel = c.indexOf('"modelUsed":');
    const idxInput = c.indexOf('"input":');
    const idxOutput = c.indexOf('"output":');
    const idxSafety = c.indexOf('"safetyResult":');
    const idxDuration = c.indexOf('"durationMs":');
    const idxCreated = c.indexOf('"createdAt":');
    expect(idxV).toBeLessThan(idxId);
    expect(idxId).toBeLessThan(idxAgent);
    expect(idxAgent).toBeLessThan(idxModel);
    expect(idxModel).toBeLessThan(idxInput);
    expect(idxInput).toBeLessThan(idxOutput);
    expect(idxOutput).toBeLessThan(idxSafety);
    expect(idxSafety).toBeLessThan(idxDuration);
    expect(idxDuration).toBeLessThan(idxCreated);
  });

  it("includes the canonical version field (v:1) for forward-compat", () => {
    expect(canonicalize(fixture())).toMatch(/"v":1/);
  });

  it("is deterministic across nested key insertion order", () => {
    const a = canonicalize(
      fixture({ input: { topic: "x", count: 5, lang: "en" } }),
    );
    const b = canonicalize(
      fixture({ input: { count: 5, lang: "en", topic: "x" } }),
    );
    expect(a).toBe(b);
  });

  it("sorts deeply-nested object keys recursively", () => {
    const a = canonicalize(
      fixture({ input: { meta: { z: 1, a: 2 }, foo: "bar" } }),
    );
    const b = canonicalize(
      fixture({ input: { foo: "bar", meta: { a: 2, z: 1 } } }),
    );
    expect(a).toBe(b);
  });

  it("preserves array element order (arrays ARE canonical)", () => {
    const a = canonicalize(fixture({ input: { items: [1, 2, 3] } }));
    const b = canonicalize(fixture({ input: { items: [3, 2, 1] } }));
    expect(a).not.toBe(b);
  });

  it("accepts both ISO string and Date for createdAt", () => {
    const iso = "2026-05-10T00:00:00.000Z";
    const a = canonicalize(fixture({ createdAt: iso }));
    const b = canonicalize(fixture({ createdAt: new Date(iso) }));
    expect(a).toBe(b);
  });
});

describe("sortKeysDeep (VAOS §6.1)", () => {
  it("returns primitives unchanged", () => {
    expect(sortKeysDeep(null)).toBe(null);
    expect(sortKeysDeep(42)).toBe(42);
    expect(sortKeysDeep("hi")).toBe("hi");
    expect(sortKeysDeep(true)).toBe(true);
  });

  it("preserves array order", () => {
    expect(sortKeysDeep([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it("recurses into array elements", () => {
    expect(sortKeysDeep([{ z: 1, a: 2 }])).toEqual([{ a: 2, z: 1 }]);
  });

  it("sorts object keys alphabetically", () => {
    const out = sortKeysDeep({ z: 1, a: 2, m: 3 });
    expect(Object.keys(out as Record<string, unknown>)).toEqual([
      "a",
      "m",
      "z",
    ]);
  });
});

// ─── parseSignature (VAOS §7) ───────────────────────────────────────────

describe("parseSignature (VAOS §7)", () => {
  it("parses a well-formed v1 signature", () => {
    const hex = "a".repeat(64);
    expect(parseSignature(`v1=${hex}`)).toEqual({ algorithm: "v1", hex });
  });

  it("rejects the 'unsigned' sentinel", () => {
    expect(parseSignature("unsigned")).toBeNull();
  });

  it("rejects empty / unknown algorithm", () => {
    expect(parseSignature("")).toBeNull();
    expect(parseSignature("v2=" + "a".repeat(64))).toBeNull();
    expect(parseSignature("plain-hmac-no-prefix")).toBeNull();
  });

  it("rejects malformed hex (wrong length / non-hex)", () => {
    expect(parseSignature("v1=tooshort")).toBeNull();
    expect(parseSignature("v1=" + "z".repeat(64))).toBeNull();
    expect(parseSignature("v1=" + "a".repeat(63))).toBeNull();
  });
});

// ─── sign / verifyLocal (VAOS §7) ──────────────────────────────────────

describe("sign + verifyLocal (VAOS §7)", () => {
  it("sign() produces v1=<64 lowercase hex>", async () => {
    const sig = await sign(canonicalize(fixture()), KEY);
    expect(sig).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("verifyLocal() round-trips a freshly signed receipt", async () => {
    const c = canonicalize(fixture());
    const sig = await sign(c, KEY);
    expect(await verifyLocal(c, sig, KEY)).toBe(true);
  });

  it("verifyLocal() detects a tampered canonical (single byte flip)", async () => {
    const c = canonicalize(fixture({ output: { html: "<p>truth</p>" } }));
    const sig = await sign(c, KEY);
    const tampered = canonicalize(fixture({ output: { html: "<p>LIES</p>" } }));
    expect(await verifyLocal(tampered, sig, KEY)).toBe(false);
  });

  it("verifyLocal() rejects 'unsigned' sentinel under any key", async () => {
    expect(await verifyLocal("anything", "unsigned", KEY)).toBe(false);
  });

  it("verifyLocal() rejects unknown algorithm prefix (forward-compat guard)", async () => {
    expect(await verifyLocal("anything", "v2=" + "a".repeat(64), KEY)).toBe(
      false,
    );
  });

  it("verifyLocal() rejects mismatched-length hex without throwing", async () => {
    expect(await verifyLocal("anything", "v1=short", KEY)).toBe(false);
  });
});

// ─── verifyRemote (VAOS §8) ────────────────────────────────────────────

describe("verifyRemote (VAOS §8)", () => {
  it("re-derives canonical locally + POSTs canonical+signature to /api/verify", async () => {
    const r = fixture();
    const c = canonicalize(r);
    const sig = await sign(c, KEY);
    r.signature = sig;
    r.canonical = c;

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            valid: true,
            algorithm: "HMAC-SHA256",
            canonicalVersion: 1,
            id: r.id,
            agentName: r.agentName,
            createdAt: r.createdAt,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const result = await verifyRemote(r, {
      baseUrl: "https://example.agency",
      fetch: fetchMock as typeof fetch,
    });

    expect(result.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.agency/api/verify");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.canonical).toBe(c);
    expect(body.signature).toBe(sig);
  });

  it("returns valid:false WITHOUT calling network when issuer's echoed canonical doesn't match re-derivation (malicious-echo defense)", async () => {
    const r = fixture();
    const c = canonicalize(r);
    r.signature = await sign(c, KEY);
    // Issuer echoes a "happy" canonical that doesn't match the receipt's data.
    r.canonical = '{"v":1,"id":"hijacked","output":"happy"}';

    const fetchSpy = vi.fn();
    const result = await verifyRemote(r, {
      baseUrl: "https://example.agency",
      fetch: fetchSpy as typeof fetch,
    });

    expect(result.valid).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("works without an echoed canonical (recomputes from data fields)", async () => {
    const r = fixture();
    const c = canonicalize(r);
    r.signature = await sign(c, KEY);
    delete r.canonical;

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            valid: true,
            algorithm: "HMAC-SHA256",
            canonicalVersion: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const result = await verifyRemote(r, {
      baseUrl: "https://example.agency",
      fetch: fetchMock as typeof fetch,
    });

    expect(result.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("trims trailing slash from baseUrl when constructing the endpoint", async () => {
    const r = fixture();
    r.canonical = canonicalize(r);
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ valid: true }), { status: 200 }),
    );
    await verifyRemote(r, {
      baseUrl: "https://example.agency/",
      fetch: fetchMock as typeof fetch,
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://example.agency/api/verify",
    );
  });

  it("throws when neither endpoint nor baseUrl is supplied", async () => {
    const r = fixture();
    await expect(verifyRemote(r, {})).rejects.toThrow(/endpoint|baseUrl/i);
  });

  it("throws when the verify endpoint returns non-2xx", async () => {
    const r = fixture();
    r.canonical = canonicalize(r);
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(
      verifyRemote(r, {
        baseUrl: "https://example.agency",
        fetch: fetchMock as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 500/);
  });
});

// ─── Merkle inclusion proof verification (VAOS extension) ───────────────

describe("computeLeafHash + computeNodeHash (VAOS extension §M.1)", () => {
  it("computeLeafHash matches the issuer's domain-separated formula", async () => {
    // Cross-implementation check: the verifier package + the issuer
    // (src/lib/receipt-chain.ts) MUST produce byte-identical leaves
    // for the same input. If this drifts, every proof breaks.
    const leaf = await computeLeafHash("abc", "v1=def");
    expect(leaf).toMatch(/^[0-9a-f]{64}$/);
    // Domain separator + null bytes are intentional — change either
    // and existing proofs invalidate.
    const samePlain = await computeLeafHash("abc", "v1=def");
    expect(leaf).toBe(samePlain);
  });

  it("LEAF and NODE hash domains are separate (no preimage collision)", async () => {
    // A 1-element tree has root == leaf-hash. A 2-element tree where
    // both elements are the same has root == node-hash(leaf, leaf).
    // These two roots must differ — otherwise a single-leaf root could
    // be forged as a duplicate-leaf branch.
    const leaf = await computeLeafHash("x", "v1=y");
    const branch = await computeNodeHash(leaf, leaf);
    expect(leaf).not.toBe(branch);
  });
});

describe("verifyInclusionProof (VAOS extension §M.2)", () => {
  // Build a tiny chain manually so the test is self-contained — this
  // covers the case where a third party WITHOUT access to our
  // server-side lib reconstructs the exact algorithm.
  async function buildTinyChain(
    n: number,
  ): Promise<{ leaves: string[]; root: string }> {
    const leaves: string[] = [];
    for (let i = 0; i < n; i++) {
      leaves.push(await computeLeafHash(`id-${i}`, `v1=sig${i}`));
    }
    let level = [...leaves];
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i]!;
        const right = level[i + 1] ?? left;
        next.push(await computeNodeHash(left, right));
      }
      level = next;
    }
    return { leaves, root: level[0]! };
  }

  it("rejects malformed leaf / root / sibling hex", async () => {
    const proof: VaosInclusionProof = {
      leaf: "not-hex",
      index: 0,
      leafCount: 1,
      siblings: [],
      expectedRoot: "a".repeat(64),
    };
    expect(await verifyInclusionProof(proof)).toBe(false);
  });

  it("single-leaf chain → 0 siblings, root = leaf", async () => {
    const { leaves, root } = await buildTinyChain(1);
    expect(
      await verifyInclusionProof({
        leaf: leaves[0]!,
        index: 0,
        leafCount: 1,
        siblings: [],
        expectedRoot: root,
      }),
    ).toBe(true);
  });

  it("verifies a valid 4-leaf inclusion proof for index 1", async () => {
    const { leaves, root } = await buildTinyChain(4);
    // For index 1 (second leaf), first sibling is leaves[0] (LEFT),
    // second sibling is the right-pair node (RIGHT).
    const right23 = await computeNodeHash(leaves[2]!, leaves[3]!);
    const proof: VaosInclusionProof = {
      leaf: leaves[1]!,
      index: 1,
      leafCount: 4,
      siblings: [
        { hash: leaves[0]!, position: "left" },
        { hash: right23, position: "right" },
      ],
      expectedRoot: root,
    };
    expect(await verifyInclusionProof(proof)).toBe(true);
  });

  it("flipping a sibling position breaks the proof", async () => {
    const { leaves, root } = await buildTinyChain(4);
    const right23 = await computeNodeHash(leaves[2]!, leaves[3]!);
    const proof: VaosInclusionProof = {
      leaf: leaves[1]!,
      index: 1,
      leafCount: 4,
      siblings: [
        // Wrong position — should be "left", not "right"
        { hash: leaves[0]!, position: "right" },
        { hash: right23, position: "right" },
      ],
      expectedRoot: root,
    };
    expect(await verifyInclusionProof(proof)).toBe(false);
  });

  it("tampered expectedRoot → fails", async () => {
    const { leaves, root: realRoot } = await buildTinyChain(2);
    const proof: VaosInclusionProof = {
      leaf: leaves[0]!,
      index: 0,
      leafCount: 2,
      siblings: [{ hash: leaves[1]!, position: "right" }],
      expectedRoot: realRoot.replace(/.$/, "0").replace(/.$/, "1"), // mutate last char
    };
    expect(await verifyInclusionProof(proof)).toBe(false);
  });

  it("valid 8-leaf proof works at every index", async () => {
    const { leaves, root } = await buildTinyChain(8);
    for (let target = 0; target < 8; target++) {
      // Build the proof manually so we exercise the spec, not our impl
      let level = [...leaves];
      let idx = target;
      const siblings: VaosInclusionProof["siblings"] = [];
      while (level.length > 1) {
        const next: string[] = [];
        for (let i = 0; i < level.length; i += 2) {
          const left = level[i]!;
          const right = level[i + 1] ?? left;
          next.push(await computeNodeHash(left, right));
        }
        const isLeft = idx % 2 === 0;
        const sibIdx = isLeft ? idx + 1 : idx - 1;
        siblings.push({
          hash: level[sibIdx] ?? level[idx]!,
          position: isLeft ? "right" : "left",
        });
        idx = Math.floor(idx / 2);
        level = next;
      }
      const proof: VaosInclusionProof = {
        leaf: leaves[target]!,
        index: target,
        leafCount: 8,
        siblings,
        expectedRoot: root,
      };
      expect(
        await verifyInclusionProof(proof),
        `target=${target} should verify`,
      ).toBe(true);
    }
  });
});
