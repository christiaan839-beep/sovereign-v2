/**
 * Tests for invocation-attestation — signing + verification +
 * tamper detection + graceful fallback.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateKeypair } from "../sam-signing";
import {
  signInvocation,
  verifyAttestation,
} from "../invocation-attestation";

describe("signInvocation() — graceful no-key path", () => {
  const ORIG = process.env.PLATFORM_SIGNING_KEY;
  beforeEach(() => {
    delete process.env.PLATFORM_SIGNING_KEY;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.PLATFORM_SIGNING_KEY;
    else process.env.PLATFORM_SIGNING_KEY = ORIG;
  });

  it("returns signed:false + full attestation when platform key is missing", async () => {
    const r = await signInvocation({
      agentId: "agent-1",
      invocationId: "inv-1",
      input: "extract this",
      output: "extracted result",
    });
    expect(r.signed).toBe(false);
    expect(r.attestation.agentId).toBe("agent-1");
    expect(r.attestation.invocationId).toBe("inv-1");
    expect(r.attestation._sig).toBeUndefined();
    expect(r.reason).toMatch(/not configured/);
  });

  it("populates hashes even when unsigned", async () => {
    const r = await signInvocation({
      agentId: "a",
      invocationId: "i",
      input: "foo",
      output: "bar",
    });
    expect(r.attestation.inputHash).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(r.attestation.outputHash).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it("same input produces same inputHash (deterministic)", async () => {
    const a = await signInvocation({
      agentId: "x", invocationId: "i1", input: "same", output: "o1",
    });
    const b = await signInvocation({
      agentId: "x", invocationId: "i2", input: "same", output: "o2",
    });
    expect(a.attestation.inputHash).toBe(b.attestation.inputHash);
    expect(a.attestation.outputHash).not.toBe(b.attestation.outputHash);
  });
});

describe("signInvocation() + verifyAttestation() — full roundtrip", () => {
  const ORIG = process.env.PLATFORM_SIGNING_KEY;
  let keyB64 = "";

  beforeEach(async () => {
    const kp = await generateKeypair();
    keyB64 = kp.privateKeyB64;
    process.env.PLATFORM_SIGNING_KEY = keyB64;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.PLATFORM_SIGNING_KEY;
    else process.env.PLATFORM_SIGNING_KEY = ORIG;
  });

  it("signs and verifies successfully (happy path)", async () => {
    const r = await signInvocation({
      agentId: "agent-42",
      invocationId: "inv-42",
      input: "extract invoice fields",
      output: "vendor=Acme, total=12500",
      modelUsed: "nvidia/nemotron-ultra-253b-v1",
      slaVerdict: "met",
    });
    expect(r.signed).toBe(true);
    expect(r.attestation._sig?.alg).toBe("ed25519");

    const v = await verifyAttestation(r.attestation);
    expect(v.signed).toBe(true);
    expect(v.valid).toBe(true);
  });

  it("detects tampering with any attestation field", async () => {
    const r = await signInvocation({
      agentId: "a",
      invocationId: "i",
      input: "x",
      output: "y",
    });
    const tampered = { ...r.attestation, agentId: "evil-swap" };
    const v = await verifyAttestation(tampered);
    expect(v.valid).toBe(false);
  });

  it("detects tampering with the slaVerdict field", async () => {
    const r = await signInvocation({
      agentId: "a",
      invocationId: "i",
      input: "x",
      output: "y",
      slaVerdict: "breached",
    });
    const tampered = { ...r.attestation, slaVerdict: "met" as const };
    const v = await verifyAttestation(tampered);
    expect(v.valid).toBe(false);
  });

  it("returns unsigned:false + valid:false for malformed _sig", async () => {
    const r = await signInvocation({
      agentId: "a", invocationId: "i", input: "x", output: "y",
    });
    const corrupt = {
      ...r.attestation,
      _sig: {
        ...r.attestation._sig!,
        signature: r.attestation._sig!.signature.slice(0, -4) + "AAAA",
      },
    };
    const v = await verifyAttestation(corrupt);
    expect(v.valid).toBe(false);
  });

  it("correctly reports signed:false for attestations without _sig", async () => {
    const unsigned = {
      agentId: "a",
      invocationId: "i",
      inputHash: "sha256-00",
      outputHash: "sha256-00",
      modelUsed: "",
      timestamp: "2026-01-01T00:00:00.000Z",
      slaVerdict: "not_enforced" as const,
      platform: "test",
    };
    const v = await verifyAttestation(unsigned);
    expect(v.signed).toBe(false);
    expect(v.valid).toBe(false);
  });

  it("rejects unsupported signature algs at verify time", async () => {
    const r = await signInvocation({
      agentId: "a", invocationId: "i", input: "x", output: "y",
    });
    const mismatched = {
      ...r.attestation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _sig: { ...(r.attestation._sig as any), alg: "rsa-sha256" },
    };
    const v = await verifyAttestation(mismatched);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/Unsupported/);
  });

  it("attestation payload includes the expected shape", async () => {
    const r = await signInvocation({
      agentId: "a",
      invocationId: "i",
      input: "x",
      output: "y",
      modelUsed: "some-model",
      slaVerdict: "breached",
    });
    expect(r.attestation.agentId).toBe("a");
    expect(r.attestation.invocationId).toBe("i");
    expect(r.attestation.modelUsed).toBe("some-model");
    expect(r.attestation.slaVerdict).toBe("breached");
    expect(r.attestation.platform).toBe(
      (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sovereignmatrix.agency").replace(/^https?:\/\//, ""),
    );
    expect(typeof r.attestation.timestamp).toBe("string");
  });
});
