/**
 * Tests for src/lib/pq-sign.ts — Dilithium3 dual-signing.
 *
 * These tests generate a fresh ML-DSA-65 keypair per-test so the
 * project's real PQ keys (if any) are never touched and there's no
 * leakage across the suite.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

describe("pq-sign — ML-DSA-65 (Dilithium3)", () => {
  const originalSecret = process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY;
  const originalPublic = process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY;

  // Disabled / enabled cases each get a fresh module import so the
  // module-level cache doesn't leak state across tests.
  beforeEach(() => {
    delete process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY;
    delete process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY;
    // Bust the module cache so the keys-set memoisation doesn't leak.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalSecret !== undefined)
      process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY = originalSecret;
    else delete process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY;
    if (originalPublic !== undefined)
      process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY = originalPublic;
    else delete process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY;
  });

  describe("isPqDualSignEnabled", () => {
    it("returns false when env keys are unset", async () => {
      const { isPqDualSignEnabled } = await import("@/lib/pq-sign");
      expect(isPqDualSignEnabled()).toBe(false);
    });

    it("returns true when both env keys are present and well-formed", async () => {
      const { secretKey, publicKey } = ml_dsa65.keygen();
      process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY =
        Buffer.from(secretKey).toString("base64");
      process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY =
        Buffer.from(publicKey).toString("base64");
      // Re-import to bypass the module cache from the previous test.
      const mod = await import("@/lib/pq-sign");
      expect(mod.isPqDualSignEnabled()).toBe(true);
    });
  });

  describe("signMlDsa65 + verifyMlDsa65 roundtrip", () => {
    it("returns null from sign when keys are unset", async () => {
      const { signMlDsa65 } = await import("@/lib/pq-sign");
      expect(signMlDsa65("any canonical bytes")).toBeNull();
    });

    it("signs and verifies a canonical receipt projection", async () => {
      const { secretKey, publicKey } = ml_dsa65.keygen();
      process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY =
        Buffer.from(secretKey).toString("base64");
      process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY =
        Buffer.from(publicKey).toString("base64");
      const mod = await import("@/lib/pq-sign");

      const canonical = JSON.stringify({
        runId: "abc123",
        userId: "user_1",
        ts: 1715900000,
      });
      const sig = mod.signMlDsa65(canonical);
      expect(sig).not.toBeNull();
      expect(typeof sig).toBe("string");
      expect(mod.verifyMlDsa65(canonical, sig!)).toBe(true);
    });

    it("rejects a tampered canonical", async () => {
      const { secretKey, publicKey } = ml_dsa65.keygen();
      process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY =
        Buffer.from(secretKey).toString("base64");
      process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY =
        Buffer.from(publicKey).toString("base64");
      const mod = await import("@/lib/pq-sign");

      const canonical = "original";
      const sig = mod.signMlDsa65(canonical);
      expect(mod.verifyMlDsa65("tampered", sig!)).toBe(false);
    });

    it("rejects a malformed base64 signature without throwing", async () => {
      const { secretKey, publicKey } = ml_dsa65.keygen();
      process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY =
        Buffer.from(secretKey).toString("base64");
      process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY =
        Buffer.from(publicKey).toString("base64");
      const mod = await import("@/lib/pq-sign");
      expect(mod.verifyMlDsa65("anything", "!!!not-valid-base64")).toBe(false);
    });
  });

  describe("verifyDualSig (v3 wire format)", () => {
    it("rejects a wire that doesn't start with v3=", async () => {
      const { verifyDualSig } = await import("@/lib/pq-sign");
      const r = verifyDualSig("anything", "v2=abc", () => true);
      expect(r.ok).toBe(false);
      expect(r.ed25519).toBe(false);
      expect(r.mldsa65).toBe(false);
    });

    it("rejects a v3 wire with the wrong number of dot-separated parts", async () => {
      const { verifyDualSig } = await import("@/lib/pq-sign");
      const r = verifyDualSig("anything", "v3=only-one-part", () => true);
      expect(r.ok).toBe(false);
    });

    it("requires both ed25519 and mldsa65 to validate", async () => {
      const { secretKey, publicKey } = ml_dsa65.keygen();
      process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY =
        Buffer.from(secretKey).toString("base64");
      process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY =
        Buffer.from(publicKey).toString("base64");
      const mod = await import("@/lib/pq-sign");

      const canonical = "the canonical bytes";
      const mlSig = mod.signMlDsa65(canonical);
      const wire = mod.formatV3Wire("aGVsbG8=", mlSig!);

      // Ed25519 verifier returns false → overall must fail
      const fail = mod.verifyDualSig(canonical, wire, () => false);
      expect(fail.ok).toBe(false);
      expect(fail.ed25519).toBe(false);
      expect(fail.mldsa65).toBe(true);

      // Ed25519 verifier returns true → overall must pass
      const pass = mod.verifyDualSig(canonical, wire, () => true);
      expect(pass.ok).toBe(true);
      expect(pass.ed25519).toBe(true);
      expect(pass.mldsa65).toBe(true);
    });
  });

  describe("formatV3Wire", () => {
    it("produces a stable wire layout", async () => {
      const { formatV3Wire } = await import("@/lib/pq-sign");
      expect(formatV3Wire("ed25519-sig", "mldsa65-sig")).toBe(
        "v3=ed25519-sig.mldsa65-sig",
      );
    });
  });
});
