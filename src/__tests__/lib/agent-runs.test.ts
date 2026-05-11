/**
 * Tests for agent-runs — the verifiable receipt signing layer.
 *
 * Covers:
 *   - signRun() produces stable HMAC for the same canonical input
 *   - signRun() produces different output for tampered input
 *   - verifySignature() round-trips correctly
 *   - verifySignature() rejects mutated canonical strings
 *   - verifySignature() returns false for the "unsigned" sentinel
 *   - canonicalizeRun() is field-order independent (deterministic)
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  // Deterministic signing key for the duration of the test file.
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
});

import { signRun, verifySignature, canonicalizeRun } from "@/lib/agent-runs";

describe("signRun / verifySignature", () => {
  it("produces a stable v1 HMAC for the same canonical input", () => {
    const canonical = '{"v":1,"id":"abc"}';
    const sig1 = signRun(canonical);
    const sig2 = signRun(canonical);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("produces a DIFFERENT signature for a tampered canonical", () => {
    const a = signRun('{"v":1,"id":"abc","output":"hello"}');
    const b = signRun('{"v":1,"id":"abc","output":"goodbye"}');
    expect(a).not.toBe(b);
  });

  it("verifies a valid signature", () => {
    const canonical = '{"v":1,"id":"abc","output":"x"}';
    const sig = signRun(canonical);
    expect(verifySignature(canonical, sig)).toBe(true);
  });

  it("rejects a tampered canonical against a valid signature", () => {
    const canonical = '{"v":1,"id":"abc","output":"x"}';
    const sig = signRun(canonical);
    const tampered = '{"v":1,"id":"abc","output":"X"}';
    expect(verifySignature(tampered, sig)).toBe(false);
  });

  it("rejects the 'unsigned' sentinel", () => {
    expect(verifySignature("anything", "unsigned")).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifySignature("anything", "")).toBe(false);
  });

  it("rejects a malformed signature of incorrect length", () => {
    expect(verifySignature("x", "v1=deadbeef")).toBe(false);
  });
});

describe("canonicalizeRun", () => {
  it("is deterministic: same inputs → same canonical string", () => {
    const at = new Date("2026-05-10T12:00:00.000Z");
    const a = canonicalizeRun({
      id: "id-1",
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      input: { topic: "x" },
      output: { html: "<p>y</p>" },
      safetyResult: { jailbreak: "pass", pii: "pass" },
      durationMs: 1234,
      createdAt: at,
    });
    const b = canonicalizeRun({
      id: "id-1",
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      input: { topic: "x" },
      output: { html: "<p>y</p>" },
      safetyResult: { jailbreak: "pass", pii: "pass" },
      durationMs: 1234,
      createdAt: at,
    });
    expect(a).toBe(b);
  });

  it("changes when any tracked field changes (durationMs)", () => {
    const at = new Date("2026-05-10T12:00:00.000Z");
    const base = {
      id: "id-1",
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      input: { topic: "x" },
      output: { html: "<p>y</p>" },
      safetyResult: { jailbreak: "pass" as const },
      createdAt: at,
    };
    const a = canonicalizeRun({ ...base, durationMs: 100 });
    const b = canonicalizeRun({ ...base, durationMs: 200 });
    expect(a).not.toBe(b);
  });

  it("is key-order-independent (deterministic across SDK clients)", () => {
    // Threat model: a JS client constructs `input` with one key order,
    // a Python client serializes with another. Both should produce the
    // same canonical → same signature → verifiable across boundaries.
    const at = new Date("2026-05-10T12:00:00.000Z");
    const base = {
      id: "id-1",
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      durationMs: 100,
      safetyResult: { jailbreak: "pass" as const, pii: "pass" as const },
      createdAt: at,
    };
    const a = canonicalizeRun({
      ...base,
      input: { topic: "x", lang: "en", count: 5 },
      output: { html: "<p>y</p>", chars: 10 },
    });
    const b = canonicalizeRun({
      ...base,
      // SAME values, DIFFERENT key insertion order at every level.
      input: { count: 5, lang: "en", topic: "x" },
      output: { chars: 10, html: "<p>y</p>" },
    });
    expect(a).toBe(b);
  });

  it("sorts nested object keys recursively", () => {
    const at = new Date("2026-05-10T12:00:00.000Z");
    const base = {
      id: "id-1",
      agentName: "x",
      modelUsed: "m",
      durationMs: 0,
      safetyResult: {},
      createdAt: at,
    };
    const a = canonicalizeRun({
      ...base,
      input: { meta: { z: 1, a: 2 }, foo: "bar" },
      output: {},
    });
    const b = canonicalizeRun({
      ...base,
      input: { foo: "bar", meta: { a: 2, z: 1 } },
      output: {},
    });
    expect(a).toBe(b);
  });

  it("preserves array element order (arrays ARE canonical)", () => {
    const at = new Date("2026-05-10T12:00:00.000Z");
    const base = {
      id: "id-1",
      agentName: "x",
      modelUsed: "m",
      durationMs: 0,
      safetyResult: {},
      output: {},
      createdAt: at,
    };
    const a = canonicalizeRun({ ...base, input: { items: [1, 2, 3] } });
    const b = canonicalizeRun({ ...base, input: { items: [3, 2, 1] } });
    expect(a).not.toBe(b);
  });

  it("includes the canonical version field for forward-compat", () => {
    const c = canonicalizeRun({
      id: "id",
      agentName: "x",
      modelUsed: "m",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      createdAt: new Date(0),
    });
    expect(c).toMatch(/"v":1/);
  });
});
