/**
 * Threshold Receipt Signatures (TRS) — m-of-n cosigning tests.
 *
 * Proves:
 *   - Assemble validates m/n parameters + authorizedIssuers shape
 *   - Verifier rejects scheme mismatch + contentHash drift
 *   - Verifier counts only cosigners whose issuerId is authorized
 *   - Verifier rejects duplicate cosigners (one issuer = one count)
 *   - Verifier returns ok iff valid signature count ≥ m
 *   - Verifier callback throwing → cosigner rejected with reason
 */
import { describe, it, expect } from "vitest";
import {
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";
import {
  assembleThresholdAttestation,
  verifyThresholdAttestation,
  type ThresholdCosigner,
  type ThresholdVerifyOptions,
} from "../src/threshold.js";

function makeIssuer(id: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    id,
    publicKey,
    sign(canonical: string): string {
      const raw = nodeSign(null, Buffer.from(canonical, "utf8"), privateKey);
      return "v2=" + raw.toString("base64");
    },
  };
}

function makeVerifier(
  issuers: ReturnType<typeof makeIssuer>[],
): ThresholdVerifyOptions {
  const keyById = new Map(issuers.map((i) => [i.id, i.publicKey]));
  return {
    verifyIssuerSignature: (canonical, signature, issuerId) => {
      const pub = keyById.get(issuerId);
      if (!pub) return false;
      if (!signature.startsWith("v2=")) return false;
      const sigBytes = Buffer.from(signature.slice(3), "base64");
      try {
        return nodeVerify(null, Buffer.from(canonical, "utf8"), pub, sigBytes);
      } catch {
        return false;
      }
    },
  };
}

const CANONICAL = '{"verdictId":"v_trs_test","overall":"pass"}';

describe("assembleThresholdAttestation", () => {
  it("builds a well-formed envelope with sha256(canonical) contentHash", () => {
    const issuer = makeIssuer("a");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 1, n: 1 },
      authorizedIssuers: ["a"],
      cosigners: [{ issuerId: "a", signature: issuer.sign(CANONICAL) }],
    });
    expect(att.scheme).toBe("trs1");
    expect(att.canonical).toBe(CANONICAL);
    expect(att.contentHash.length).toBe(64);
    expect(att.threshold).toEqual({ m: 1, n: 1 });
    expect(att.cosigners.length).toBe(1);
    expect(typeof att.assembledAt).toBe("string");
  });

  it("rejects empty canonical", () => {
    expect(() =>
      assembleThresholdAttestation({
        canonical: "",
        threshold: { m: 1, n: 1 },
        authorizedIssuers: ["a"],
        cosigners: [],
      }),
    ).toThrow(/canonical/);
  });

  it("rejects threshold m > n", () => {
    expect(() =>
      assembleThresholdAttestation({
        canonical: CANONICAL,
        threshold: { m: 3, n: 2 },
        authorizedIssuers: ["a", "b"],
        cosigners: [],
      }),
    ).toThrow(/m cannot exceed n/);
  });

  it("rejects threshold m < 1 or n < 1", () => {
    expect(() =>
      assembleThresholdAttestation({
        canonical: CANONICAL,
        threshold: { m: 0, n: 1 },
        authorizedIssuers: ["a"],
        cosigners: [],
      }),
    ).toThrow(/positive integers/);
  });

  it("rejects authorizedIssuers length != n", () => {
    expect(() =>
      assembleThresholdAttestation({
        canonical: CANONICAL,
        threshold: { m: 1, n: 3 },
        authorizedIssuers: ["a", "b"],
        cosigners: [],
      }),
    ).toThrow(/length .* must equal threshold.n/);
  });

  it("rejects duplicate authorizedIssuers", () => {
    expect(() =>
      assembleThresholdAttestation({
        canonical: CANONICAL,
        threshold: { m: 1, n: 2 },
        authorizedIssuers: ["a", "a"],
        cosigners: [],
      }),
    ).toThrow(/unique/);
  });

  it("rejects duplicate cosigner issuerIds at assembly time", () => {
    const a = makeIssuer("a");
    expect(() =>
      assembleThresholdAttestation({
        canonical: CANONICAL,
        threshold: { m: 1, n: 2 },
        authorizedIssuers: ["a", "b"],
        cosigners: [
          { issuerId: "a", signature: a.sign(CANONICAL) },
          { issuerId: "a", signature: a.sign(CANONICAL) },
        ],
      }),
    ).toThrow(/duplicate/);
  });
});

describe("verifyThresholdAttestation — happy paths", () => {
  it("accepts 1-of-1 when the single cosigner verifies", async () => {
    const a = makeIssuer("a");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 1, n: 1 },
      authorizedIssuers: ["a"],
      cosigners: [{ issuerId: "a", signature: a.sign(CANONICAL) }],
    });
    const result = await verifyThresholdAttestation(att, makeVerifier([a]));
    expect(result.ok).toBe(true);
    expect(result.validSignatureCount).toBe(1);
    expect(result.verifyingIssuers).toEqual(["a"]);
    expect(result.rejected).toEqual([]);
  });

  it("accepts 2-of-3 when exactly 2 of 3 cosigners verify", async () => {
    const a = makeIssuer("a");
    const b = makeIssuer("b");
    const c = makeIssuer("c");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 2, n: 3 },
      authorizedIssuers: ["a", "b", "c"],
      cosigners: [
        { issuerId: "a", signature: a.sign(CANONICAL) },
        { issuerId: "b", signature: b.sign(CANONICAL) },
      ],
    });
    const result = await verifyThresholdAttestation(
      att,
      makeVerifier([a, b, c]),
    );
    expect(result.ok).toBe(true);
    expect(result.validSignatureCount).toBe(2);
    expect(result.verifyingIssuers).toEqual(["a", "b"]);
  });

  it("accepts 3-of-5 when more than the minimum verify", async () => {
    const issuers = ["a", "b", "c", "d", "e"].map(makeIssuer);
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 3, n: 5 },
      authorizedIssuers: issuers.map((i) => i.id),
      cosigners: issuers.slice(0, 4).map((i) => ({
        issuerId: i.id,
        signature: i.sign(CANONICAL),
      })),
    });
    const result = await verifyThresholdAttestation(att, makeVerifier(issuers));
    expect(result.ok).toBe(true);
    expect(result.validSignatureCount).toBe(4);
  });
});

describe("verifyThresholdAttestation — adversarial rejections", () => {
  it("rejects insufficient cosigner count (1-of-2 → only 1, need 2)", async () => {
    const a = makeIssuer("a");
    const b = makeIssuer("b");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 2, n: 2 },
      authorizedIssuers: ["a", "b"],
      cosigners: [{ issuerId: "a", signature: a.sign(CANONICAL) }],
    });
    const result = await verifyThresholdAttestation(att, makeVerifier([a, b]));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/insufficient/);
    expect(result.validSignatureCount).toBe(1);
  });

  it("rejects cosigner whose issuerId is NOT in authorizedIssuers", async () => {
    const a = makeIssuer("a");
    const rogue = makeIssuer("rogue");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 1, n: 1 },
      authorizedIssuers: ["a"],
      cosigners: [{ issuerId: "rogue", signature: rogue.sign(CANONICAL) }],
    });
    const result = await verifyThresholdAttestation(
      att,
      makeVerifier([a, rogue]),
    );
    expect(result.ok).toBe(false);
    expect(result.validSignatureCount).toBe(0);
    expect(result.rejected[0].reason).toMatch(/not in authorizedIssuers/);
  });

  it("rejects when one cosigner's signature is forged under wrong key", async () => {
    const a = makeIssuer("a");
    const b = makeIssuer("b");
    const c = makeIssuer("c"); // c won't be in authorized; we'll use c's sig but claim b's id
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 2, n: 2 },
      authorizedIssuers: ["a", "b"],
      cosigners: [
        { issuerId: "a", signature: a.sign(CANONICAL) },
        // Forged: c signed but claiming to be b
        { issuerId: "b", signature: c.sign(CANONICAL) },
      ],
    });
    const result = await verifyThresholdAttestation(
      att,
      makeVerifier([a, b, c]),
    );
    expect(result.ok).toBe(false);
    expect(result.validSignatureCount).toBe(1);
    expect(
      result.rejected.some(
        (r) => r.issuerId === "b" && /did not verify/.test(r.reason),
      ),
    ).toBe(true);
  });

  it("rejects contentHash drift (canonical mutated post-assembly)", async () => {
    const a = makeIssuer("a");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 1, n: 1 },
      authorizedIssuers: ["a"],
      cosigners: [{ issuerId: "a", signature: a.sign(CANONICAL) }],
    });
    // Tamper the canonical field in-place — verifier MUST catch this.
    const tampered = { ...att, canonical: CANONICAL + " " };
    const result = await verifyThresholdAttestation(
      tampered,
      makeVerifier([a]),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/contentHash/);
  });

  it("rejects unknown scheme tag", async () => {
    const a = makeIssuer("a");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 1, n: 1 },
      authorizedIssuers: ["a"],
      cosigners: [{ issuerId: "a", signature: a.sign(CANONICAL) }],
    });
    const forged = { ...att, scheme: "trs9" as "trs1" };
    const result = await verifyThresholdAttestation(forged, makeVerifier([a]));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown scheme/);
  });

  it("verifier callback throwing is captured as a rejection (defense in depth)", async () => {
    const a = makeIssuer("a");
    const att = assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold: { m: 1, n: 1 },
      authorizedIssuers: ["a"],
      cosigners: [{ issuerId: "a", signature: a.sign(CANONICAL) }],
    });
    const result = await verifyThresholdAttestation(att, {
      verifyIssuerSignature: () => {
        throw new Error("simulated KMS unavailable");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.rejected[0].reason).toMatch(/verifier threw.*KMS/);
  });

  it("counts duplicate cosigner only once and reports the dup as rejected", async () => {
    const a = makeIssuer("a");
    const b = makeIssuer("b");
    // Hand-build the envelope to bypass the assembler's dup-check —
    // tests the verifier's defense even if a malicious assembler
    // produces a duplicate.
    const att = {
      scheme: "trs1" as const,
      canonical: CANONICAL,
      contentHash: (await import("node:crypto"))
        .createHash("sha256")
        .update(CANONICAL, "utf8")
        .digest("hex"),
      threshold: { m: 2, n: 2 },
      authorizedIssuers: ["a", "b"],
      cosigners: [
        { issuerId: "a", signature: a.sign(CANONICAL) },
        { issuerId: "a", signature: a.sign(CANONICAL) }, // dup
      ] as ThresholdCosigner[],
      assembledAt: new Date().toISOString(),
    };
    const result = await verifyThresholdAttestation(att, makeVerifier([a, b]));
    expect(result.ok).toBe(false);
    expect(result.validSignatureCount).toBe(1);
    expect(result.rejected.some((r) => /duplicate/.test(r.reason))).toBe(true);
  });
});
