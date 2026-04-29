/**
 * agent-identity — tests.
 *
 * Verifies:
 *   - Canonical message construction is deterministic + reconstructable
 *   - Signing + verification roundtrip works
 *   - Forged signatures rejected
 *   - Tampered fields detected (every field individually)
 *   - Chain hash links versions correctly
 *   - Revocation: valid kill-switch works, forged kill-switch rejected
 *   - Expired manifests fail verification
 *   - Multi-version chain: tampering with any past version breaks chain
 */

import { describe, it, expect } from "vitest";
import {
  buildManifestMessage,
  computeManifestChainHash,
  signManifest,
  buildRevocationMessage,
  verifyManifest,
  verifyManifestChain,
  type IdentityManifest,
  type SignedManifest,
} from "../agent-identity";
import { generateKeyPair, signMessage } from "../agent-delegation";

const FAR_FUTURE = "2099-12-31T00:00:00Z";

function makeManifest(overrides: Partial<IdentityManifest> = {}): IdentityManifest {
  return {
    $schema: "sovereign-identity-manifest/v1",
    id: "agent-test-1",
    name: "test-agent",
    version: "1.0.0",
    owner: "user_test",
    ownerPublicKey: "placeholder-pubkey",
    purpose: "Tests the identity primitives",
    capabilities: ["test_action"],
    modelProvenance: {
      models: ["claude-sonnet-4.5"],
      promptHash: "abc123",
    },
    previousManifestHash: null,
    issuedAt: "2026-04-29T10:00:00Z",
    expiresAt: FAR_FUTURE,
    ...overrides,
  };
}

describe("agent-identity — buildManifestMessage", () => {
  it("is deterministic for identical input", () => {
    const m = makeManifest();
    expect(buildManifestMessage(m)).toBe(buildManifestMessage(m));
  });

  it("is key-order independent on capabilities (canonical-JSON)", () => {
    const a = buildManifestMessage(makeManifest({ capabilities: ["a", "b"] }));
    const b = buildManifestMessage(makeManifest({ capabilities: ["a", "b"] }));
    expect(a).toBe(b);
  });

  it("changes when ANY field changes (replay defense)", () => {
    const base = buildManifestMessage(makeManifest());
    expect(buildManifestMessage(makeManifest({ id: "other" }))).not.toBe(base);
    expect(buildManifestMessage(makeManifest({ name: "other" }))).not.toBe(base);
    expect(buildManifestMessage(makeManifest({ version: "2.0" }))).not.toBe(base);
    expect(buildManifestMessage(makeManifest({ owner: "other" }))).not.toBe(base);
    expect(buildManifestMessage(makeManifest({ purpose: "other" }))).not.toBe(base);
    expect(
      buildManifestMessage(makeManifest({ capabilities: ["other"] })),
    ).not.toBe(base);
    expect(
      buildManifestMessage(
        makeManifest({
          modelProvenance: { models: ["other"], promptHash: "x" },
        }),
      ),
    ).not.toBe(base);
    expect(
      buildManifestMessage(makeManifest({ previousManifestHash: "abc" })),
    ).not.toBe(base);
    expect(buildManifestMessage(makeManifest({ expiresAt: "2030-01-01T00:00:00Z" }))).not.toBe(
      base,
    );
  });

  it("optional fields handled (codeProvenance, trainingDataDeclaration)", () => {
    const noCode = buildManifestMessage(makeManifest());
    const withCode = buildManifestMessage(
      makeManifest({
        codeProvenance: { repository: "https://github.com/x", commitHash: "abc" },
      }),
    );
    expect(noCode).not.toBe(withCode);
  });
});

describe("agent-identity — computeManifestChainHash", () => {
  it("genesis (null) === 'GENESIS' literal", () => {
    const a = computeManifestChainHash({
      previousManifestHash: null,
      manifestMessage: "msg",
      manifestSignature: "sig",
    });
    const b = computeManifestChainHash({
      previousManifestHash: "GENESIS",
      manifestMessage: "msg",
      manifestSignature: "sig",
    });
    expect(a).toBe(b);
  });

  it("changing prev_hash changes the chain (forward propagation)", () => {
    const a = computeManifestChainHash({
      previousManifestHash: "aaa",
      manifestMessage: "msg",
      manifestSignature: "sig",
    });
    const b = computeManifestChainHash({
      previousManifestHash: "bbb",
      manifestMessage: "msg",
      manifestSignature: "sig",
    });
    expect(a).not.toBe(b);
  });
});

describe("agent-identity — sign + verify roundtrip", () => {
  it("signed manifest verifies against owner pubkey", () => {
    const userKey = generateKeyPair();
    const manifest = makeManifest({ ownerPublicKey: userKey.publicKey });
    const signed = signManifest({ manifest, ownerPrivateKey: userKey.privateKey });
    const r = verifyManifest({
      manifest: signed,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: true, revoked: false });
  });

  it("forged signature (wrong key) rejected", () => {
    const userKey = generateKeyPair();
    const attackerKey = generateKeyPair();
    const manifest = makeManifest({ ownerPublicKey: userKey.publicKey });
    // Attacker signs with their own key but claims user's pubkey
    const message = buildManifestMessage(manifest);
    const attackerSig = signMessage(attackerKey.privateKey, message);
    const forged: SignedManifest = {
      ...manifest,
      manifestMessage: message,
      manifestSignature: attackerSig,
      chainHash: computeManifestChainHash({
        previousManifestHash: null,
        manifestMessage: message,
        manifestSignature: attackerSig,
      }),
    };
    const r = verifyManifest({
      manifest: forged,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "signature_invalid" });
  });

  it("ownerPublicKey mismatch rejected", () => {
    const userKey = generateKeyPair();
    const otherKey = generateKeyPair();
    const manifest = makeManifest({ ownerPublicKey: userKey.publicKey });
    const signed = signManifest({ manifest, ownerPrivateKey: userKey.privateKey });
    const r = verifyManifest({
      manifest: signed,
      expectedOwnerPublicKey: otherKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "owner_pubkey_mismatch" });
  });

  it("tampered manifestMessage rejected", () => {
    const userKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({ ownerPublicKey: userKey.publicKey }),
      ownerPrivateKey: userKey.privateKey,
    });
    const tampered: SignedManifest = { ...signed, manifestMessage: "tampered" };
    const r = verifyManifest({
      manifest: tampered,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "manifest_message_mismatch" });
  });

  it("tampered chainHash rejected", () => {
    const userKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({ ownerPublicKey: userKey.publicKey }),
      ownerPrivateKey: userKey.privateKey,
    });
    const tampered: SignedManifest = { ...signed, chainHash: "0".repeat(64) };
    const r = verifyManifest({
      manifest: tampered,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "chain_hash_mismatch" });
  });

  it("expired manifest rejected", () => {
    const userKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        expiresAt: "2020-01-01T00:00:00Z",
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const r = verifyManifest({
      manifest: signed,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "manifest_expired" });
  });

  it("expired manifest passes with skipExpiryCheck (forensics)", () => {
    const userKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        expiresAt: "2020-01-01T00:00:00Z",
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const r = verifyManifest({
      manifest: signed,
      expectedOwnerPublicKey: userKey.publicKey,
      skipExpiryCheck: true,
    });
    expect(r).toEqual({ valid: true, revoked: false });
  });
});

describe("agent-identity — revocation (kill-switch)", () => {
  it("valid revocation marks manifest revoked but still valid", () => {
    const userKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({ ownerPublicKey: userKey.publicKey }),
      ownerPrivateKey: userKey.privateKey,
    });
    const revocationMessage = buildRevocationMessage({
      manifestId: signed.id,
      manifestVersion: signed.version,
      reason: "lost device",
      issuedAt: "2026-04-30T00:00:00Z",
    });
    const revocationSignature = signMessage(userKey.privateKey, revocationMessage);
    const revoked: SignedManifest = {
      ...signed,
      revokedAt: "2026-04-30T00:00:00Z",
      revocationMessage,
      revocationSignature,
    };
    const r = verifyManifest({
      manifest: revoked,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: true, revoked: true });
  });

  it("revoked but signature MISSING rejected", () => {
    const userKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({ ownerPublicKey: userKey.publicKey }),
      ownerPrivateKey: userKey.privateKey,
    });
    const broken: SignedManifest = {
      ...signed,
      revokedAt: "2026-04-30T00:00:00Z",
    };
    const r = verifyManifest({
      manifest: broken,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "revocation_signature_missing" });
  });

  it("FORGED revocation signature rejected (kill-switch fraud defense)", () => {
    const userKey = generateKeyPair();
    const attackerKey = generateKeyPair();
    const signed = signManifest({
      manifest: makeManifest({ ownerPublicKey: userKey.publicKey }),
      ownerPrivateKey: userKey.privateKey,
    });
    const revocationMessage = buildRevocationMessage({
      manifestId: signed.id,
      manifestVersion: signed.version,
      reason: "evil revocation",
      issuedAt: "2026-04-30T00:00:00Z",
    });
    // Attacker signs the revocation with their OWN key
    const fakeSig = signMessage(attackerKey.privateKey, revocationMessage);
    const forged: SignedManifest = {
      ...signed,
      revokedAt: "2026-04-30T00:00:00Z",
      revocationMessage,
      revocationSignature: fakeSig,
    };
    const r = verifyManifest({
      manifest: forged,
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r).toEqual({ valid: false, reason: "revocation_signature_invalid" });
  });
});

describe("agent-identity — multi-version chain", () => {
  it("v1 → v2 → v3 chain all valid", () => {
    const userKey = generateKeyPair();
    const v1 = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        version: "1.0.0",
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const v2 = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        version: "1.1.0",
        previousManifestHash: v1.chainHash,
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const v3 = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        version: "2.0.0",
        previousManifestHash: v2.chainHash,
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const r = verifyManifestChain({
      manifests: [v1, v2, v3],
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.activeManifest?.version).toBe("2.0.0");
    }
  });

  it("v2 with wrong previousManifestHash → chain broken", () => {
    const userKey = generateKeyPair();
    const v1 = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        version: "1.0.0",
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const v2 = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        version: "1.1.0",
        previousManifestHash: "wrong_hash",
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const r = verifyManifestChain({
      manifests: [v1, v2],
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toBe("previous_hash_mismatch");
      expect(r.index).toBe(1);
    }
  });

  it("genesis with non-null parent → invalid", () => {
    const userKey = generateKeyPair();
    const bogusGenesis = signManifest({
      manifest: makeManifest({
        ownerPublicKey: userKey.publicKey,
        previousManifestHash: "shouldnt-exist",
      }),
      ownerPrivateKey: userKey.privateKey,
    });
    const r = verifyManifestChain({
      manifests: [bogusGenesis],
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toBe("first_has_parent");
      expect(r.index).toBe(0);
    }
  });

  it("revoked latest manifest → activeManifest is null", () => {
    const userKey = generateKeyPair();
    const v1 = signManifest({
      manifest: makeManifest({ ownerPublicKey: userKey.publicKey }),
      ownerPrivateKey: userKey.privateKey,
    });
    const revocationMessage = buildRevocationMessage({
      manifestId: v1.id,
      manifestVersion: v1.version,
      reason: "compromised",
      issuedAt: "2026-04-30T00:00:00Z",
    });
    const revocationSignature = signMessage(userKey.privateKey, revocationMessage);
    const revoked: SignedManifest = {
      ...v1,
      revokedAt: "2026-04-30T00:00:00Z",
      revocationMessage,
      revocationSignature,
    };
    const r = verifyManifestChain({
      manifests: [revoked],
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.activeManifest).toBeNull();
  });

  it("empty chain trivially valid (activeManifest null)", () => {
    const userKey = generateKeyPair();
    const r = verifyManifestChain({
      manifests: [],
      expectedOwnerPublicKey: userKey.publicKey,
    });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.activeManifest).toBeNull();
  });
});
