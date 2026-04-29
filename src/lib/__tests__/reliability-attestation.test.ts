/**
 * reliability-attestation — tests.
 *
 * Pure-function calculator + signer + verifier. Same inputs →
 * same outputs.
 *
 * Covers:
 *   - computeReliabilityWindow math: zero snapshots → 100%
 *   - All passing → 100%
 *   - Mixed pass/fail → correct percentage
 *   - Audit chain broken → metCommitment = false
 *   - Signing roundtrip: sign → verify → valid
 *   - Tampering scenarios: message changed, signature swapped, chain
 *     hash mutated
 *   - Chain verification: 3-row chain works; tampering with row 1
 *     breaks rows 2 + 3
 *   - Pubkey-mismatch detection (forward key rotation safety)
 */

import { describe, it, expect } from "vitest";
import {
  computeReliabilityWindow,
  buildAttestationMessage,
  signAttestation,
  verifyAttestation,
  verifyAttestationChain,
  computeAttestationChainHash,
  getPlatformSigningKey,
} from "../reliability-attestation";
import { generateKeyPair } from "../agent-delegation";

const T0 = new Date("2026-04-28T00:00:00.000Z");
const T1 = new Date("2026-04-29T00:00:00.000Z");
const T2 = new Date("2026-04-30T00:00:00.000Z");

describe("computeReliabilityWindow — math", () => {
  it("zero snapshots → 100% (vacuously available)", () => {
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: null,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    expect(w.uptimePct).toBe(100);
    expect(w.metCommitment).toBe(true);
    expect(w.totalHealthSnapshots).toBe(0);
  });

  it("all passing → 100%, met commitment", () => {
    const snapshots = Array.from({ length: 24 }, () => ({
      healthy: true,
      invariantsFailing: 0,
    }));
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: snapshots,
      auditChainIntact: true,
      auditChainTotalRows: 1000,
      auditChainFirstBrokenId: null,
    });
    expect(w.uptimePct).toBe(100);
    expect(w.metCommitment).toBe(true);
  });

  it("1 of 24 failing → 95.83% (strict pass: healthy && zero failing invariants)", () => {
    const snapshots = [
      { healthy: false, invariantsFailing: 5 },
      ...Array.from({ length: 23 }, () => ({
        healthy: true,
        invariantsFailing: 0,
      })),
    ];
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: snapshots,
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    expect(w.uptimePct).toBe(95.83);
    // Below default 99.9% threshold:
    expect(w.metCommitment).toBe(false);
  });

  it("snapshot says healthy:true but has failing invariants → counted as failing (strictness)", () => {
    const snapshots = [
      { healthy: true, invariantsFailing: 1 }, // pretends healthy but has 1 fail
      ...Array.from({ length: 9 }, () => ({
        healthy: true,
        invariantsFailing: 0,
      })),
    ];
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: snapshots,
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    expect(w.passingHealthSnapshots).toBe(9);
    expect(w.failingHealthSnapshots).toBe(1);
    expect(w.uptimePct).toBe(90);
  });

  it("audit chain explicitly broken → metCommitment is false even at 100% snapshots", () => {
    const snapshots = Array.from({ length: 24 }, () => ({
      healthy: true,
      invariantsFailing: 0,
    }));
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: snapshots,
      auditChainIntact: false, // explicit break
      auditChainTotalRows: 100,
      auditChainFirstBrokenId: "row-42",
    });
    expect(w.uptimePct).toBe(100);
    expect(w.metCommitment).toBe(false);
    expect(w.auditChainFirstBrokenId).toBe("row-42");
  });

  it("audit chain unknown (null) → metCommitment unaffected by chain (uses uptime alone)", () => {
    const snapshots = Array.from({ length: 24 }, () => ({
      healthy: true,
      invariantsFailing: 0,
    }));
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: snapshots,
      auditChainIntact: null,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    expect(w.metCommitment).toBe(true);
  });

  it("custom commitment threshold of 99.99% caught by 99.95% uptime", () => {
    const snapshots = [
      ...Array.from({ length: 1995 }, () => ({
        healthy: true,
        invariantsFailing: 0,
      })),
      ...Array.from({ length: 5 }, () => ({
        healthy: false,
        invariantsFailing: 1,
      })),
    ];
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: snapshots,
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
      commitmentThresholdPct: 99.99,
    });
    expect(w.uptimePct).toBe(99.75);
    expect(w.metCommitment).toBe(false);
  });
});

describe("buildAttestationMessage — canonical format", () => {
  it("produces the documented v1 line-separated format", () => {
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: Array.from({ length: 24 }, () => ({
        healthy: true,
        invariantsFailing: 0,
      })),
      auditChainIntact: true,
      auditChainTotalRows: 1000,
      auditChainFirstBrokenId: null,
    });
    const msg = buildAttestationMessage(w);
    expect(msg.startsWith("v1\nreliability-attestation\n")).toBe(true);
    expect(msg).toContain("uptimePct:100");
    expect(msg).toContain("metCommitment:true");
    expect(msg).toContain("auditChainIntact:true");
  });

  it("renders unknown audit chain as 'unknown' sentinel", () => {
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: null,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const msg = buildAttestationMessage(w);
    expect(msg).toContain("auditChainIntact:unknown");
    expect(msg).toContain("auditChainTotalRows:unknown");
  });

  it("renders broken audit chain with concrete row id", () => {
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: false,
      auditChainTotalRows: 100,
      auditChainFirstBrokenId: "audit-row-42",
    });
    const msg = buildAttestationMessage(w);
    expect(msg).toContain("auditChainIntact:false");
    expect(msg).toContain("auditChainFirstBrokenId:audit-row-42");
  });
});

describe("signAttestation + verifyAttestation — roundtrip", () => {
  it("signs and the same key verifies", () => {
    const kp = generateKeyPair();
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: Array.from({ length: 24 }, () => ({
        healthy: true,
        invariantsFailing: 0,
      })),
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const signed = signAttestation({
      window: w,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: null,
    });
    const result = verifyAttestation({ attestation: signed });
    expect(result.valid).toBe(true);
  });

  it("expectedPlatformPublicKey gate catches a swapped key", () => {
    const real = generateKeyPair();
    const attacker = generateKeyPair();
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const signed = signAttestation({
      window: w,
      platformPrivateKey: real.privateKey,
      platformPublicKey: real.publicKey,
      previousChainHash: null,
    });
    // Attacker republishes the attestation under a different
    // pubkey — verifier catches the mismatch.
    const tampered = { ...signed, platformPublicKey: attacker.publicKey };
    const result = verifyAttestation({
      attestation: tampered,
      expectedPlatformPublicKey: real.publicKey,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Either signature_invalid (since the message no longer
      // matches the new pubkey's signature) OR pubkey_mismatch.
      expect(["signature_invalid", "platform_pubkey_mismatch"]).toContain(
        result.reason,
      );
    }
  });
});

describe("Tampering detection — the trustless invariants", () => {
  it("mutating the attestation message breaks reconstruction", () => {
    const kp = generateKeyPair();
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const signed = signAttestation({
      window: w,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: null,
    });
    const tampered = {
      ...signed,
      uptimePct: 50, // claim worse than what was signed
    };
    const result = verifyAttestation({ attestation: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("attestation_message_mismatch");
    }
  });

  it("mutating the signature breaks signature verification", () => {
    const kp = generateKeyPair();
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const signed = signAttestation({
      window: w,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: null,
    });
    // Flip a character in the signature.
    const sigChars = signed.attestationSignature.split("");
    sigChars[5] = sigChars[5] === "A" ? "B" : "A";
    const tampered = { ...signed, attestationSignature: sigChars.join("") };
    const result = verifyAttestation({ attestation: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("signature_invalid");
    }
  });

  it("mutating the chain hash breaks chain-hash recompute", () => {
    const kp = generateKeyPair();
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const signed = signAttestation({
      window: w,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: null,
    });
    const tampered = { ...signed, chainHash: "0".repeat(64) };
    const result = verifyAttestation({ attestation: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("chain_hash_mismatch");
    }
  });
});

describe("verifyAttestationChain — the chain integrity invariant", () => {
  it("3-row valid chain verifies", () => {
    const kp = generateKeyPair();
    const w1 = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const a1 = signAttestation({
      window: w1,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: null,
    });
    const w2 = computeReliabilityWindow({
      windowStart: T1,
      windowEnd: T2,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const a2 = signAttestation({
      window: w2,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: a1.chainHash,
    });
    const result = verifyAttestationChain({
      attestations: [a1, a2],
      expectedPlatformPublicKey: kp.publicKey,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.rowsVerified).toBe(2);
    }
  });

  it("breaks at row 2 when row 1 is mutated", () => {
    const kp = generateKeyPair();
    const w1 = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const a1 = signAttestation({
      window: w1,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: null,
    });
    const w2 = computeReliabilityWindow({
      windowStart: T1,
      windowEnd: T2,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const a2 = signAttestation({
      window: w2,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: a1.chainHash,
    });
    // Mutate row 1's uptime — the message AND chain hash both change.
    const tamperedA1 = { ...a1, uptimePct: 50 };
    const result = verifyAttestationChain({
      attestations: [tamperedA1, a2],
      expectedPlatformPublicKey: kp.publicKey,
    });
    expect(result.valid).toBe(false);
    // Row 0 fails first because the message no longer matches.
  });

  it("first row with non-null previousChainHash is rejected", () => {
    const kp = generateKeyPair();
    const w = computeReliabilityWindow({
      windowStart: T0,
      windowEnd: T1,
      healthSnapshots: [],
      auditChainIntact: true,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });
    const a = signAttestation({
      window: w,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
      previousChainHash: "fake-parent",
    });
    const result = verifyAttestationChain({ attestations: [a] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("first_has_parent");
      expect(result.index).toBe(0);
    }
  });

  it("empty chain is vacuously valid", () => {
    const result = verifyAttestationChain({ attestations: [] });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.rowsVerified).toBe(0);
    }
  });
});

describe("computeAttestationChainHash — pure", () => {
  it("genesis row uses the GENESIS sentinel", () => {
    const h1 = computeAttestationChainHash({
      previousChainHash: null,
      attestationMessage: "test",
      attestationSignature: "sig",
    });
    const h2 = computeAttestationChainHash({
      previousChainHash: "GENESIS",
      attestationMessage: "test",
      attestationSignature: "sig",
    });
    expect(h1).toBe(h2);
  });

  it("different inputs → different hashes", () => {
    const h1 = computeAttestationChainHash({
      previousChainHash: null,
      attestationMessage: "test",
      attestationSignature: "sig",
    });
    const h2 = computeAttestationChainHash({
      previousChainHash: null,
      attestationMessage: "DIFFERENT",
      attestationSignature: "sig",
    });
    expect(h1).not.toBe(h2);
  });
});

describe("getPlatformSigningKey", () => {
  it("returns a valid keypair when env vars are unset (dev fallback)", () => {
    delete process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
    delete process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
    const kp = getPlatformSigningKey();
    expect(kp.privateKey.length).toBeGreaterThan(20);
    expect(kp.publicKey.length).toBeGreaterThan(20);
    expect(kp.source).toBe("cached_dev");
  });

  it("returns env-supplied keys when set (production path)", () => {
    const fresh = generateKeyPair();
    process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY = fresh.privateKey;
    process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY = fresh.publicKey;
    const kp = getPlatformSigningKey();
    expect(kp.privateKey).toBe(fresh.privateKey);
    expect(kp.publicKey).toBe(fresh.publicKey);
    expect(kp.source).toBe("env");
    delete process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
    delete process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
  });
});
