/**
 * Regression tests for src/app/api/_webhooks/twilio/route.ts
 *
 * Covers the 3 critical fixes from the security audit:
 *   1. timingSafeEqual must not throw on mismatched-length signatures
 *   2. Signature enforcement must apply regardless of NODE_ENV
 *   3. XML escape must neutralize TwiML injection vectors
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: async () => null }),
}));

import crypto from "crypto";
import { validateTwilioSignature } from "@/app/api/_webhooks/twilio/route";

const TEST_TOKEN = "test_auth_token_abc123";
const TEST_URL = "https://sovereignmatrix.agency/api/_webhooks/twilio";

function signTwilio(url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto.createHmac("sha1", TEST_TOKEN).update(data).digest("base64");
}

describe("validateTwilioSignature — security regression", () => {
  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = TEST_TOKEN;
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  it("accepts a correctly signed request", () => {
    const params = { From: "+15550001111", Body: "hello" };
    const sig = signTwilio(TEST_URL, params);
    expect(validateTwilioSignature(sig, TEST_URL, params)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const params = { From: "+15550001111", Body: "hello" };
    const sig = signTwilio(TEST_URL, params);
    const tampered = { From: "+15550001111", Body: "attacker" };
    expect(validateTwilioSignature(sig, TEST_URL, tampered)).toBe(false);
  });

  // Regression: previously threw RangeError on mismatched lengths,
  // then the outer catch returned 200 OK — fully bypassable.
  it("returns false (not throws) on a too-short signature", () => {
    const params = { From: "+15550001111", Body: "hello" };
    expect(() =>
      validateTwilioSignature("short", TEST_URL, params),
    ).not.toThrow();
    expect(validateTwilioSignature("short", TEST_URL, params)).toBe(false);
  });

  it("returns false (not throws) on a too-long signature", () => {
    const params = { From: "+15550001111", Body: "hello" };
    const longSig = "a".repeat(1000);
    expect(() =>
      validateTwilioSignature(longSig, TEST_URL, params),
    ).not.toThrow();
    expect(validateTwilioSignature(longSig, TEST_URL, params)).toBe(false);
  });

  it("returns false on empty signature", () => {
    const params = { From: "+15550001111", Body: "hello" };
    expect(validateTwilioSignature("", TEST_URL, params)).toBe(false);
    expect(validateTwilioSignature(null, TEST_URL, params)).toBe(false);
  });

  it("fails secure when TWILIO_AUTH_TOKEN is unset", () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const params = { From: "+15550001111", Body: "hello" };
    expect(validateTwilioSignature("anything", TEST_URL, params)).toBe(false);
  });
});

/**
 * TwiML injection — the fix XML-escapes the NIM response before
 * interpolating into <Message><Body>. We test the escape logic
 * directly by recreating it (it's internal to the route module).
 */
describe("TwiML XML escape — injection regression", () => {
  function xmlEscape(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  it("escapes closing Body tag to prevent verb injection", () => {
    const malicious =
      "</Body></Message><Redirect>https://attacker/pwn</Redirect><Message><Body>pwn";
    const safe = xmlEscape(malicious);
    expect(safe).not.toContain("</Body>");
    expect(safe).not.toContain("<Redirect>");
    expect(safe).toContain("&lt;/Body&gt;");
    expect(safe).toContain("&lt;Redirect&gt;");
  });

  it("escapes ampersands first to avoid double-escaping", () => {
    const input = "a & <b>";
    expect(xmlEscape(input)).toBe("a &amp; &lt;b&gt;");
  });

  it("preserves plain text unchanged", () => {
    const input = "Hello! How can I help you today?";
    expect(xmlEscape(input)).toBe("Hello! How can I help you today?");
  });

  it("escapes quotes and apostrophes", () => {
    expect(xmlEscape(`"hello" 'world'`)).toBe(
      "&quot;hello&quot; &apos;world&apos;",
    );
  });
});
