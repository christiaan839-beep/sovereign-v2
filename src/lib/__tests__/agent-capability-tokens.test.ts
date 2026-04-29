/**
 * Agent Capability Tokens — tests.
 *
 * Verifies:
 *   - mintToken produces verifiable signed tokens
 *   - attenuateToken narrows caveats correctly
 *   - narrowsCaveats catches every widening attempt
 *   - mergeCaveats takes the more restrictive of each dimension
 *   - caveatsSatisfied evaluates each caveat type
 *   - verifyTokenChain end-to-end (multi-level)
 *
 * SECURITY-CRITICAL TESTS:
 *   - Forged signature (attacker mints a "child" without parent's key)
 *   - Widened caveats (attacker tries to expand max_cents)
 *   - Tampered chain hash (attacker rewrites a past token)
 *   - Replayed expired token
 *   - Wrong root issuer (attacker tries to substitute root)
 *   - Action exceeds caveats (cost > max_cents)
 */

import { describe, it, expect } from "vitest";
import {
  buildTokenMessage,
  computeTokenChainHash,
  mintToken,
  attenuateToken,
  mergeCaveats,
  narrowsCaveats,
  caveatsSatisfied,
  verifyTokenChain,
  type ActToken,
} from "../agent-capability-tokens";
import { generateKeyPair } from "../agent-delegation";

const FAR_FUTURE = "2099-12-31T00:00:00Z";

describe("ACT — buildTokenMessage", () => {
  it("is deterministic for identical inputs", () => {
    const input = {
      parentChainHash: null,
      issuerPublicKey: "issuer",
      subjectPublicKey: "subject",
      caveats: { max_cents: 100 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    };
    expect(buildTokenMessage(input)).toBe(buildTokenMessage(input));
  });

  it("is key-order independent on caveats", () => {
    const a = buildTokenMessage({
      parentChainHash: null,
      issuerPublicKey: "i",
      subjectPublicKey: "s",
      caveats: { max_cents: 100, allowed_actions: ["x"] },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const b = buildTokenMessage({
      parentChainHash: null,
      issuerPublicKey: "i",
      subjectPublicKey: "s",
      caveats: { allowed_actions: ["x"], max_cents: 100 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    expect(a).toBe(b);
  });

  it("changes when ANY field changes", () => {
    const base = {
      parentChainHash: null,
      issuerPublicKey: "i",
      subjectPublicKey: "s",
      caveats: { max_cents: 100 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    };
    const m0 = buildTokenMessage(base);
    expect(buildTokenMessage({ ...base, issuerPublicKey: "other" })).not.toBe(m0);
    expect(buildTokenMessage({ ...base, caveats: { max_cents: 200 } })).not.toBe(m0);
    expect(buildTokenMessage({ ...base, parentChainHash: "abc" })).not.toBe(m0);
  });
});

describe("ACT — narrowsCaveats", () => {
  it("identical caveats narrow trivially", () => {
    const c = { max_cents: 100 };
    expect(narrowsCaveats(c, c).ok).toBe(true);
  });

  it("widening max_cents fails", () => {
    const r = narrowsCaveats({ max_cents: 100 }, { max_cents: 200 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("max_cents_widened");
  });

  it("removing max_cents fails (no constraint = wider)", () => {
    const r = narrowsCaveats({ max_cents: 100 }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("max_cents_widened");
  });

  it("extending expires_at fails", () => {
    const r = narrowsCaveats(
      { expires_at: "2026-05-01T00:00:00Z" },
      { expires_at: "2026-06-01T00:00:00Z" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expires_at_extended");
  });

  it("removing expires_at fails (parent had expiry)", () => {
    const r = narrowsCaveats({ expires_at: "2026-05-01T00:00:00Z" }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expires_at_removed");
  });

  it("adding to allowed_merchants fails (must be subset)", () => {
    const r = narrowsCaveats(
      { allowed_merchants: ["A", "B"] },
      { allowed_merchants: ["A", "B", "C"] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/allowed_merchants_added:C/);
  });

  it("subset of allowed_merchants narrows", () => {
    expect(
      narrowsCaveats(
        { allowed_merchants: ["A", "B", "C"] },
        { allowed_merchants: ["A"] },
      ).ok,
    ).toBe(true);
  });

  it("adding allowed_actions fails", () => {
    expect(
      narrowsCaveats(
        { allowed_actions: ["read"] },
        { allowed_actions: ["read", "write"] },
      ).ok,
    ).toBe(false);
  });

  it("adding merchant_categories fails", () => {
    expect(
      narrowsCaveats(
        { merchant_categories: ["travel"] },
        { merchant_categories: ["travel", "food"] },
      ).ok,
    ).toBe(false);
  });
});

describe("ACT — mergeCaveats", () => {
  it("takes min of max_cents", () => {
    expect(
      mergeCaveats({ max_cents: 1000 }, { max_cents: 200 }).max_cents,
    ).toBe(200);
    expect(
      mergeCaveats({ max_cents: 1000 }, { max_cents: 5000 }).max_cents,
    ).toBe(1000);
  });

  it("takes earliest expires_at", () => {
    expect(
      mergeCaveats(
        { expires_at: "2026-06-01T00:00:00Z" },
        { expires_at: "2026-05-01T00:00:00Z" },
      ).expires_at,
    ).toBe("2026-05-01T00:00:00Z");
  });

  it("intersects allowed_merchants", () => {
    expect(
      mergeCaveats(
        { allowed_merchants: ["A", "B", "C"] },
        { allowed_merchants: ["B", "C", "D"] },
      ).allowed_merchants,
    ).toEqual(["B", "C"]);
  });
});

describe("ACT — caveatsSatisfied", () => {
  const now = new Date("2026-04-29T12:00:00Z");

  it("all caveats satisfied → ok", () => {
    const r = caveatsSatisfied(
      { max_cents: 1000, allowed_merchants: ["AirlineCo"], expires_at: FAR_FUTURE },
      { action: "purchase", costCents: 500, merchantName: "AirlineCo" },
      now,
    );
    expect(r.ok).toBe(true);
  });

  it("expired caveat fails", () => {
    const r = caveatsSatisfied(
      { expires_at: "2020-01-01T00:00:00Z" },
      { action: "purchase" },
      now,
    );
    expect(r.ok).toBe(false);
  });

  it("max_cents exceeded fails", () => {
    const r = caveatsSatisfied(
      { max_cents: 100 },
      { action: "purchase", costCents: 200 },
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("caveat_max_cents_exceeded");
  });

  it("merchant not in allowlist fails", () => {
    const r = caveatsSatisfied(
      { allowed_merchants: ["AirlineCo"] },
      { action: "purchase", costCents: 100, merchantName: "RandomShop" },
      now,
    );
    expect(r.ok).toBe(false);
  });

  it("action not in allowlist fails", () => {
    const r = caveatsSatisfied(
      { allowed_actions: ["read"] },
      { action: "delete" },
      now,
    );
    expect(r.ok).toBe(false);
  });
});

describe("ACT — mintToken + verifyTokenChain (single root)", () => {
  it("root token verifies against issuer's pubkey", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: { max_cents: 1000 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [root],
      action: { action: "purchase", costCents: 500 },
    });
    expect(r.valid).toBe(true);
  });

  it("root with WRONG issuer pubkey fails", () => {
    const userKey = generateKeyPair();
    const attackerKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: { max_cents: 1000 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const r = verifyTokenChain({
      rootIssuerPublicKey: attackerKey.publicKey, // wrong root
      chain: [root],
      action: { action: "purchase", costCents: 500 },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("root_issuer_mismatch");
  });

  it("forged signature fails verification", () => {
    const userKey = generateKeyPair();
    const attackerKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: attackerKey.privateKey, // forged: attacker signs
      issuerPublicKey: userKey.publicKey, // claims to be user
      subjectPublicKey: agentKey.publicKey,
      caveats: { max_cents: 1000 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [root],
      action: { action: "purchase", costCents: 500 },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("signature_invalid");
  });

  it("expired token fails", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: {},
      issuedAt: "2020-01-01T00:00:00Z",
      expiresAt: "2020-01-02T00:00:00Z",
    });
    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [root],
      action: { action: "purchase" },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("token_expired");
  });
});

describe("ACT — attenuateToken (multi-level chain)", () => {
  it("3-level chain: user → agentA → agentB → merchant verifies", () => {
    const userKey = generateKeyPair();
    const agentAKey = generateKeyPair();
    const agentBKey = generateKeyPair();
    const merchantKey = generateKeyPair();

    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentAKey.publicKey,
      caveats: { max_cents: 10000, allowed_merchants: ["AirlineCo", "HotelCo"] },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });

    const lv1 = attenuateToken({
      parent: root,
      attenuatorPrivateKey: agentAKey.privateKey,
      newSubjectPublicKey: agentBKey.publicKey,
      additionalCaveats: { max_cents: 5000, allowed_merchants: ["AirlineCo"] },
      issuedAt: "2026-04-29T00:01:00Z",
      expiresAt: FAR_FUTURE,
    });
    expect("error" in lv1).toBe(false);
    if ("error" in lv1) return;

    const lv2 = attenuateToken({
      parent: lv1,
      attenuatorPrivateKey: agentBKey.privateKey,
      newSubjectPublicKey: merchantKey.publicKey,
      additionalCaveats: { max_cents: 300 },
      issuedAt: "2026-04-29T00:02:00Z",
      expiresAt: FAR_FUTURE,
    });
    expect("error" in lv2).toBe(false);
    if ("error" in lv2) return;

    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [root, lv1, lv2],
      action: { action: "purchase", costCents: 250, merchantName: "AirlineCo" },
    });
    expect(r.valid).toBe(true);
  });

  it("attenuation cannot WIDEN max_cents", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const subAgentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: { max_cents: 100 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const result = attenuateToken({
      parent: root,
      attenuatorPrivateKey: agentKey.privateKey,
      newSubjectPublicKey: subAgentKey.publicKey,
      additionalCaveats: { max_cents: 1000 }, // attempt to widen
      issuedAt: "2026-04-29T00:01:00Z",
      expiresAt: FAR_FUTURE,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/attenuation_widened_caveats/);
    }
  });

  it("attenuation cannot extend expiry", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const subAgentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: {},
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: "2026-05-01T00:00:00Z",
    });
    const result = attenuateToken({
      parent: root,
      attenuatorPrivateKey: agentKey.privateKey,
      newSubjectPublicKey: subAgentKey.publicKey,
      additionalCaveats: {},
      issuedAt: "2026-04-29T00:01:00Z",
      expiresAt: "2026-06-01T00:00:00Z", // extended
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("attenuation_expiry_extended");
    }
  });

  it("attenuator's private key MUST match parent's subject (cryptographic enforcement)", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const attackerKey = generateKeyPair();
    const merchantKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: { max_cents: 1000 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    // Attacker tries to attenuate with their OWN private key (not the
    // legitimate agent's). The attenuation function returns a token,
    // but verification fails because the signature won't match the
    // declared issuer (which is the parent's subject).
    const lv1 = attenuateToken({
      parent: root,
      attenuatorPrivateKey: attackerKey.privateKey,
      newSubjectPublicKey: merchantKey.publicKey,
      additionalCaveats: { max_cents: 500 },
      issuedAt: "2026-04-29T00:01:00Z",
      expiresAt: FAR_FUTURE,
    });
    expect("error" in lv1).toBe(false);
    if ("error" in lv1) return;
    // But verification fails:
    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [root, lv1],
      action: { action: "purchase", costCents: 100 },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      // Either signature fails to verify against agent's pubkey, or the
      // token message references the wrong issuer. Either way: rejected.
      expect(r.reason).toMatch(/signature_invalid|issuer_not_parent_subject/);
    }
  });

  it("tampered chain hash detected", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: {},
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const tampered: ActToken = { ...root, chainHash: "0".repeat(64) };
    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [tampered],
      action: { action: "purchase" },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("chain_hash_mismatch");
  });

  it("action exceeds leaf's max_cents → rejected", () => {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const root = mintToken({
      issuerPrivateKey: userKey.privateKey,
      issuerPublicKey: userKey.publicKey,
      subjectPublicKey: agentKey.publicKey,
      caveats: { max_cents: 100 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const r = verifyTokenChain({
      rootIssuerPublicKey: userKey.publicKey,
      chain: [root],
      action: { action: "purchase", costCents: 500 },
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("caveat_max_cents_exceeded");
  });

  it("4-level chain: max_cents narrows correctly through every level", () => {
    const k = [generateKeyPair(), generateKeyPair(), generateKeyPair(), generateKeyPair(), generateKeyPair()];
    let cur: ActToken = mintToken({
      issuerPrivateKey: k[0].privateKey,
      issuerPublicKey: k[0].publicKey,
      subjectPublicKey: k[1].publicKey,
      caveats: { max_cents: 10000 },
      issuedAt: "2026-04-29T00:00:00Z",
      expiresAt: FAR_FUTURE,
    });
    const chain: ActToken[] = [cur];
    for (let i = 1; i < 4; i++) {
      const next = attenuateToken({
        parent: cur,
        attenuatorPrivateKey: k[i].privateKey,
        newSubjectPublicKey: k[i + 1].publicKey,
        additionalCaveats: { max_cents: 10000 / Math.pow(2, i) },
        issuedAt: `2026-04-29T00:0${i}:00Z`,
        expiresAt: FAR_FUTURE,
      });
      expect("error" in next).toBe(false);
      if ("error" in next) return;
      cur = next;
      chain.push(cur);
    }
    // Final leaf: max_cents = 10000/8 = 1250
    const r = verifyTokenChain({
      rootIssuerPublicKey: k[0].publicKey,
      chain,
      action: { action: "purchase", costCents: 1000 },
    });
    expect(r.valid).toBe(true);
    // Action above leaf's cap fails:
    const r2 = verifyTokenChain({
      rootIssuerPublicKey: k[0].publicKey,
      chain,
      action: { action: "purchase", costCents: 1500 },
    });
    expect(r2.valid).toBe(false);
  });
});

describe("ACT — computeTokenChainHash", () => {
  it("genesis (null parent) === 'GENESIS' literal", () => {
    const a = computeTokenChainHash({
      parentChainHash: null,
      tokenMessage: "msg",
      signature: "sig",
    });
    const b = computeTokenChainHash({
      parentChainHash: "GENESIS",
      tokenMessage: "msg",
      signature: "sig",
    });
    expect(a).toBe(b);
  });

  it("any change to inputs changes the hash", () => {
    const base = {
      parentChainHash: "abc",
      tokenMessage: "msg",
      signature: "sig",
    };
    const h0 = computeTokenChainHash(base);
    expect(computeTokenChainHash({ ...base, tokenMessage: "other" })).not.toBe(h0);
    expect(computeTokenChainHash({ ...base, signature: "other" })).not.toBe(h0);
    expect(computeTokenChainHash({ ...base, parentChainHash: "def" })).not.toBe(h0);
  });
});
