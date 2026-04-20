import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  SNAPSHOT_VERSION,
  buildSnapshot,
  computeChecksum,
  verifySnapshot,
  type AgentSnapshotV1,
} from "../agent-snapshot";
import type { ReplayTrace } from "../agent-replay";

function makeTrace(overrides: Partial<ReplayTrace> = {}): ReplayTrace {
  return {
    id: "rpl_123_abc",
    userId: "user_2Abc1234",
    agentName: "leads",
    status: "complete",
    steps: [
      { phase: "input_received", data: { niche: "SaaS" }, timestamp: 1000 },
      { phase: "model_selected", data: { model: "nemotron-ultra" }, timestamp: 1200 },
      { phase: "execution", data: { leads: [{ name: "Acme" }] }, timestamp: 3500 },
    ],
    startedAt: 1000,
    completedAt: 4000,
    totalDurationMs: 3000,
    ...overrides,
  };
}

describe("agent-snapshot", () => {
  it("builds a v1 snapshot with the correct version + id", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: { niche: "SaaS" },
      output: { leads: [{ name: "Acme" }] },
      modelsConsulted: ["nemotron-ultra"],
      providersConsulted: ["nvidia-nim"],
    });

    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.id).toBe("rpl_123_abc");
    expect(snap.request.agentName).toBe("leads");
    expect(snap.modelsConsulted).toEqual(["nemotron-ultra"]);
  });

  it("hashes the userId (not stored raw)", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: {},
      output: {},
      modelsConsulted: [],
      providersConsulted: [],
    });

    expect(snap.request.userIdHash).toBeDefined();
    expect(snap.request.userIdHash).toHaveLength(16);
    // Must not be the original userId
    expect(snap.request.userIdHash).not.toContain("user_");
  });

  it("computes a stable checksum", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: { niche: "SaaS" },
      output: { leads: [] },
      modelsConsulted: ["m1"],
      providersConsulted: ["nvidia-nim"],
    });

    expect(snap.checksum).toBeDefined();
    expect(snap.checksum).toMatch(/^[0-9a-f]{64}$/);

    // Recomputing should match
    const recomputed = computeChecksum(snap);
    expect(recomputed).toBe(snap.checksum);
  });

  it("verifySnapshot returns valid for untampered data (unsigned — no key configured)", () => {
    // Unset any signing key so the path is deterministic
    const prior = process.env.SNAPSHOT_SIGNING_KEY;
    delete process.env.SNAPSHOT_SIGNING_KEY;
    try {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: {},
        output: {},
        modelsConsulted: [],
        providersConsulted: [],
      });
      const result = verifySnapshot(snap);
      expect(result.valid).toBe(true);
      expect(result.integrity).toBe("verified");
      expect(result.provenance).toBe("unsigned");
    } finally {
      if (prior !== undefined) process.env.SNAPSHOT_SIGNING_KEY = prior;
    }
  });

  it("verifySnapshot detects tampered output", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: {},
      output: { amount: 100 },
      modelsConsulted: [],
      providersConsulted: [],
    });

    // Simulate an auditor receiving a tampered copy
    const tampered: AgentSnapshotV1 = {
      ...snap,
      output: { amount: 999999 },
    };

    const result = verifySnapshot(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("checksum_mismatch");
  });

  it("verifySnapshot rejects wrong version", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: {},
      output: {},
      modelsConsulted: [],
      providersConsulted: [],
    });

    const result = verifySnapshot({ ...snap, version: "snapshot-v99" as typeof SNAPSHOT_VERSION });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("wrong_version");
  });

  it("verifySnapshot rejects missing checksum", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: {},
      output: {},
      modelsConsulted: [],
      providersConsulted: [],
    });

    const result = verifySnapshot({ ...snap, checksum: undefined });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_checksum");
  });

  it("canonicalization makes checksum order-independent", () => {
    const snap1 = buildSnapshot({
      trace: makeTrace(),
      input: { a: 1, b: 2 },
      output: { x: 10, y: 20 },
      modelsConsulted: ["m1"],
      providersConsulted: ["nvidia-nim"],
    });

    const snap2 = buildSnapshot({
      trace: makeTrace(),
      input: { b: 2, a: 1 }, // different insertion order
      output: { y: 20, x: 10 },
      modelsConsulted: ["m1"],
      providersConsulted: ["nvidia-nim"],
    });

    expect(snap1.checksum).toBe(snap2.checksum);
  });

  // ─── v2: HMAC signing + provenance ──────────────────────────────────────

  describe("snapshot-v2 — HMAC signing for provenance", () => {
    // 32-byte base64 test key — never used in production.
    const TEST_KEY = "dGVzdC1rZXktMzItYnl0ZXMtbm90LWZvci1wcm9kdWN0aW9u";

    beforeEach(() => {
      process.env.SNAPSHOT_SIGNING_KEY = TEST_KEY;
      process.env.SNAPSHOT_SIGNING_KEY_ID = "smx-sig-test-2026";
    });
    afterEach(() => {
      delete process.env.SNAPSHOT_SIGNING_KEY;
      delete process.env.SNAPSHOT_SIGNING_KEY_ID;
    });

    it("buildSnapshot signs when SNAPSHOT_SIGNING_KEY is set", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: { x: 1 },
        output: { y: 2 },
        modelsConsulted: [],
        providersConsulted: [],
      });

      expect(snap.version).toBe(SNAPSHOT_VERSION);
      expect(snap.signature).toBeDefined();
      expect(snap.signature).toMatch(/^[0-9a-f]{64}$/);
      expect(snap.signatureKeyId).toBe("smx-sig-test-2026");
    });

    it("verifySnapshot returns provenance=verified on round-trip", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: {},
        output: {},
        modelsConsulted: [],
        providersConsulted: [],
      });
      const result = verifySnapshot(snap);
      expect(result.valid).toBe(true);
      expect(result.integrity).toBe("verified");
      expect(result.provenance).toBe("verified");
      expect(result.keyId).toBe("smx-sig-test-2026");
    });

    it("verifySnapshot flags signature_mismatch when signature is forged", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: {},
        output: {},
        modelsConsulted: [],
        providersConsulted: [],
      });
      const forged = {
        ...snap,
        signature: "0".repeat(64), // well-formed but wrong
      };
      const result = verifySnapshot(forged);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("signature_mismatch");
      expect(result.integrity).toBe("verified"); // checksum still passes
    });

    it("verifySnapshot flags missing_signature_key when we can't verify", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: {},
        output: {},
        modelsConsulted: [],
        providersConsulted: [],
      });

      // Remove our key so we can't re-verify
      delete process.env.SNAPSHOT_SIGNING_KEY;

      const result = verifySnapshot(snap);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("missing_signature_key");
      expect(result.integrity).toBe("verified"); // integrity still confirms
    });

    it("verifySnapshot flags unknown_key_id on rotation mismatch", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: {},
        output: {},
        modelsConsulted: [],
        providersConsulted: [],
      });

      // Simulate a historical snapshot from a previous key generation
      process.env.SNAPSHOT_SIGNING_KEY_ID = "smx-sig-different-rotation";

      const result = verifySnapshot(snap);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("unknown_key_id");
      expect(result.keyId).toBe("smx-sig-test-2026"); // the ORIGINAL key id
    });

    it("tampering the signature field alone still fails verification", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: { amount: 100 },
        output: { ok: true },
        modelsConsulted: [],
        providersConsulted: [],
      });
      const tampered = { ...snap, signature: snap.signature!.replace(/a/g, "b") };
      const result = verifySnapshot(tampered);
      expect(result.valid).toBe(false);
      // Signature mismatch first; integrity still verified
      expect(result.reason).toBe("signature_mismatch");
    });

    it("tampering checksum alone is caught by signature (defense-in-depth)", () => {
      const snap = buildSnapshot({
        trace: makeTrace(),
        input: { amount: 100 },
        output: { ok: true },
        modelsConsulted: [],
        providersConsulted: [],
      });
      // Attacker tries to change payload + fix checksum. They don't have
      // the HMAC key so the signature won't match.
      const tampered = {
        ...snap,
        output: { ok: false }, // changed payload
        // Attempt to recompute a valid checksum for the new payload
        checksum: createHash("sha256")
          .update(
            JSON.stringify({ ...snap, output: { ok: false }, checksum: undefined }),
          )
          .digest("hex"),
      };
      const result = verifySnapshot(tampered as AgentSnapshotV1);
      expect(result.valid).toBe(false);
      // Either checksum_mismatch (canonical JSON order-sensitive) or
      // signature_mismatch — both are correct failures.
      expect(["checksum_mismatch", "signature_mismatch"]).toContain(result.reason);
    });

    it("v1 (legacy) snapshots still verify with integrity-only", () => {
      delete process.env.SNAPSHOT_SIGNING_KEY;
      delete process.env.SNAPSHOT_SIGNING_KEY_ID;

      const snap = buildSnapshot({
        trace: makeTrace(),
        input: {},
        output: {},
        modelsConsulted: [],
        providersConsulted: [],
      });

      // Force the version back to v1 (simulating a pre-v2 snapshot an
      // auditor is verifying today)
      const v1Snap: AgentSnapshotV1 = { ...snap, version: "snapshot-v1" as typeof SNAPSHOT_VERSION };
      v1Snap.checksum = undefined;
      // Recompute checksum for the v1 shape
      v1Snap.checksum = computeChecksum(v1Snap);

      const result = verifySnapshot(v1Snap);
      expect(result.valid).toBe(true);
      expect(result.integrity).toBe("verified");
      expect(result.provenance).toBe("unsigned");
    });
  });
});
