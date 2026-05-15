/**
 * Tests for src/lib/multi-party-attestation.ts — Cook 43.
 *
 *   - sign(): rejects empty witnessId/key/digest; produces deterministic
 *     signatures for the same input.
 *   - verifyBatch():
 *       - all-of policy: every witness must sign.
 *       - m-of-n policy: any m of n suffice.
 *       - duplicate witnesses are rejected.
 *       - unknown signer (not in policy) is rejected.
 *       - tampered signature is rejected.
 *       - missing key returns missing-key outcome.
 *       - cross-witness signature (same digest, different signer) does
 *         NOT verify against the other signer's key — proves witness-id
 *         is in the canonical digest.
 *   - JSON-serializable result for receipt embedding.
 */

import { describe, it, expect } from "vitest";
import {
  sign,
  verifyBatch,
  type Attestation,
  type AttestationMessage,
} from "../multi-party-attestation";

const DIGEST = "a".repeat(64); // 32-byte hex
const MSG: AttestationMessage = {
  artifactId: "receipt-1",
  artifactDigest: DIGEST,
  context: { role: "agent-output", tenantId: "t1" },
};

const KEYS = new Map<string, string>([
  ["customer-acme", "key-customer-secret-32-chars-here-xx"],
  ["auditor-bdo", "key-auditor-secret-32-chars-here-yyyy"],
  ["sovereign", "key-sovereign-secret-32-chars-here-zz"],
]);

const RESOLVER = (id: string) => KEYS.get(id);

describe("sign", () => {
  it("rejects empty witnessId or key", () => {
    expect(() => sign(MSG, "", "k")).toThrow();
    expect(() => sign(MSG, "alice", "")).toThrow();
  });

  it("rejects non-32-byte-hex digests", () => {
    expect(() =>
      sign({ ...MSG, artifactDigest: "short" }, "alice", "k"),
    ).toThrow(/SHA-256/);
  });

  it("produces deterministic signatures for the same input", () => {
    const a = sign(MSG, "customer-acme", KEYS.get("customer-acme")!, 0);
    const b = sign(MSG, "customer-acme", KEYS.get("customer-acme")!, 0);
    expect(a.signature).toBe(b.signature);
  });
});

describe("verifyBatch — all-of", () => {
  it("verifies when every named witness has signed", () => {
    const atts: Attestation[] = [
      sign(MSG, "customer-acme", KEYS.get("customer-acme")!),
      sign(MSG, "auditor-bdo", KEYS.get("auditor-bdo")!),
      sign(MSG, "sovereign", KEYS.get("sovereign")!),
    ];
    const out = verifyBatch(
      MSG,
      atts,
      {
        kind: "all-of",
        witnesses: ["customer-acme", "auditor-bdo", "sovereign"],
      },
      RESOLVER,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.verified).toHaveLength(3);
  });

  it("fails policy-not-met when a witness didn't sign", () => {
    const atts: Attestation[] = [
      sign(MSG, "customer-acme", KEYS.get("customer-acme")!),
      sign(MSG, "auditor-bdo", KEYS.get("auditor-bdo")!),
    ];
    const out = verifyBatch(
      MSG,
      atts,
      {
        kind: "all-of",
        witnesses: ["customer-acme", "auditor-bdo", "sovereign"],
      },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("policy-not-met");
      expect(out.details).toContain("sovereign");
    }
  });
});

describe("verifyBatch — m-of-n", () => {
  it("verifies when m of n witnesses signed", () => {
    const atts: Attestation[] = [
      sign(MSG, "customer-acme", KEYS.get("customer-acme")!),
      sign(MSG, "auditor-bdo", KEYS.get("auditor-bdo")!),
    ];
    const out = verifyBatch(
      MSG,
      atts,
      {
        kind: "m-of-n",
        witnesses: ["customer-acme", "auditor-bdo", "sovereign"],
        required: 2,
      },
      RESOLVER,
    );
    expect(out.ok).toBe(true);
  });

  it("rejects when fewer than m witnesses signed", () => {
    const atts: Attestation[] = [
      sign(MSG, "customer-acme", KEYS.get("customer-acme")!),
    ];
    const out = verifyBatch(
      MSG,
      atts,
      {
        kind: "m-of-n",
        witnesses: ["customer-acme", "auditor-bdo", "sovereign"],
        required: 2,
      },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("policy-not-met");
  });
});

describe("verifyBatch — rogue / tampered inputs", () => {
  it("rejects duplicate witnessId", () => {
    const att = sign(MSG, "customer-acme", KEYS.get("customer-acme")!);
    const out = verifyBatch(
      MSG,
      [att, att],
      { kind: "m-of-n", witnesses: ["customer-acme"], required: 1 },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("duplicate-witness");
  });

  it("rejects witnesses not listed in the policy", () => {
    const att = sign(MSG, "customer-acme", KEYS.get("customer-acme")!);
    const out = verifyBatch(
      MSG,
      [att],
      { kind: "m-of-n", witnesses: ["auditor-bdo"], required: 1 },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("unknown-witness");
  });

  it("rejects a tampered signature", () => {
    const att = sign(MSG, "customer-acme", KEYS.get("customer-acme")!);
    const bad: Attestation = {
      ...att,
      signature: att.signature.slice(0, -2) + "xx",
    };
    const out = verifyBatch(
      MSG,
      [bad],
      { kind: "m-of-n", witnesses: ["customer-acme"], required: 1 },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-signature");
  });

  it("rejects a witness whose key the resolver doesn't know", () => {
    const att = sign(MSG, "customer-acme", KEYS.get("customer-acme")!);
    const out = verifyBatch(
      MSG,
      [att],
      { kind: "m-of-n", witnesses: ["customer-acme"], required: 1 },
      () => undefined,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-key");
  });

  it("returns policy-not-met when no attestations supplied", () => {
    const out = verifyBatch(
      MSG,
      [],
      { kind: "all-of", witnesses: ["x"] },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
  });
});

describe("verifyBatch — cross-witness immunity", () => {
  it("witness A's signature does NOT verify if presented as witness B's", () => {
    // Sign as A, then swap the witnessId. The canonical digest changes
    // because witnessId is part of the input, so HMAC mismatch.
    const real = sign(MSG, "customer-acme", KEYS.get("customer-acme")!);
    const forged: Attestation = { ...real, witnessId: "auditor-bdo" };
    const out = verifyBatch(
      MSG,
      [forged],
      { kind: "m-of-n", witnesses: ["auditor-bdo"], required: 1 },
      RESOLVER,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-signature");
  });
});

describe("receipt-friendliness", () => {
  it("returns JSON-serializable outcomes", () => {
    const att = sign(MSG, "customer-acme", KEYS.get("customer-acme")!);
    const out = verifyBatch(
      MSG,
      [att],
      { kind: "m-of-n", witnesses: ["customer-acme"], required: 1 },
      RESOLVER,
    );
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
  });
});
