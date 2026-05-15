/**
 * Tests for src/lib/paypal.ts — Cook 177.
 *
 * Tests focus on the pure-function helpers (extractCustomId, the
 * event-type predicates, getConfig). The network-touching calls
 * (createOrder, captureOrder, verifyWebhookSignature) are exercised
 * end-to-end via the PayPal sandbox in integration testing — not
 * mocked here to keep the unit tests honest.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  _resetTokenCache,
  extractCustomId,
  getConfig,
  isPaymentCompletedEvent,
  isSubscriptionActivatedEvent,
  type WebhookEvent,
} from "../paypal";

const KEYS = [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_ENV",
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
  _resetTokenCache();
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

  it("returns sandbox by default", () => {
    process.env.PAYPAL_CLIENT_ID = "x";
    process.env.PAYPAL_CLIENT_SECRET = "y";
    process.env.PAYPAL_WEBHOOK_ID = "z";
    expect(getConfig()?.environment).toBe("sandbox");
  });

  it("respects PAYPAL_ENV=production", () => {
    process.env.PAYPAL_CLIENT_ID = "x";
    process.env.PAYPAL_CLIENT_SECRET = "y";
    process.env.PAYPAL_WEBHOOK_ID = "z";
    process.env.PAYPAL_ENV = "production";
    expect(getConfig()?.environment).toBe("production");
  });

  it("returns null when any single key is missing", () => {
    process.env.PAYPAL_CLIENT_ID = "x";
    process.env.PAYPAL_CLIENT_SECRET = "y";
    // webhook id missing
    expect(getConfig()).toBeNull();
  });
});

describe("isPaymentCompletedEvent", () => {
  it("recognises completed payments", () => {
    expect(isPaymentCompletedEvent("PAYMENT.CAPTURE.COMPLETED")).toBe(true);
    expect(isPaymentCompletedEvent("CHECKOUT.ORDER.COMPLETED")).toBe(true);
    expect(isPaymentCompletedEvent("CHECKOUT.ORDER.APPROVED")).toBe(true);
  });
  it("rejects other event types", () => {
    expect(isPaymentCompletedEvent("PAYMENT.CAPTURE.DENIED")).toBe(false);
    expect(isPaymentCompletedEvent("BILLING.SUBSCRIPTION.ACTIVATED")).toBe(
      false,
    );
  });
});

describe("isSubscriptionActivatedEvent", () => {
  it("recognises activation events", () => {
    expect(isSubscriptionActivatedEvent("BILLING.SUBSCRIPTION.ACTIVATED")).toBe(
      true,
    );
    expect(isSubscriptionActivatedEvent("BILLING.SUBSCRIPTION.CREATED")).toBe(
      true,
    );
  });
  it("rejects unrelated types", () => {
    expect(isSubscriptionActivatedEvent("PAYMENT.CAPTURE.COMPLETED")).toBe(
      false,
    );
  });
});

describe("extractCustomId", () => {
  it("reads custom_id from a capture resource", () => {
    const ev: WebhookEvent = {
      id: "WH_1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-05-15T00:00:00Z",
      resource: { custom_id: "addon:auditor-replay-seat:user_1" },
    };
    expect(extractCustomId(ev)).toBe("addon:auditor-replay-seat:user_1");
  });

  it("reads custom_id from purchase_units when not on the top resource", () => {
    const ev: WebhookEvent = {
      id: "WH_2",
      event_type: "CHECKOUT.ORDER.COMPLETED",
      create_time: "2026-05-15T00:00:00Z",
      resource: {
        purchase_units: [{ custom_id: "plan:node:user_2" }],
      },
    };
    expect(extractCustomId(ev)).toBe("plan:node:user_2");
  });

  it("returns null when no custom_id present", () => {
    const ev: WebhookEvent = {
      id: "WH_3",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-05-15T00:00:00Z",
      resource: {},
    };
    expect(extractCustomId(ev)).toBeNull();
  });
});
