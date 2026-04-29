/**
 * @sovereign/inspector — verify primitives tests.
 *
 * Mirrors the server-side test suite for agent-delegation.ts to
 * confirm the standalone npm package produces IDENTICAL hashes,
 * messages, and verifications. If these tests pass, customers using
 * the npm package compute the same answers our server computes.
 */

import { describe, it, expect } from "vitest";
import {
  signMessage,
  verifySignature,
  buildDelegationMessage,
  buildActionDigest,
  computeChainHash,
  canonicalJsonStringify,
  verifyDelegation,
  verifyAgentAction,
  verifyAuditChain,
} from "../src/verify.mjs";
import { generateKeyPairSync, createHash } from "node:crypto";

// ── Helper: generate a test keypair (mirrors lib's internal helper) ─
function makeKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" });
  const priv = privateKey.export({ format: "der", type: "pkcs8" });
  const rawPub = pub.subarray(pub.length - 32);
  const rawPriv = priv.subarray(priv.length - 32);
  return {
    publicKey: rawPub.toString("base64url"),
    privateKey: rawPriv.toString("base64url"),
  };
}

describe("@sovereign/inspector — verify primitives", () => {
  it("signMessage + verifySignature roundtrip", () => {
    const k = makeKey();
    const msg = "hello sovereign";
    const sig = signMessage(k.privateKey, msg);
    expect(verifySignature(k.publicKey, msg, sig)).toBe(true);
  });

  it("verifySignature rejects tampered message", () => {
    const k = makeKey();
    const sig = signMessage(k.privateKey, "real");
    expect(verifySignature(k.publicKey, "fake", sig)).toBe(false);
  });

  it("verifySignature returns false on garbage (never throws)", () => {
    expect(verifySignature("garbage", "msg", "sig")).toBe(false);
    expect(verifySignature("", "", "")).toBe(false);
  });

  it("canonicalJsonStringify is key-order-independent", () => {
    expect(canonicalJsonStringify({ a: 1, b: 2 })).toBe(
      canonicalJsonStringify({ b: 2, a: 1 }),
    );
  });

  it("buildDelegationMessage is deterministic", () => {
    const c = {
      userId: "user_x",
      agentName: "agent_y",
      agentPublicKey: "pubkey_z",
      scope: { max_cents: 100 },
      issuedAt: "2026-04-28T00:00:00Z",
      expiresAt: "2027-04-28T00:00:00Z",
    };
    expect(buildDelegationMessage(c)).toBe(buildDelegationMessage(c));
  });

  it("buildDelegationMessage changes when ANY field changes", () => {
    const base = {
      userId: "u",
      agentName: "a",
      agentPublicKey: "p",
      scope: { x: 1 },
      issuedAt: "2026-01-01T00:00:00Z",
      expiresAt: "2027-01-01T00:00:00Z",
    };
    const m0 = buildDelegationMessage(base);
    expect(buildDelegationMessage({ ...base, agentName: "different" })).not.toBe(m0);
    expect(buildDelegationMessage({ ...base, scope: { x: 2 } })).not.toBe(m0);
    expect(buildDelegationMessage({ ...base, expiresAt: "2030-01-01T00:00:00Z" })).not.toBe(m0);
  });

  it("verifyDelegation: valid signed delegation passes", () => {
    const userKey = makeKey();
    const agentKey = makeKey();
    const contents = {
      userId: "u",
      agentName: "a",
      agentPublicKey: agentKey.publicKey,
      scope: { max_cents: 5000 },
      issuedAt: "2026-04-28T00:00:00Z",
      expiresAt: "2099-04-28T00:00:00Z",
    };
    const message = buildDelegationMessage(contents);
    const signature = signMessage(userKey.privateKey, message);
    const r = verifyDelegation({
      delegation: { ...contents, delegationMessage: message, userSignature: signature },
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: true, revoked: false });
  });

  it("verifyDelegation: forged signature rejected", () => {
    const userKey = makeKey();
    const attackerKey = makeKey();
    const agentKey = makeKey();
    const contents = {
      userId: "u",
      agentName: "a",
      agentPublicKey: agentKey.publicKey,
      scope: {},
      issuedAt: "2026-04-28T00:00:00Z",
      expiresAt: "2099-04-28T00:00:00Z",
    };
    const message = buildDelegationMessage(contents);
    const forgedSig = signMessage(attackerKey.privateKey, message);
    const r = verifyDelegation({
      delegation: { ...contents, delegationMessage: message, userSignature: forgedSig },
      userPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "user_signature_invalid" });
  });

  it("verifyAgentAction: payload tampering caught", () => {
    const agentKey = makeKey();
    const digest = buildActionDigest({
      action: "execute",
      agentName: "a",
      timestampIso: "2026-04-28T00:00:00Z",
      payload: { real: true },
    });
    const sig = signMessage(agentKey.privateKey, digest);
    const r = verifyAgentAction({
      action: "execute",
      agentName: "a",
      timestampIso: "2026-04-28T00:00:00Z",
      payload: { real: false }, // tampered
      agentSignature: sig,
      agentPublicKey: agentKey.publicKey,
      expectedChainHash: "any",
      prevChainHash: null,
    });
    expect(r).toEqual({ valid: false, reason: "agent_signature_invalid" });
  });

  it("computeChainHash: tampering with prev breaks the chain", () => {
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

  it("verifyAuditChain: empty array is trivially valid", () => {
    expect(verifyAuditChain([])).toEqual({ valid: true, rowCount: 0 });
  });

  it("verifyAuditChain: detects tampered row", () => {
    // Synthesize a row, compute its expected hash, then tamper.
    const row1 = {
      id: "1",
      userId: "u",
      action: "agent.execute",
      resource: "agent_x",
      details: { ok: true },
      createdAt: "2026-04-28T00:00:00.000Z",
    };
    const detailsCanonical = canonicalJsonStringify(row1.details);
    row1.rowHash = createHash("sha256")
      .update(["GENESIS", row1.userId, row1.action, row1.resource, detailsCanonical, row1.createdAt].join("|"))
      .digest("hex");
    // Valid:
    expect(verifyAuditChain([row1])).toEqual({ valid: true, rowCount: 1 });
    // Tampered:
    const tampered = { ...row1, rowHash: "0".repeat(64) };
    const result = verifyAuditChain([tampered]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAt).toBe("1");
    }
  });
});
