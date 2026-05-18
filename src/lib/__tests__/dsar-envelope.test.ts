/**
 * Tests for src/lib/dsar-envelope.ts — Wave 13.
 *
 * Covers the DSAR signing / verification path end-to-end. signRun /
 * verifySignature from agent-runs are the real implementations; the
 * test sets AGENT_RUN_SIGNING_SECRET to enable the v1 (HMAC) signing
 * branch deterministically.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, createHash } from "crypto";
import {
  signDsarEnvelope,
  verifyDsarEnvelope,
  stableStringify,
} from "@/lib/dsar-envelope";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeAll(() => {
  // Disable Ed25519 path; use the deterministic HMAC v1 scheme so the
  // signature for a given canonical projection is predictable.
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});

afterAll(() => {
  if (originalSecret !== undefined)
    process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
  else delete process.env.AGENT_RUN_SIGNING_SECRET;
  if (originalEd !== undefined)
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
});

const SAMPLE_PAYLOAD = {
  exportedAt: "2026-05-16T12:00:00.000Z",
  user: { clerkUserId: "user_abc", email: "test@example.com" },
  account: { subscriptions: [], payments: [] },
};

describe("signDsarEnvelope", () => {
  it("returns an attestation with all required fields", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_abc",
      email: "test@example.com",
    });
    expect(a.receiptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.signature).toMatch(/^v1=[0-9a-f]+$/);
    expect(a.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(a.canonical).toMatch(/"type":"dsar-export"/);
    expect(a.verifyUrl).toBe(`/api/dsar/verify/${a.receiptId}`);
  });

  it("binds clerkUserId and email into the canonical projection", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_xyz",
      email: "alice@example.com",
    });
    const parsed = JSON.parse(a.canonical);
    expect(parsed.clerkUserId).toBe("user_xyz");
    expect(parsed.email).toBe("alice@example.com");
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe("dsar-export");
  });

  it("binds a SHA-256 of the stable-stringified payload", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_abc",
      email: "test@example.com",
    });
    const parsed = JSON.parse(a.canonical);
    const expectedPayloadHash = createHash("sha256")
      .update(stableStringify(SAMPLE_PAYLOAD), "utf8")
      .digest("hex");
    expect(parsed.payloadHash).toBe(expectedPayloadHash);
  });

  it("produces distinct receiptIds for back-to-back signs of the same payload", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "u",
      email: "e@e.com",
    });
    const b = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "u",
      email: "e@e.com",
    });
    expect(a.receiptId).not.toBe(b.receiptId);
  });
});

describe("verifyDsarEnvelope", () => {
  it("returns ok=true when the recomputed payload hash matches and signature validates", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_abc",
      email: "test@example.com",
    });
    const recomputed = createHash("sha256")
      .update(stableStringify(SAMPLE_PAYLOAD), "utf8")
      .digest("hex");
    expect(verifyDsarEnvelope(a, recomputed)).toEqual({ ok: true });
  });

  it("rejects with payload-hash-mismatch when the payload was swapped", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_abc",
      email: "test@example.com",
    });
    // An auditor presents a DIFFERENT export under the same receipt id.
    const tamperedPayload = { ...SAMPLE_PAYLOAD, extraField: "I was added" };
    const recomputed = createHash("sha256")
      .update(stableStringify(tamperedPayload), "utf8")
      .digest("hex");
    const r = verifyDsarEnvelope(a, recomputed);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("payload-hash-mismatch");
  });

  it("rejects with signature-mismatch when the signature is tampered", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_abc",
      email: "test@example.com",
    });
    const recomputed = createHash("sha256")
      .update(stableStringify(SAMPLE_PAYLOAD), "utf8")
      .digest("hex");
    // Flip a byte in the signature body.
    const corrupted = {
      ...a,
      signature: a.signature.slice(0, -2) + "00",
    };
    const r = verifyDsarEnvelope(corrupted, recomputed);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("signature-mismatch");
  });

  it("rejects with canonical-hash-mismatch when the canonical bytes are tampered", () => {
    const a = signDsarEnvelope(SAMPLE_PAYLOAD, {
      clerkUserId: "user_abc",
      email: "test@example.com",
    });
    const recomputed = createHash("sha256")
      .update(stableStringify(SAMPLE_PAYLOAD), "utf8")
      .digest("hex");

    // Swap the canonical for a different one whose payloadHash field
    // matches recomputed (so we get past the payload-hash check) but
    // whose actual bytes don't hash to the stored contentHash.
    const fake = JSON.parse(a.canonical);
    fake.email = "attacker@example.com"; // change the canonical bytes
    const corrupted = { ...a, canonical: JSON.stringify(fake) };
    const r = verifyDsarEnvelope(corrupted, recomputed);
    // Either signature-mismatch (the sig is for the old canonical) or
    // canonical-hash-mismatch (the contentHash check). Both are correct
    // failure modes — assert NOT ok.
    expect(r.ok).toBe(false);
    expect(["signature-mismatch", "canonical-hash-mismatch"]).toContain(
      r.reason,
    );
  });
});

describe("stableStringify", () => {
  it("produces byte-identical output regardless of object key order", () => {
    const a = stableStringify({ b: 2, a: 1, c: { z: 9, y: 8 } });
    const b = stableStringify({ a: 1, c: { y: 8, z: 9 }, b: 2 });
    expect(a).toBe(b);
  });

  it("preserves array element order (arrays are semantically ordered)", () => {
    const a = stableStringify([3, 1, 2]);
    expect(a).toBe("[3,1,2]");
  });

  it("handles primitives and null", () => {
    expect(stableStringify("hello")).toBe('"hello"');
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify(null)).toBe("null");
  });
});
