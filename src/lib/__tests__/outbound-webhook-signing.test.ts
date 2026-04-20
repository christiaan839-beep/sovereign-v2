import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  buildSignedWebhook,
  verifyInboundSignature,
} from "../outbound-webhook-signing";

const SECRET = "whsec_test_abc123";

describe("outbound webhook signing — build + verify round-trip", () => {
  it("builds headers with timestamp + HMAC + delivery ID", () => {
    const { headers, body } = buildSignedWebhook({
      secret: SECRET,
      event: "lead.qualified",
      payload: { leadId: "lead_123", score: 92 },
    });

    expect(headers["X-Sovereign-Signature"]).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    expect(headers["X-Sovereign-Event"]).toBe("lead.qualified");
    expect(headers["X-Sovereign-Delivery-Id"]).toHaveLength(36); // UUID v4
    expect(headers["Content-Type"]).toBe("application/json");
    expect(body).toBe('{"leadId":"lead_123","score":92}');
  });

  it("verifies a signature we just built", () => {
    const { headers, body } = buildSignedWebhook({
      secret: SECRET,
      event: "test.event",
      payload: { ok: true },
    });

    const result = verifyInboundSignature({
      secret: SECRET,
      rawBody: body,
      signatureHeader: headers["X-Sovereign-Signature"],
    });

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects signature with wrong secret", () => {
    const { headers, body } = buildSignedWebhook({
      secret: SECRET,
      event: "test.event",
      payload: { ok: true },
    });

    const result = verifyInboundSignature({
      secret: "whsec_test_WRONG",
      rawBody: body,
      signatureHeader: headers["X-Sovereign-Signature"],
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("hmac_mismatch");
  });

  it("rejects tampered payload", () => {
    const { headers, body } = buildSignedWebhook({
      secret: SECRET,
      event: "test.event",
      payload: { amount: 100 },
    });

    const tampered = body.replace("100", "999999");

    const result = verifyInboundSignature({
      secret: SECRET,
      rawBody: tampered,
      signatureHeader: headers["X-Sovereign-Signature"],
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("hmac_mismatch");
  });

  it("rejects malformed signature header", () => {
    expect(
      verifyInboundSignature({
        secret: SECRET,
        rawBody: "{}",
        signatureHeader: "not-a-valid-header",
      }),
    ).toEqual({ valid: false, reason: "malformed_signature" });

    expect(
      verifyInboundSignature({
        secret: SECRET,
        rawBody: "{}",
        signatureHeader: null,
      }),
    ).toEqual({ valid: false, reason: "missing_signature_header" });
  });

  it("rejects timestamps outside the tolerance window", () => {
    // Build a signature with a timestamp 10 minutes old by faking the clock
    const realDateNow = Date.now;
    try {
      // 10 minutes ago
      Date.now = () => realDateNow() - 10 * 60 * 1000;
      const { headers, body } = buildSignedWebhook({
        secret: SECRET,
        event: "test.event",
        payload: { ok: true },
      });
      Date.now = realDateNow;

      const result = verifyInboundSignature({
        secret: SECRET,
        rawBody: body,
        signatureHeader: headers["X-Sovereign-Signature"],
        toleranceSeconds: 300, // 5 minutes
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("timestamp_out_of_tolerance");
    } finally {
      Date.now = realDateNow;
    }
  });

  it("accepts custom tolerance window", () => {
    const realDateNow = Date.now;
    try {
      Date.now = () => realDateNow() - 10 * 60 * 1000;
      const { headers, body } = buildSignedWebhook({
        secret: SECRET,
        event: "test.event",
        payload: { ok: true },
      });
      Date.now = realDateNow;

      // With a 30-min tolerance, the 10-min-old signature is valid
      const result = verifyInboundSignature({
        secret: SECRET,
        rawBody: body,
        signatureHeader: headers["X-Sovereign-Signature"],
        toleranceSeconds: 30 * 60,
      });

      expect(result.valid).toBe(true);
    } finally {
      Date.now = realDateNow;
    }
  });

  it("preserves the delivery-id across retries via explicit param", () => {
    const deliveryId = "my-custom-delivery-123";
    const { headers } = buildSignedWebhook({
      secret: SECRET,
      event: "test",
      payload: {},
      deliveryId,
    });
    expect(headers["X-Sovereign-Delivery-Id"]).toBe(deliveryId);
  });
});
