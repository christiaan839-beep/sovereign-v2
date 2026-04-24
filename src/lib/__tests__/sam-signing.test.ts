/**
 * Tests for SAM manifest signing — deterministic canonicalization +
 * round-trip sign/verify + tamper detection.
 *
 * Uses WebCrypto from Node 20+. No external crypto deps required.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  generateKeypair,
  signManifest,
  verifyManifestSignature,
} from "../sam-signing";

/* ─── canonicalStringify ──────────────────────────────────────── */

describe("canonicalStringify()", () => {
  it("sorts object keys recursively", () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(
      canonicalStringify({ outer: { z: 1, a: 2 }, first: true }),
    ).toBe('{"first":true,"outer":{"a":2,"z":1}}');
  });

  it("preserves array order", () => {
    expect(canonicalStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("JSON-encodes strings (quotes, escapes)", () => {
    expect(canonicalStringify("hello \"world\"")).toBe('"hello \\"world\\""');
  });

  it("emits null for non-finite numbers", () => {
    expect(canonicalStringify(Number.NaN)).toBe("null");
    expect(canonicalStringify(Number.POSITIVE_INFINITY)).toBe("null");
  });

  it("matches JSON for primitives", () => {
    expect(canonicalStringify(null)).toBe("null");
    expect(canonicalStringify(true)).toBe("true");
    expect(canonicalStringify(42)).toBe("42");
  });

  it("is byte-identical for same-content differently-ordered objects", () => {
    const a = canonicalStringify({ a: 1, b: { x: 10, y: 20 } });
    const b = canonicalStringify({ b: { y: 20, x: 10 }, a: 1 });
    expect(a).toBe(b);
  });
});

/* ─── generateKeypair ─────────────────────────────────────────── */

describe("generateKeypair()", () => {
  it("returns base64url-encoded public and private keys", async () => {
    const kp = await generateKeypair();
    expect(kp.publicKeyB64).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(kp.privateKeyB64).toMatch(/^[A-Za-z0-9_-]+$/);
    // Ed25519 SPKI public keys are ~44 bytes b64url; private PKCS8 ~64.
    expect(kp.publicKeyB64.length).toBeGreaterThan(30);
    expect(kp.privateKeyB64.length).toBeGreaterThan(60);
  });

  it("produces distinct keypairs on each call", async () => {
    const a = await generateKeypair();
    const b = await generateKeypair();
    expect(a.privateKeyB64).not.toBe(b.privateKeyB64);
  });
});

/* ─── Round-trip sign / verify ────────────────────────────────── */

describe("signManifest() + verifyManifestSignature()", () => {
  const BASE_MANIFEST = {
    sam: "1.0",
    slug: "invoice-ocr",
    displayName: "Invoice OCR",
    purpose: "Extract fields from invoice images",
    category: "Finance",
    version: "1.0.0",
    inputs: [{ name: "imageUrl", type: "string" }],
    output: { type: "object" },
    guarantees: ["Never fabricates missing fields"],
  };

  it("signs then verifies successfully (happy path)", async () => {
    const kp = await generateKeypair();
    const signed = await signManifest(BASE_MANIFEST, kp.privateKeyB64);
    expect(signed._sig).toBeDefined();
    expect(signed._sig?.alg).toBe("ed25519");
    expect(typeof signed._sig?.signature).toBe("string");

    const verdict = await verifyManifestSignature(signed);
    expect(verdict.unsigned).toBe(false);
    expect(verdict.valid).toBe(true);
    expect(verdict.publicKey).toBe(signed._sig?.publicKey);
  });

  it("detects tampering with any field", async () => {
    const kp = await generateKeypair();
    const signed = await signManifest(BASE_MANIFEST, kp.privateKeyB64);
    const tampered = { ...signed, purpose: "MALICIOUS PURPOSE" };
    const verdict = await verifyManifestSignature(tampered);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/did not verify/);
  });

  it("detects tampering with a nested input", async () => {
    const kp = await generateKeypair();
    const signed = await signManifest(BASE_MANIFEST, kp.privateKeyB64);
    const tampered = {
      ...signed,
      inputs: [{ name: "imageUrl", type: "evil" }],
    };
    const verdict = await verifyManifestSignature(tampered);
    expect(verdict.valid).toBe(false);
  });

  it("treats manifests without _sig as unsigned (not an error)", async () => {
    const verdict = await verifyManifestSignature(BASE_MANIFEST);
    expect(verdict.unsigned).toBe(true);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBeUndefined();
  });

  it("rejects unsupported signature algorithms", async () => {
    const verdict = await verifyManifestSignature({
      ...BASE_MANIFEST,
      _sig: {
        alg: "rsa-sha256",
        publicKey: "x",
        signature: "y",
      },
    });
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/Unsupported/);
  });

  it("rejects malformed _sig blocks", async () => {
    const verdict = await verifyManifestSignature({
      ...BASE_MANIFEST,
      _sig: { alg: "ed25519" },
    });
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/Malformed/);
  });

  it("rejects signatures with corrupted signature bytes", async () => {
    const kp = await generateKeypair();
    const signed = await signManifest(BASE_MANIFEST, kp.privateKeyB64);
    const corrupted = {
      ...signed,
      _sig: {
        ...signed._sig!,
        signature: signed._sig!.signature.slice(0, -4) + "AAAA",
      },
    };
    const verdict = await verifyManifestSignature(corrupted);
    expect(verdict.valid).toBe(false);
  });

  it("re-signing with a new key succeeds (overwrites old _sig)", async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const signed1 = await signManifest(BASE_MANIFEST, kp1.privateKeyB64);
    const signed2 = await signManifest(signed1, kp2.privateKeyB64);
    expect(signed2._sig?.publicKey).not.toBe(signed1._sig?.publicKey);

    const v1 = await verifyManifestSignature(signed1);
    const v2 = await verifyManifestSignature(signed2);
    expect(v1.valid).toBe(true);
    expect(v2.valid).toBe(true);
  });

  it("handles manifests with reordered keys (canonical sort preserves validity)", async () => {
    const kp = await generateKeypair();
    const signed = await signManifest(BASE_MANIFEST, kp.privateKeyB64);
    // Rebuild with keys in a different order.
    const reshuffled = Object.fromEntries(
      Object.entries(signed).reverse(),
    ) as typeof signed;
    const verdict = await verifyManifestSignature(reshuffled);
    expect(verdict.valid).toBe(true);
  });
});
