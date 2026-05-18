/**
 * VAPT (Verifiable Agentic Payment Token) tests.
 *
 * The proof corpus for our transaction-scoped agentic-payment primitive.
 * Exhaustive round-trip + adversarial coverage:
 *   - mint + parse + verify round-trip
 *   - signature tampering rejected
 *   - canonical tampering rejected (signature stops verifying)
 *   - amount / currency / merchant constraint enforcement
 *   - lifetime + replay window enforcement
 *   - malformed input defensive parsing
 */
import { describe, it, expect } from "vitest";
import {
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";
import {
  mintVapt,
  parseVapt,
  verifyVapt,
  vaptHash,
  type VaptPayload,
} from "../src/vapt.js";

function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKey, privateKey };
}

function makeSigner(privateKey: ReturnType<typeof makeKeyPair>["privateKey"]) {
  return (canonical: string) =>
    new Uint8Array(nodeSign(null, Buffer.from(canonical, "utf8"), privateKey));
}

function makeVerifier() {
  return (
    canonical: string,
    signature: Uint8Array,
    publicKey: unknown,
  ): boolean => {
    try {
      return nodeVerify(
        null,
        Buffer.from(canonical, "utf8"),
        publicKey as Parameters<typeof nodeVerify>[2],
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  };
}

function freshPayload(
  overrides: Partial<Omit<VaptPayload, "scheme">> = {},
): Omit<VaptPayload, "scheme"> {
  const issued = new Date();
  const expires = new Date(issued.getTime() + 30 * 60 * 1000); // +30 min
  return {
    tokenId: "vapt_test_001",
    userId: "user_abc",
    agentId: "agent_xyz",
    maxAmount: 5000,
    currency: "USD",
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
    singleUse: true,
    purpose: "Test purchase",
    ...overrides,
  };
}

describe("VAPT mint + parse round-trip", () => {
  it("mints a token in the vapt1.<payload>.<sig> wire format", () => {
    const { privateKey } = makeKeyPair();
    const token = mintVapt(freshPayload(), makeSigner(privateKey));
    expect(token.startsWith("vapt1.")).toBe(true);
    expect(token.split(".").length).toBe(3);
  });

  it("parseVapt round-trips canonical bytes", () => {
    const { privateKey } = makeKeyPair();
    const payload = freshPayload();
    const token = mintVapt(payload, makeSigner(privateKey));
    const parsed = parseVapt(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.payload.scheme).toBe("vapt1");
    expect(parsed?.payload.tokenId).toBe(payload.tokenId);
    expect(parsed?.payload.maxAmount).toBe(payload.maxAmount);
    expect(parsed?.signature.length).toBeGreaterThan(0);
  });

  it("vaptHash returns a stable sha256 of canonical bytes", () => {
    const { privateKey } = makeKeyPair();
    const token = mintVapt(freshPayload(), makeSigner(privateKey));
    const h = vaptHash(token);
    expect(h.length).toBe(64);
    expect(h).toMatch(/^[a-f0-9]+$/);
  });
});

describe("VAPT verifyVapt — happy path", () => {
  it("accepts a well-formed token within constraints", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(freshPayload(), makeSigner(privateKey));
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.payload?.tokenId).toBe("vapt_test_001");
  });

  it("accepts amount equal to maxAmount", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ maxAmount: 5000 }),
      makeSigner(privateKey),
    );
    const result = verifyVapt(token, {
      proposedAmount: 5000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts merchant on the allowlist", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ merchantAllowlist: ["merchant_a", "merchant_b"] }),
      makeSigner(privateKey),
    );
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_b",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(true);
  });
});

describe("VAPT verifyVapt — adversarial rejections", () => {
  it("rejects amount > maxAmount", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ maxAmount: 5000 }),
      makeSigner(privateKey),
    );
    const result = verifyVapt(token, {
      proposedAmount: 5001,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds maxAmount/);
  });

  it("rejects currency mismatch", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ currency: "USD" }),
      makeSigner(privateKey),
    );
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "EUR",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/currency mismatch/);
  });

  it("rejects merchant not on allowlist", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ merchantAllowlist: ["merchant_a"] }),
      makeSigner(privateKey),
    );
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_z",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not in allowlist/);
  });

  it("rejects empty allowlist (no merchants accepted)", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ merchantAllowlist: [] }),
      makeSigner(privateKey),
    );
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/empty/);
  });

  it("rejects expired token", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const past = new Date(Date.now() - 60 * 60 * 1000 - 1000);
    const payload = freshPayload({
      issuedAt: past.toISOString(),
      // expires 30min after issuance, well in the past
      expiresAt: new Date(past.getTime() + 30 * 60 * 1000).toISOString(),
    });
    const token = mintVapt(payload, makeSigner(privateKey));
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expired/);
  });

  it("rejects not-yet-valid token", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const payload = freshPayload({
      issuedAt: future.toISOString(),
      expiresAt: new Date(future.getTime() + 10 * 60 * 1000).toISOString(),
    });
    const token = mintVapt(payload, makeSigner(privateKey));
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not yet valid/);
  });

  it("rejects token signed by wrong key", () => {
    const { privateKey: priv1 } = makeKeyPair();
    const { publicKey: pub2 } = makeKeyPair();
    const token = mintVapt(freshPayload(), makeSigner(priv1));
    const result = verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: pub2,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature/);
  });

  it("rejects token with tampered payload bytes", () => {
    const { privateKey, publicKey } = makeKeyPair();
    const token = mintVapt(
      freshPayload({ maxAmount: 100 }),
      makeSigner(privateKey),
    );
    // Swap the middle payload section with a forged higher-amount payload.
    const forgedCanonical = JSON.stringify({
      ...JSON.parse(parseVapt(token)!.canonical),
      maxAmount: 1_000_000,
    });
    const forgedPayloadB64 = Buffer.from(forgedCanonical, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `vapt1.${forgedPayloadB64}.${token.split(".")[2]}`;
    const result = verifyVapt(tampered, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: makeVerifier(),
      publicKeyMaterial: publicKey,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature/);
  });
});

describe("VAPT mint validation", () => {
  it("rejects currency that isn't ISO 4217", () => {
    const { privateKey } = makeKeyPair();
    expect(() =>
      mintVapt(freshPayload({ currency: "DOGE" }), makeSigner(privateKey)),
    ).toThrow(/currency/);
  });

  it("rejects negative maxAmount", () => {
    const { privateKey } = makeKeyPair();
    expect(() =>
      mintVapt(freshPayload({ maxAmount: -1 }), makeSigner(privateKey)),
    ).toThrow(/maxAmount/);
  });

  it("rejects expiresAt before issuedAt", () => {
    const { privateKey } = makeKeyPair();
    const issued = new Date();
    expect(() =>
      mintVapt(
        freshPayload({
          issuedAt: issued.toISOString(),
          expiresAt: new Date(issued.getTime() - 1000).toISOString(),
        }),
        makeSigner(privateKey),
      ),
    ).toThrow(/expiresAt/);
  });

  it("rejects lifetime > 1 hour", () => {
    const { privateKey } = makeKeyPair();
    const issued = new Date();
    expect(() =>
      mintVapt(
        freshPayload({
          issuedAt: issued.toISOString(),
          expiresAt: new Date(
            issued.getTime() + 2 * 60 * 60 * 1000,
          ).toISOString(),
        }),
        makeSigner(privateKey),
      ),
    ).toThrow(/lifetime/);
  });
});

describe("VAPT parseVapt — defensive parsing", () => {
  it("returns null for non-VAPT-prefixed string", () => {
    expect(parseVapt("v2=foo")).toBeNull();
    expect(parseVapt("hello")).toBeNull();
    expect(parseVapt("")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(parseVapt("vapt1.!!!.!!!")).toBeNull();
  });

  it("returns null for missing signature section", () => {
    expect(parseVapt("vapt1.eyJzY2hlbWUiOiJ2YXB0MSJ9")).toBeNull();
  });

  it("returns null when scheme field is wrong", () => {
    const payload = { scheme: "vapt2", tokenId: "x" };
    const b64 = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(parseVapt(`vapt1.${b64}.sig`)).toBeNull();
  });
});
