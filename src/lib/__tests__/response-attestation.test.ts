import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  canonicalizeAttestation,
  signAttestation,
  verifyAttestation,
} from "@/lib/response-attestation";

const SECRET = "test-attestation-secret-at-least-16-chars";
const ORIGINAL = process.env.SOVEREIGN_ATTESTATION_SECRET;

beforeEach(() => {
  process.env.SOVEREIGN_ATTESTATION_SECRET = SECRET;
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.SOVEREIGN_ATTESTATION_SECRET;
  else process.env.SOVEREIGN_ATTESTATION_SECRET = ORIGINAL;
});

const baseInputs = () => ({
  agent: "leads",
  requestId: "abc123def456",
  inputJson: JSON.stringify({ prompt: "test" }),
  outputJson: JSON.stringify({ result: "ok" }),
  providers: ["anthropic", "nvidia-nim"],
  models: ["claude-sonnet-4.6", "nemotron-ultra-253b-v1"],
  timestampIso: "2026-04-27T12:00:00.000Z",
});

describe("canonicalizeAttestation", () => {
  it("is deterministic for identical inputs", () => {
    const a = canonicalizeAttestation(baseInputs());
    const b = canonicalizeAttestation(baseInputs());
    expect(a).toBe(b);
  });

  it("sorts provider and model arrays so order doesn't change signature", () => {
    const a = canonicalizeAttestation(baseInputs());
    const b = canonicalizeAttestation({
      ...baseInputs(),
      providers: ["nvidia-nim", "anthropic"], // reversed
      models: ["nemotron-ultra-253b-v1", "claude-sonnet-4.6"],
    });
    expect(a).toBe(b);
  });

  it("DOES change when input or output changes", () => {
    const a = canonicalizeAttestation(baseInputs());
    const b = canonicalizeAttestation({
      ...baseInputs(),
      outputJson: JSON.stringify({ result: "different" }),
    });
    expect(a).not.toBe(b);
  });
});

describe("signAttestation + verifyAttestation", () => {
  it("verifies a correctly-signed header", () => {
    const inputs = baseInputs();
    const header = signAttestation(inputs);
    expect(header).not.toBeNull();
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    const verdict = verifyAttestation(header!, inputs, SECRET, { maxAgeSeconds: 86400 });
    expect(verdict.valid).toBe(true);
  });

  it("rejects when input is tampered", () => {
    const inputs = baseInputs();
    const header = signAttestation(inputs)!;
    const tampered = { ...inputs, outputJson: JSON.stringify({ result: "tampered" }) };
    const verdict = verifyAttestation(header, tampered, SECRET, { maxAgeSeconds: 86400 });
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("signature_mismatch");
  });

  it("rejects when secret is wrong", () => {
    const inputs = baseInputs();
    const header = signAttestation(inputs)!;
    const verdict = verifyAttestation(header, inputs, "wrong-but-long-enough-secret", { maxAgeSeconds: 86400 });
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("signature_mismatch");
  });

  it("rejects malformed header", () => {
    const inputs = baseInputs();
    const verdict = verifyAttestation("not a real header", inputs, SECRET);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("header_malformed");
  });

  it("rejects stale headers (>maxAge)", () => {
    const inputs = {
      ...baseInputs(),
      timestampIso: new Date(Date.now() - 600_000).toISOString(), // 10 min ago
    };
    const header = signAttestation(inputs)!;
    const verdict = verifyAttestation(header, inputs, SECRET, { maxAgeSeconds: 300 });
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("stale");
  });

  it("returns null when secret unset (graceful no-op)", () => {
    delete process.env.SOVEREIGN_ATTESTATION_SECRET;
    const header = signAttestation(baseInputs());
    expect(header).toBeNull();
  });

  it("rejects too-short secret on verify", () => {
    const verdict = verifyAttestation("t=1,v1=abc", baseInputs(), "short");
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("secret_too_short");
  });
});
