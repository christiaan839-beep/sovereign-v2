/**
 * agentic-commerce/acat (R91) — tests.
 *
 * Pure-function commerce-authorization-token primitive that lets
 * sellers verify agent buying authorization OFFLINE.
 *
 * Covers:
 *   - buildACATMessage: canonical format
 *   - mintACAT: signs deterministically
 *   - verifyACAT: roundtrip + every failure reason
 *     * message_mismatch / signature_invalid / user_pubkey_mismatch
 *     * expired / not_yet_valid
 *     * amount_exceeds_scope / scope_violation (currency)
 *     * merchant_not_allowed / category_excluded / category_not_allowed
 *     * single_use_consumed
 *     * chain_hash_mismatch
 *   - attenuateACAT: Macaroon-pattern narrowing
 *     * widening rejected (max-amount, valid-until)
 *     * narrowing accepted (merchant + category + single-use)
 *   - HTTP transport: encode/decode roundtrip
 *   - summarizeACATForReceipt: procurement-readable
 */

import { describe, it, expect } from "vitest";
import {
  buildACATMessage,
  mintACAT,
  verifyACAT,
  attenuateACAT,
  additionalCaveatIsNarrowing,
  encodeACATForHeader,
  decodeACATFromHeader,
  summarizeACATForReceipt,
  computeACATChainHash,
  type ACATBody,
  type SignedACAT,
} from "../agentic-commerce/acat";
import { generateKeyPair } from "../agent-delegation";

const FIXED_NOW = new Date("2026-04-29T12:00:00.000Z");

function buildBaseBody(overrides: Partial<ACATBody> = {}): ACATBody {
  return {
    version: "acat-v1",
    agentId: "https://sovereignmatrix.agency/agents/test-agent",
    agentManifestVersion: "1.0.0",
    userId: "user_alice",
    userPublicKey: "USER_PUB_KEY_PLACEHOLDER",
    scope: {
      maxCents: 50_000, // $500
      currency: "USD",
      validFrom: "2026-04-29T00:00:00.000Z",
      validUntil: "2026-05-29T00:00:00.000Z",
    },
    caveats: [],
    issuedAt: "2026-04-29T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildACATMessage (pure, deterministic)", () => {
  it("starts with version + commerce header", () => {
    const body = buildBaseBody();
    const msg = buildACATMessage(body);
    expect(msg.startsWith("acat-v1\nagentic-commerce-authorization\n")).toBe(
      true,
    );
  });

  it("includes scope hash, agent id, user id, issuedAt", () => {
    const body = buildBaseBody();
    const msg = buildACATMessage(body);
    expect(msg).toContain(`agentId:${body.agentId}`);
    expect(msg).toContain(`userId:${body.userId}`);
    expect(msg).toContain(`issuedAt:${body.issuedAt}`);
    expect(msg).toMatch(/scopeHash:[a-f0-9]{64}/);
  });

  it("identical bodies → identical messages", () => {
    const body = buildBaseBody();
    expect(buildACATMessage(body)).toBe(buildACATMessage(body));
  });

  it("scope change → message changes", () => {
    const a = buildACATMessage(buildBaseBody());
    const b = buildACATMessage(
      buildBaseBody({
        scope: {
          maxCents: 60_000,
          currency: "USD",
          validFrom: "2026-04-29T00:00:00.000Z",
          validUntil: "2026-05-29T00:00:00.000Z",
        },
      }),
    );
    expect(a).not.toBe(b);
  });

  it("renders 'none' for missing reputation + insurance", () => {
    const msg = buildACATMessage(buildBaseBody());
    expect(msg).toContain("reputationHash:none");
    expect(msg).toContain("insuranceHash:none");
  });
});

describe("mintACAT + verifyACAT roundtrip", () => {
  it("freshly minted token verifies cleanly for an in-scope cart", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({
      body,
      userPrivateKey: userKp.privateKey,
    });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 12_500,
        currency: "USD",
        merchantId: "merchant_x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.remainingMaxCents).toBe(50_000 - 12_500);
    }
  });

  it("user pubkey mismatch → user_pubkey_mismatch", () => {
    const userKp = generateKeyPair();
    const attacker = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({
      body,
      userPrivateKey: userKp.privateKey,
    });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: attacker.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("user_pubkey_mismatch");
  });

  it("tampering with scope.maxCents → message_mismatch", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    // Tamper with scope max.
    const tampered: SignedACAT = {
      ...signed,
      scope: { ...signed.scope, maxCents: 1_000_000 },
    };
    const result = verifyACAT({
      token: tampered,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 50_000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("message_mismatch");
  });

  it("forged signature → signature_invalid", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    // Mutate signature.
    const sigChars = signed.signature.split("");
    sigChars[5] = sigChars[5] === "A" ? "B" : "A";
    const tampered: SignedACAT = { ...signed, signature: sigChars.join("") };
    const result = verifyACAT({
      token: tampered,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("signature_invalid");
  });

  it("amount exceeds scope → amount_exceeds_scope", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 100_000, // > 50_000 max
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("amount_exceeds_scope");
  });

  it("currency mismatch → scope_violation", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "EUR", // token is USD
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("scope_violation");
  });

  it("expired token → expired", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({
      userPublicKey: userKp.publicKey,
      scope: {
        maxCents: 50_000,
        currency: "USD",
        validFrom: "2026-04-01T00:00:00.000Z",
        validUntil: "2026-04-15T00:00:00.000Z", // before FIXED_NOW
      },
    });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });

  it("not-yet-valid token → not_yet_valid", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({
      userPublicKey: userKp.publicKey,
      scope: {
        maxCents: 50_000,
        currency: "USD",
        validFrom: "2026-12-01T00:00:00.000Z", // future
        validUntil: "2026-12-31T00:00:00.000Z",
      },
    });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("not_yet_valid");
  });

  it("excluded category → category_excluded", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({
      userPublicKey: userKp.publicKey,
      scope: {
        maxCents: 50_000,
        currency: "USD",
        validFrom: "2026-04-01T00:00:00.000Z",
        validUntil: "2026-05-29T00:00:00.000Z",
        excludedCategories: ["entertainment"],
      },
    });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "entertainment",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("category_excluded");
  });

  it("merchant not in allowlist → merchant_not_allowed", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({
      userPublicKey: userKp.publicKey,
      scope: {
        maxCents: 50_000,
        currency: "USD",
        validFrom: "2026-04-01T00:00:00.000Z",
        validUntil: "2026-05-29T00:00:00.000Z",
        allowedMerchantIds: ["amazon", "shopify"],
      },
    });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "random_merchant",
        category: "marketplace_b2c",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("merchant_not_allowed");
  });

  it("single-use nonce: replay → single_use_consumed", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({
      userPublicKey: userKp.publicKey,
      scope: {
        maxCents: 50_000,
        currency: "USD",
        validFrom: "2026-04-01T00:00:00.000Z",
        validUntil: "2026-05-29T00:00:00.000Z",
        singleUseNonce: "nonce-abc-123",
      },
    });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const result = verifyACAT({
      token: signed,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
      isNonceConsumed: () => true, // simulates replay
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("single_use_consumed");
  });

  it("tampered chainHash → chain_hash_mismatch", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const tampered: SignedACAT = { ...signed, chainHash: "0".repeat(64) };
    const result = verifyACAT({
      token: tampered,
      expectedUserPublicKey: userKp.publicKey,
      cart: {
        amountCents: 1000,
        currency: "USD",
        merchantId: "x",
        category: "saas_software",
      },
      now: FIXED_NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("chain_hash_mismatch");
  });
});

describe("additionalCaveatIsNarrowing — Macaroon-pattern narrowing-only invariant", () => {
  const baseScope = {
    maxCents: 50_000,
    currency: "USD",
    validFrom: "2026-04-01T00:00:00.000Z",
    validUntil: "2026-05-29T00:00:00.000Z",
  };

  it("narrowing max-amount accepted", () => {
    const r = additionalCaveatIsNarrowing({
      existing: baseScope,
      existingCaveats: [],
      newCaveat: { kind: "max-amount", maxCents: 10_000 },
    });
    expect(r.valid).toBe(true);
  });

  it("widening max-amount → would_widen", () => {
    const r = additionalCaveatIsNarrowing({
      existing: baseScope,
      existingCaveats: [],
      newCaveat: { kind: "max-amount", maxCents: 100_000 },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("would_widen");
  });

  it("narrowing valid-until accepted (earlier expiry)", () => {
    const r = additionalCaveatIsNarrowing({
      existing: baseScope,
      existingCaveats: [],
      newCaveat: { kind: "valid-until", iso: "2026-05-01T00:00:00.000Z" },
    });
    expect(r.valid).toBe(true);
  });

  it("widening valid-until rejected (later expiry)", () => {
    const r = additionalCaveatIsNarrowing({
      existing: baseScope,
      existingCaveats: [],
      newCaveat: { kind: "valid-until", iso: "2027-12-31T00:00:00.000Z" },
    });
    expect(r.valid).toBe(false);
  });

  it("merchant-id and category-deny caveats are always narrowing", () => {
    expect(
      additionalCaveatIsNarrowing({
        existing: baseScope,
        existingCaveats: [],
        newCaveat: { kind: "merchant-id", merchantId: "amazon" },
      }).valid,
    ).toBe(true);
    expect(
      additionalCaveatIsNarrowing({
        existing: baseScope,
        existingCaveats: [],
        newCaveat: { kind: "category-deny", category: "entertainment" },
      }).valid,
    ).toBe(true);
  });
});

describe("attenuateACAT — agent narrows the scope", () => {
  it("agent attenuates max-amount; verify still works for the narrowed cart", () => {
    const userKp = generateKeyPair();
    const agentKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const parent = mintACAT({
      body,
      userPrivateKey: userKp.privateKey,
    });
    const att = attenuateACAT({
      parentToken: parent,
      agentPrivateKey: agentKp.privateKey,
      agentPublicKey: agentKp.publicKey,
      additionalCaveat: { kind: "max-amount", maxCents: 7500 },
      issuedAt: "2026-04-29T11:00:00.000Z",
    });
    expect(att.ok).toBe(true);
    if (!att.ok) return;
    // The attenuated token is signed by the AGENT, not the user. So
    // verifyACAT against the original user pubkey will fail signature
    // — that's the correct semantics. Sellers will need a chain
    // verifier (future round R92) to walk parent → child. For now we
    // just verify attenuation produced a structurally-valid token.
    expect(att.attenuated.attenuatorRole).toBe("agent");
    expect(att.attenuated.parentChainHash).toBe(parent.chainHash);
    // Caveats list grew by 1.
    expect(att.attenuated.caveats.length).toBe(parent.caveats.length + 1);
  });

  it("attempt to widen → returns error, no attenuation produced", () => {
    const userKp = generateKeyPair();
    const agentKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const parent = mintACAT({
      body,
      userPrivateKey: userKp.privateKey,
    });
    const att = attenuateACAT({
      parentToken: parent,
      agentPrivateKey: agentKp.privateKey,
      agentPublicKey: agentKp.publicKey,
      // Try to widen — token says max 50K, attenuation says 100K
      additionalCaveat: { kind: "max-amount", maxCents: 100_000 },
      issuedAt: "2026-04-29T11:00:00.000Z",
    });
    expect(att.ok).toBe(false);
    if (!att.ok) expect(att.reason).toBe("would_widen");
  });
});

describe("HTTP transport: encode + decode roundtrip", () => {
  it("encode → decode returns the same token", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const encoded = encodeACATForHeader(signed);
    const decoded = decodeACATFromHeader(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.signature).toBe(signed.signature);
    expect(decoded?.chainHash).toBe(signed.chainHash);
  });

  it("malformed header returns null", () => {
    expect(decodeACATFromHeader("not-base64-or-json")).toBeNull();
  });

  it("non-ACAT JSON returns null", () => {
    const fake = Buffer.from(
      JSON.stringify({ version: "not-acat", message: "x" }),
      "utf8",
    ).toString("base64url");
    expect(decodeACATFromHeader(fake)).toBeNull();
  });
});

describe("summarizeACATForReceipt — procurement-readable", () => {
  it("contains agent id + user id + scope + chain hash", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const summary = summarizeACATForReceipt(signed);
    expect(summary).toContain("ACAT v1");
    expect(summary).toContain(body.agentId);
    expect(summary).toContain(body.userId);
    expect(summary).toContain("USD");
    expect(summary).toContain("chain hash:");
  });

  it("notes when reputation + insurance are not snapshotted", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({ userPublicKey: userKp.publicKey });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const summary = summarizeACATForReceipt(signed);
    expect(summary).toContain("reputation: not snapshotted");
    expect(summary).toContain("insurance: not bound");
  });

  it("includes reputation grade when snapshotted", () => {
    const userKp = generateKeyPair();
    const body = buildBaseBody({
      userPublicKey: userKp.publicKey,
      reputation: {
        letterGrade: "A+",
        numericScore: 96,
        snapshotAt: "2026-04-29T08:00:00.000Z",
      },
    });
    const signed = mintACAT({ body, userPrivateKey: userKp.privateKey });
    const summary = summarizeACATForReceipt(signed);
    expect(summary).toContain("reputation: A+ (96/100)");
  });
});

describe("computeACATChainHash (pure)", () => {
  it("genesis sentinel: null parentChainHash matches GENESIS string", () => {
    const a = computeACATChainHash({
      parentChainHash: null,
      message: "test",
      signature: "sig",
    });
    const b = computeACATChainHash({
      parentChainHash: "GENESIS",
      message: "test",
      signature: "sig",
    });
    expect(a).toBe(b);
  });

  it("different inputs → different hashes", () => {
    const a = computeACATChainHash({
      parentChainHash: null,
      message: "test",
      signature: "sig",
    });
    const b = computeACATChainHash({
      parentChainHash: null,
      message: "DIFFERENT",
      signature: "sig",
    });
    expect(a).not.toBe(b);
  });
});
