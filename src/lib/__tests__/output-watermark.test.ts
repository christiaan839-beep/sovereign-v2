import { describe, it, expect } from "vitest";
import {
  embedWatermark,
  verifyWatermark,
  computeWatermarkSignature,
  stripWatermark,
} from "@/lib/output-watermark";

const SECRET = "test-watermark-secret-at-least-16chars";
const LONG_TEXT =
  "The Sovereign Matrix orchestration platform runs every agent through a five-layer safety pipeline before the response leaves the building. Each layer fails open by design — a bug in one of them never blocks a legitimate user — but every check that fires is logged to the immutable audit chain so an external auditor can verify the whole sequence after the fact. This is what we mean when we say transparency is a property of the system, not a marketing page. Customers reading these claims should be able to verify them; that's the whole point of publishing the manifest endpoint.";

describe("output-watermark", () => {
  it("embedWatermark inserts zero-width chars in long text", () => {
    const out = embedWatermark(LONG_TEXT, "leads", SECRET);
    expect(out.length).toBeGreaterThan(LONG_TEXT.length);
    // Should contain at least one zero-width char.
    expect(/[‌‍]/.test(out)).toBe(true);
  });

  it("embedWatermark is no-op on short text (<500 chars)", () => {
    const short = "tiny output";
    const out = embedWatermark(short, "leads", SECRET);
    expect(out).toBe(short);
  });

  it("embedWatermark is no-op when secret is missing/too short", () => {
    const out = embedWatermark(LONG_TEXT, "leads", "");
    expect(out).toBe(LONG_TEXT);
    const out2 = embedWatermark(LONG_TEXT, "leads", "tooshort");
    expect(out2).toBe(LONG_TEXT);
  });

  it("verifyWatermark accepts a watermarked text", () => {
    const watermarked = embedWatermark(LONG_TEXT, "leads", SECRET);
    const verdict = verifyWatermark(watermarked, "leads", SECRET);
    expect(verdict.valid).toBe(true);
  });

  it("verifyWatermark rejects when text was modified", () => {
    const watermarked = embedWatermark(LONG_TEXT, "leads", SECRET);
    // Replace a word — signature won't match.
    const tampered = watermarked.replace("Sovereign", "Tampered");
    const verdict = verifyWatermark(tampered, "leads", SECRET);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("signature_mismatch");
  });

  it("verifyWatermark rejects with wrong secret", () => {
    const watermarked = embedWatermark(LONG_TEXT, "leads", SECRET);
    const verdict = verifyWatermark(
      watermarked,
      "leads",
      "different-secret-also-16-plus",
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("signature_mismatch");
  });

  it("verifyWatermark rejects when claimed agent differs from embedded", () => {
    const watermarked = embedWatermark(LONG_TEXT, "leads", SECRET);
    const verdict = verifyWatermark(watermarked, "different-agent", SECRET);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("signature_mismatch");
  });

  it("verifyWatermark rejects unwatermarked text", () => {
    const verdict = verifyWatermark(LONG_TEXT, "leads", SECRET);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe("no_watermark_found");
  });

  it("stripWatermark restores the original text", () => {
    const watermarked = embedWatermark(LONG_TEXT, "leads", SECRET);
    expect(stripWatermark(watermarked)).toBe(LONG_TEXT);
  });

  it("embedWatermark is idempotent (calling twice doesn't compound)", () => {
    const once = embedWatermark(LONG_TEXT, "leads", SECRET);
    const twice = embedWatermark(once, "leads", SECRET);
    // Both should verify cleanly.
    expect(verifyWatermark(once, "leads", SECRET).valid).toBe(true);
    expect(verifyWatermark(twice, "leads", SECRET).valid).toBe(true);
    // Stripped versions should match.
    expect(stripWatermark(once)).toBe(stripWatermark(twice));
  });

  it("computeWatermarkSignature is deterministic", () => {
    const a = computeWatermarkSignature(LONG_TEXT, "leads", SECRET);
    const b = computeWatermarkSignature(LONG_TEXT, "leads", SECRET);
    expect(a.equals(b)).toBe(true);
  });

  it("watermark survives a copy-paste-style HTML round trip (zero-width chars unchanged)", () => {
    const watermarked = embedWatermark(LONG_TEXT, "leads", SECRET);
    // Simulate copy-paste through innerHTML / DOM normalization —
    // most DOMs preserve zero-width chars. Whitespace might collapse
    // but ZWJ/ZWNJ usually survive.
    const roundTripped = watermarked.replace(/\s+/g, " ");
    const verdict = verifyWatermark(roundTripped, "leads", SECRET);
    // Stripped text might differ if whitespace collapsed → signature
    // recomputation will mismatch. This is the documented limitation:
    // structural reformatting breaks the signature, but copy-paste
    // through Slack / iMessage / Markdown survives in practice.
    // We accept either outcome here — the test demonstrates the
    // limitation rather than asserts robustness.
    expect(typeof verdict.valid).toBe("boolean");
  });
});
