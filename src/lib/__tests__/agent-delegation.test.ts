/**
 * agent-delegation — tests.
 *
 * Verifies:
 *   - Key generation produces verifiable signatures
 *   - canonicalJsonStringify is deterministic + key-order-independent
 *   - buildDelegationMessage is deterministic + reconstructable
 *   - verifyDelegation: valid path + every failure mode
 *   - verifyAgentAction: valid path + tampering detection
 *   - computeChainHash: chain integrity (tamper detection)
 *   - REPLAY ATTACK: an attacker can't reuse signatures with different
 *     contexts (agent, scope, expiry)
 *
 * The Ed25519 primitives themselves are battle-tested (node:crypto);
 * we test the COMPOSITION + CHAIN HASH logic that's specific to us.
 */

import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  signMessage,
  verifySignature,
  buildDelegationMessage,
  buildRevocationMessage,
  buildActionDigest,
  computeChainHash,
  verifyDelegation,
  verifyAgentAction,
  canonicalJsonStringify,
  toBase64Url,
  fromBase64Url,
} from "../agent-delegation";

describe("agent-delegation — key generation + sign/verify", () => {
  it("generates a 32-byte ed25519 keypair (b64url-encoded)", () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(typeof publicKey).toBe("string");
    expect(typeof privateKey).toBe("string");
    // base64url of 32 bytes is 43 chars (no padding).
    expect(publicKey.length).toBe(43);
    expect(privateKey.length).toBe(43);
  });

  it("signMessage produces a verifiable signature", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const msg = "hello world";
    const sig = signMessage(privateKey, msg);
    expect(typeof sig).toBe("string");
    expect(sig.length).toBe(86); // base64url of 64 bytes
    expect(verifySignature(publicKey, msg, sig)).toBe(true);
  });

  it("verifySignature rejects tampered messages", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const sig = signMessage(privateKey, "original");
    expect(verifySignature(publicKey, "tampered", sig)).toBe(false);
  });

  it("verifySignature rejects when public key doesn't match", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const sig = signMessage(a.privateKey, "msg");
    expect(verifySignature(b.publicKey, "msg", sig)).toBe(false);
  });

  it("verifySignature returns false (never throws) on garbage inputs", () => {
    expect(verifySignature("garbage", "msg", "sig")).toBe(false);
    expect(verifySignature("", "", "")).toBe(false);
  });
});

describe("agent-delegation — encoding helpers", () => {
  it("toBase64Url + fromBase64Url roundtrip", () => {
    const bytes = Buffer.from([1, 2, 3, 254, 255]);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toContain("+"); // url-safe
    expect(encoded).not.toContain("/"); // url-safe
    expect(encoded).not.toContain("=");  // no padding
    const decoded = fromBase64Url(encoded);
    expect(decoded.equals(bytes)).toBe(true);
  });

  it("fromBase64Url throws on empty input (defensive)", () => {
    expect(() => fromBase64Url("")).toThrow();
  });
});

describe("agent-delegation — canonicalJsonStringify", () => {
  it("is key-order independent (same hash regardless of insertion order)", () => {
    expect(canonicalJsonStringify({ a: 1, b: 2 })).toBe(
      canonicalJsonStringify({ b: 2, a: 1 }),
    );
  });

  it("preserves array order (semantically meaningful)", () => {
    expect(canonicalJsonStringify([1, 2, 3])).toBe('[1,2,3]');
    expect(canonicalJsonStringify([1, 2, 3])).not.toBe(
      canonicalJsonStringify([3, 2, 1]),
    );
  });

  it("normalizes null/undefined to null", () => {
    expect(canonicalJsonStringify(null)).toBe("null");
    expect(canonicalJsonStringify(undefined)).toBe("null");
  });

  it("handles nested objects deterministically", () => {
    const a = { outer: { inner: { x: 1, y: 2 } } };
    const b = { outer: { inner: { y: 2, x: 1 } } };
    expect(canonicalJsonStringify(a)).toBe(canonicalJsonStringify(b));
  });

  it("Infinity / NaN normalized to null (JSON-safe)", () => {
    expect(canonicalJsonStringify(Infinity)).toBe("null");
    expect(canonicalJsonStringify(NaN)).toBe("null");
  });
});

describe("agent-delegation — buildDelegationMessage", () => {
  const userKey = generateKeyPair();
  const agentKey = generateKeyPair();
  const baseContents = {
    userId: "user_alpha",
    agentName: "travel-agent",
    agentPublicKey: agentKey.publicKey,
    scope: { max_cents: 5000 },
    issuedAt: "2026-04-28T12:00:00Z",
    expiresAt: "2026-05-28T12:00:00Z",
  };

  it("is deterministic for identical inputs", () => {
    const m1 = buildDelegationMessage(baseContents);
    const m2 = buildDelegationMessage(baseContents);
    expect(m1).toBe(m2);
  });

  it("is key-order independent on scope (canonical-JSON)", () => {
    const a = buildDelegationMessage({
      ...baseContents,
      scope: { max_cents: 5000, allowed: ["x", "y"] },
    });
    const b = buildDelegationMessage({
      ...baseContents,
      scope: { allowed: ["x", "y"], max_cents: 5000 },
    });
    expect(a).toBe(b);
  });

  it("changes when ANY field changes (replay-attack defense)", () => {
    const base = buildDelegationMessage(baseContents);
    expect(buildDelegationMessage({ ...baseContents, agentName: "other" })).not.toBe(base);
    expect(
      buildDelegationMessage({ ...baseContents, agentPublicKey: userKey.publicKey }),
    ).not.toBe(base);
    expect(
      buildDelegationMessage({ ...baseContents, expiresAt: "2027-01-01T00:00:00Z" }),
    ).not.toBe(base);
    expect(
      buildDelegationMessage({ ...baseContents, scope: { max_cents: 9999 } }),
    ).not.toBe(base);
  });
});

describe("agent-delegation — verifyDelegation full path", () => {
  function makeDelegation(overrides: Record<string, unknown> = {}) {
    const userKey = generateKeyPair();
    const agentKey = generateKeyPair();
    const contents = {
      userId: "user_alpha",
      agentName: "travel-agent",
      agentPublicKey: agentKey.publicKey,
      scope: { max_cents: 5000 },
      issuedAt: "2026-04-28T12:00:00Z",
      expiresAt: "2099-04-28T12:00:00Z", // far future
    };
    const message = buildDelegationMessage(contents);
    const signature = signMessage(userKey.privateKey, message);
    return {
      userKey,
      agentKey,
      delegation: {
        ...contents,
        delegationMessage: message,
        userSignature: signature,
        ...overrides,
      },
    };
  }

  it("valid signed delegation → valid + not revoked", () => {
    const { userKey, delegation } = makeDelegation();
    const r = verifyDelegation({
      delegation,
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: true, revoked: false });
  });

  it("rejects when delegation_message doesn't match canonical form", () => {
    const { userKey, delegation } = makeDelegation({
      delegationMessage: "tampered",
    });
    const r = verifyDelegation({
      delegation,
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "delegation_message_mismatch" });
  });

  it("rejects when signature is from wrong key (forgery defense)", () => {
    // Attacker signs the SAME canonical message with their own key.
    // Verifier checks against the legitimate user's public key — fails.
    const { userKey, delegation } = makeDelegation();
    const attacker = generateKeyPair();
    const forgedSig = signMessage(attacker.privateKey, delegation.delegationMessage);
    const r = verifyDelegation({
      delegation: { ...delegation, userSignature: forgedSig },
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "user_signature_invalid" });
  });

  it("rejects when expired", () => {
    const { userKey, delegation } = makeDelegation({
      expiresAt: "2020-01-01T00:00:00Z",
    });
    // Re-build the message + signature for the new expiry to keep
    // the sig valid for everything else; the test then checks the
    // expiry path independently.
    const userKey2 = generateKeyPair();
    const contents = {
      userId: delegation.userId,
      agentName: delegation.agentName,
      agentPublicKey: delegation.agentPublicKey,
      scope: delegation.scope,
      issuedAt: delegation.issuedAt,
      expiresAt: "2020-01-01T00:00:00Z",
    };
    const expiredMsg = buildDelegationMessage(contents);
    const expiredSig = signMessage(userKey2.privateKey, expiredMsg);
    const r = verifyDelegation({
      delegation: {
        ...contents,
        delegationMessage: expiredMsg,
        userSignature: expiredSig,
      },
      userPublicKey: userKey2.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "delegation_expired" });
  });

  it("revoked-but-with-valid-revocation-signature → valid + revoked:true", () => {
    const { userKey, delegation } = makeDelegation();
    const revocationMsg = buildRevocationMessage({
      delegationId: "del_123",
      reason: "lost device",
      issuedAt: "2026-04-29T12:00:00Z",
    });
    const revocationSig = signMessage(userKey.privateKey, revocationMsg);
    const r = verifyDelegation({
      delegation: {
        ...delegation,
        revokedAt: "2026-04-29T12:00:00Z",
        revocationMessage: revocationMsg,
        revocationSignature: revocationSig,
      },
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: true, revoked: true });
  });

  it("revoked but revocation signature MISSING → invalid", () => {
    const { userKey, delegation } = makeDelegation();
    const r = verifyDelegation({
      delegation: {
        ...delegation,
        revokedAt: "2026-04-29T12:00:00Z",
      },
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "revocation_signature_missing" });
  });

  it("revoked with FORGED revocation signature → invalid (kill-switch fraud defense)", () => {
    const { userKey, delegation } = makeDelegation();
    const attacker = generateKeyPair();
    const revocationMsg = buildRevocationMessage({
      delegationId: "del_123",
      reason: "evil",
      issuedAt: "2026-04-29T12:00:00Z",
    });
    // Attacker signs the revocation with their OWN key, hoping to
    // kill the user's delegation. Verifier rejects.
    const fakeSig = signMessage(attacker.privateKey, revocationMsg);
    const r = verifyDelegation({
      delegation: {
        ...delegation,
        revokedAt: "2026-04-29T12:00:00Z",
        revocationMessage: revocationMsg,
        revocationSignature: fakeSig,
      },
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "revocation_signature_invalid" });
  });
});

describe("agent-delegation — verifyAgentAction + chain hash", () => {
  it("valid action → recomputes digest, chain matches", () => {
    const agentKey = generateKeyPair();
    const action = "execute";
    const agentName = "travel-agent";
    const timestampIso = "2026-04-28T12:34:56Z";
    const payload = { destination: "NYC", costCents: 29900 };
    const digest = buildActionDigest({ action, agentName, timestampIso, payload });
    const sig = signMessage(agentKey.privateKey, digest);
    const chain = computeChainHash({
      prevChainHash: null,
      actionDigest: digest,
      agentSignature: sig,
    });
    const r = verifyAgentAction({
      action,
      agentName,
      timestampIso,
      payload,
      agentSignature: sig,
      agentPublicKey: agentKey.publicKey,
      expectedChainHash: chain,
      prevChainHash: null,
    });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.recomputedDigest).toBe(digest);
  });

  it("payload tampering breaks the digest → invalid signature", () => {
    const agentKey = generateKeyPair();
    const digest = buildActionDigest({
      action: "execute",
      agentName: "travel-agent",
      timestampIso: "2026-04-28T12:34:56Z",
      payload: { destination: "NYC" },
    });
    const sig = signMessage(agentKey.privateKey, digest);
    // Now verifier reconstructs with TAMPERED payload — different digest,
    // signature won't match.
    const r = verifyAgentAction({
      action: "execute",
      agentName: "travel-agent",
      timestampIso: "2026-04-28T12:34:56Z",
      payload: { destination: "Tokyo" }, // tampered
      agentSignature: sig,
      agentPublicKey: agentKey.publicKey,
      expectedChainHash: "any",
      prevChainHash: null,
    });
    expect(r).toEqual({ valid: false, reason: "agent_signature_invalid" });
  });

  it("chain hash mismatch detected (tampering with past row breaks chain)", () => {
    const agentKey = generateKeyPair();
    const action = "execute";
    const agentName = "travel-agent";
    const timestampIso = "2026-04-28T12:34:56Z";
    const payload = { x: 1 };
    const digest = buildActionDigest({ action, agentName, timestampIso, payload });
    const sig = signMessage(agentKey.privateKey, digest);
    const r = verifyAgentAction({
      action,
      agentName,
      timestampIso,
      payload,
      agentSignature: sig,
      agentPublicKey: agentKey.publicKey,
      expectedChainHash: "0".repeat(64), // forged
      prevChainHash: null,
    });
    expect(r).toEqual({ valid: false, reason: "chain_hash_mismatch" });
  });
});

describe("agent-delegation — chain hash genesis + linking", () => {
  it("genesis row uses 'GENESIS' as prev", () => {
    const h1 = computeChainHash({
      prevChainHash: null,
      actionDigest: "abc",
      agentSignature: "xyz",
    });
    const h2 = computeChainHash({
      prevChainHash: "GENESIS",
      actionDigest: "abc",
      agentSignature: "xyz",
    });
    expect(h1).toBe(h2);
  });

  it("changing prev_hash changes the chain (any tampering propagates forward)", () => {
    const a = computeChainHash({
      prevChainHash: "aaa",
      actionDigest: "abc",
      agentSignature: "xyz",
    });
    const b = computeChainHash({
      prevChainHash: "bbb",
      actionDigest: "abc",
      agentSignature: "xyz",
    });
    expect(a).not.toBe(b);
  });
});
