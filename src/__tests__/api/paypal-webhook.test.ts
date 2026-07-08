/**
 * Tests for POST /api/_payments/paypal/webhook — plan provisioning.
 *
 * Pins the BACKLOG paypal-plan fix: a completed PayPal capture whose
 * custom_id encodes `plan:<planId>:<userId>` MUST upsert a subscription
 * row (the pre-fix code fell through to "no provisioning hook", charging
 * the customer without upgrading them). Amount-tampering is refused.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const alreadyProcessedMock = vi.fn();
const unmarkProcessedMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertOnConflictMock = vi.fn();
const verifySigMock = vi.fn();

vi.mock("@/lib/idempotency", () => ({
  alreadyProcessed: (...a: unknown[]) => alreadyProcessedMock(...a),
  unmarkProcessed: (...a: unknown[]) => unmarkProcessedMock(...a),
}));

vi.mock("@/lib/paypal", () => ({
  getConfig: () => ({ clientId: "x", clientSecret: "y", webhookId: "z" }),
  verifyWebhookSignature: (...a: unknown[]) => verifySigMock(...a),
  extractCustomId: (event: { resource?: { custom_id?: string } }) =>
    event.resource?.custom_id ?? null,
  isPaymentCompletedEvent: (t: string) => t === "PAYMENT.CAPTURE.COMPLETED",
  isSubscriptionActivatedEvent: (t: string) =>
    t === "BILLING.SUBSCRIPTION.ACTIVATED",
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: () => Promise.resolve(null) }),
}));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => {
        dbInsertValuesMock(v);
        return {
          onConflictDoUpdate: (cfg: unknown) => {
            dbInsertOnConflictMock(cfg);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  subscriptions: { userId: "userId" },
}));

// Real plans.ts so normalizePlanId + PLANS price validation run for real.
async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/_payments/paypal/webhook/route");
}

function makeRequest(event: unknown) {
  return new Request("http://x/api/paypal/webhook", {
    method: "POST",
    headers: { "paypal-transmission-id": "t1" },
    body: JSON.stringify(event),
  });
}

function planEvent(planId: string, valueUsd: string, id = "evt_1") {
  return {
    id,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      custom_id: `plan:${planId}:user_42`,
      amount: { value: valueUsd, currency_code: "USD" },
    },
  };
}

describe("POST /api/paypal/webhook — plan provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alreadyProcessedMock.mockResolvedValue(false);
    verifySigMock.mockResolvedValue(true);
  });

  it("upserts a subscription for a completed plan capture with matching amount", async () => {
    const { POST } = await loadRoute();
    // starter = $19.00
    const res = await POST(makeRequest(planEvent("starter", "19.00")));
    expect(res.status).toBe(200);
    expect(dbInsertValuesMock).toHaveBeenCalledTimes(1);
    const values = dbInsertValuesMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(values.userId).toBe("user_42");
    expect(values.plan).toBe("starter");
    expect(values.status).toBe("active");
    expect(values.currentPeriodEnd).toBeInstanceOf(Date);
    expect(String(values.stripeCustomerId)).toMatch(/^pp_/);
    expect(dbInsertOnConflictMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to upgrade when the captured amount is far from the plan price", async () => {
    const { POST } = await loadRoute();
    // Pay $1 for the starter ($19) plan — tampered custom_id/amount.
    const res = await POST(makeRequest(planEvent("starter", "1.00")));
    expect(res.status).toBe(200); // acknowledged, but…
    expect(dbInsertValuesMock).not.toHaveBeenCalled(); // …not provisioned
  });

  it("ignores an unrecognized plan id (no upsert)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(planEvent("__proto__", "19.00")));
    expect(res.status).toBe(200);
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("skips a duplicate event without provisioning", async () => {
    alreadyProcessedMock.mockResolvedValue(true);
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(planEvent("starter", "19.00")));
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });
});
