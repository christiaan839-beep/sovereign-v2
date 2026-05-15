/**
 * Tests for src/lib/moonpay.ts — Cook 178.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import {
  buildWidgetUrl,
  getConfig,
  isTransactionCompleted,
  isTransactionFailed,
  parseExternalCustomerId,
  type WebhookEvent,
  verifyWebhookSignature,
} from "../moonpay";

const KEYS = [
  "MOONPAY_PUBLIC_KEY",
  "MOONPAY_SECRET_KEY",
  "MOONPAY_WIDGET_ORIGIN",
  "MOONPAY_WEBHOOK_SECRET",
];

function snapshot(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) out[k] = process.env[k];
  return out;
}

function restore(s: Record<string, string | undefined>): void {
  for (const k of KEYS) {
    if (s[k] === undefined) delete process.env[k];
    else process.env[k] = s[k];
  }
}

describe("getConfig", () => {
  let prev: Record<string, string | undefined>;
  beforeEach(() => {
    prev = snapshot();
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => restore(prev));

  it("returns null when env unset", () => {
    expect(getConfig()).toBeNull();
  });
  it("returns config with both keys present", () => {
    process.env.MOONPAY_PUBLIC_KEY = "pk_test_x";
    process.env.MOONPAY_SECRET_KEY = "sk_test_y";
    const cfg = getConfig();
    expect(cfg?.publicKey).toBe("pk_test_x");
    expect(cfg?.secretKey).toBe("sk_test_y");
    expect(cfg?.widgetOrigin).toContain("moonpay.com");
  });
});

describe("buildWidgetUrl", () => {
  let prev: Record<string, string | undefined>;
  beforeEach(() => {
    prev = snapshot();
    process.env.MOONPAY_PUBLIC_KEY = "pk_test_x";
    process.env.MOONPAY_SECRET_KEY = "sk_test_y";
    process.env.MOONPAY_WIDGET_ORIGIN = "https://buy-sandbox.moonpay.com";
  });
  afterEach(() => restore(prev));

  it("returns null when config missing", () => {
    delete process.env.MOONPAY_PUBLIC_KEY;
    expect(
      buildWidgetUrl({
        currencyCode: "usdc_polygon",
        walletAddress: "0xabc1234567890abcdef1234567890abcdef12345678",
        baseAmount: 99,
        externalCustomerId: "addon:auditor-replay-seat:user_1",
        redirectUrl: "https://sovereignmatrix.agency/dashboard",
      }),
    ).toBeNull();
  });

  it("throws on invalid inputs", () => {
    expect(() =>
      buildWidgetUrl({
        currencyCode: "",
        walletAddress: "0xabc1234567890abcdef1234567890abcdef12345678",
        baseAmount: 99,
        externalCustomerId: "addon:x:u",
        redirectUrl: "https://x.io",
      }),
    ).toThrow();
    expect(() =>
      buildWidgetUrl({
        currencyCode: "eth",
        walletAddress: "",
        baseAmount: 99,
        externalCustomerId: "addon:x:u",
        redirectUrl: "https://x.io",
      }),
    ).toThrow();
    expect(() =>
      buildWidgetUrl({
        currencyCode: "eth",
        walletAddress: "0xabc",
        baseAmount: 0,
        externalCustomerId: "addon:x:u",
        redirectUrl: "https://x.io",
      }),
    ).toThrow();
  });

  it("appends a base64 signature", () => {
    const url = buildWidgetUrl({
      currencyCode: "usdc_polygon",
      walletAddress: "0xabc1234567890abcdef1234567890abcdef12345678",
      baseAmount: 99.5,
      externalCustomerId: "addon:auditor-replay-seat:user_1",
      redirectUrl: "https://sovereignmatrix.agency/dashboard",
    });
    expect(url).toMatch(/^https:\/\/buy-sandbox\.moonpay\.com\?/);
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("signature")).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(parsed.searchParams.get("apiKey")).toBe("pk_test_x");
    expect(parsed.searchParams.get("baseCurrencyAmount")).toBe("99.50");
  });

  it("includes email when provided", () => {
    const url = buildWidgetUrl({
      currencyCode: "eth",
      walletAddress: "0xabc1234567890abcdef1234567890abcdef12345678",
      baseAmount: 50,
      externalCustomerId: "addon:x:u",
      redirectUrl: "https://x.io",
      email: "test@example.com",
    });
    expect(new URL(url!).searchParams.get("email")).toBe("test@example.com");
  });
});

describe("verifyWebhookSignature", () => {
  let prev: Record<string, string | undefined>;
  beforeEach(() => {
    prev = snapshot();
    process.env.MOONPAY_PUBLIC_KEY = "pk_test_x";
    process.env.MOONPAY_SECRET_KEY = "sk_test_secret_y";
  });
  afterEach(() => restore(prev));

  function sign(body: string, secret = "sk_test_secret_y"): string {
    return createHmac("sha256", secret).update(body).digest("base64");
  }

  it("returns true for a correctly-signed body", () => {
    const body = JSON.stringify({
      type: "transaction_updated",
      data: { id: "t1" },
    });
    expect(verifyWebhookSignature({ body, signatureHeader: sign(body) })).toBe(
      true,
    );
  });

  it("returns false when header missing", () => {
    expect(verifyWebhookSignature({ body: "{}", signatureHeader: null })).toBe(
      false,
    );
  });

  it("returns false when signature mismatches", () => {
    expect(
      verifyWebhookSignature({
        body: "{}",
        signatureHeader: sign("different"),
      }),
    ).toBe(false);
  });

  it("returns false when config unset", () => {
    delete process.env.MOONPAY_SECRET_KEY;
    expect(
      verifyWebhookSignature({
        body: "{}",
        signatureHeader: "x",
      }),
    ).toBe(false);
  });

  it("uses MOONPAY_WEBHOOK_SECRET when present", () => {
    process.env.MOONPAY_WEBHOOK_SECRET = "sk_webhook_only";
    const body = JSON.stringify({ type: "x", data: { id: "y" } });
    expect(
      verifyWebhookSignature({
        body,
        signatureHeader: sign(body, "sk_webhook_only"),
      }),
    ).toBe(true);
    // Signing under the wrong secret fails.
    expect(
      verifyWebhookSignature({
        body,
        signatureHeader: sign(body, "sk_test_secret_y"),
      }),
    ).toBe(false);
  });
});

describe("isTransactionCompleted / isTransactionFailed", () => {
  it("recognises completed status", () => {
    const ev: WebhookEvent = {
      type: "transaction_updated",
      data: { id: "t1", status: "completed" },
    };
    expect(isTransactionCompleted(ev)).toBe(true);
    expect(isTransactionFailed(ev)).toBe(false);
  });
  it("recognises failed status", () => {
    const ev: WebhookEvent = {
      type: "transaction_updated",
      data: { id: "t2", status: "failed" },
    };
    expect(isTransactionFailed(ev)).toBe(true);
    expect(isTransactionCompleted(ev)).toBe(false);
  });
  it("ignores other types", () => {
    const ev: WebhookEvent = {
      type: "transaction_created",
      data: { id: "t3", status: "completed" },
    };
    expect(isTransactionCompleted(ev)).toBe(false);
  });
});

describe("parseExternalCustomerId", () => {
  it("returns the three parts when well-formed", () => {
    expect(parseExternalCustomerId("addon:auditor-replay-seat:user_1")).toEqual(
      {
        intent: "addon",
        itemId: "auditor-replay-seat",
        userId: "user_1",
      },
    );
  });
  it("returns null when undefined", () => {
    expect(parseExternalCustomerId(undefined)).toBeNull();
  });
  it("returns null on malformed input", () => {
    expect(parseExternalCustomerId("only:two")).toBeNull();
    expect(parseExternalCustomerId("::empty")).toBeNull();
    expect(parseExternalCustomerId("a:b:")).toBeNull();
  });
});
