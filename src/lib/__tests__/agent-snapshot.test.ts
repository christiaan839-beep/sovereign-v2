import { describe, it, expect } from "vitest";
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

  it("verifySnapshot returns valid for untampered data", () => {
    const snap = buildSnapshot({
      trace: makeTrace(),
      input: {},
      output: {},
      modelsConsulted: [],
      providersConsulted: [],
    });
    expect(verifySnapshot(snap)).toEqual({ valid: true });
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
});
