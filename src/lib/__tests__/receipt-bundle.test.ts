/**
 * Tests for src/lib/receipt-bundle.ts — Wave 23.
 *
 * Composes the ZIP writer + signRun primitive into a tamper-evident
 * receipt archive. All hermetic; HMAC v1 scheme.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import {
  buildSignedReceiptBundle,
  verifyManifest,
  type BundleReceiptRow,
} from "@/lib/receipt-bundle";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
beforeAll(() => {
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

const sampleRow = (id: string): BundleReceiptRow => ({
  id,
  agentName: "test-agent",
  modelUsed: "claude-sonnet-4-6",
  durationMs: 1200,
  createdAt: new Date("2026-05-16T12:00:00.000Z"),
  signature: `v1=${id.padEnd(64, "0")}`,
  canonical: `{"id":"${id}","input":"hello"}`,
});

describe("buildSignedReceiptBundle", () => {
  it("returns a zip Buffer + a populated manifest", () => {
    const { zip, manifest } = buildSignedReceiptBundle([
      sampleRow("rcpt-01"),
      sampleRow("rcpt-02"),
    ]);
    expect(zip).toBeInstanceOf(Buffer);
    expect(zip.length).toBeGreaterThan(0);
    expect(manifest.v).toBe(1);
    expect(manifest.type).toBe("sovereign-receipt-bundle");
    expect(manifest.receiptCount).toBe(2);
    expect(manifest.bundleDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.signature).toMatch(/^v1=[0-9a-f]+$/);
  });

  it("ZIP starts with the local file header magic and ends with EOCD", () => {
    const { zip } = buildSignedReceiptBundle([sampleRow("a")]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });

  it("bundleDigest binds to receipt entries — same inputs → same digest", () => {
    const a = buildSignedReceiptBundle([sampleRow("x"), sampleRow("y")]);
    const b = buildSignedReceiptBundle([sampleRow("x"), sampleRow("y")]);
    expect(a.manifest.bundleDigest).toBe(b.manifest.bundleDigest);
  });

  it("bundleDigest changes if the receipt list changes", () => {
    const a = buildSignedReceiptBundle([sampleRow("x")]);
    const b = buildSignedReceiptBundle([sampleRow("x"), sampleRow("y")]);
    expect(a.manifest.bundleDigest).not.toBe(b.manifest.bundleDigest);
  });
});

describe("verifyManifest", () => {
  it("returns ok=true on an unmutated manifest", () => {
    const { manifest } = buildSignedReceiptBundle([sampleRow("a")]);
    expect(verifyManifest(manifest)).toEqual({ ok: true });
  });

  it("returns hash-mismatch when receiptCount is tampered", () => {
    const { manifest } = buildSignedReceiptBundle([sampleRow("a")]);
    const tampered = { ...manifest, receiptCount: 999 };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("hash-mismatch");
  });

  it("returns signature-mismatch when the signature is tampered", () => {
    const { manifest } = buildSignedReceiptBundle([sampleRow("a")]);
    const tampered = {
      ...manifest,
      signature: `v1=${"0".repeat(64)}`,
    };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(["signature-mismatch", "hash-mismatch"]).toContain(r.reason);
  });

  it("returns wrong-type for a non-Sovereign manifest", () => {
    const { manifest } = buildSignedReceiptBundle([sampleRow("a")]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tampered = { ...manifest, type: "other-bundle" as any };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong-type");
  });

  it("returns wrong-version on a future-version manifest", () => {
    const { manifest } = buildSignedReceiptBundle([sampleRow("a")]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tampered = { ...manifest, v: 99 as any };
    const r = verifyManifest(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong-version");
  });
});
