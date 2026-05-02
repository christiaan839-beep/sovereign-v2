/**
 * Integration tests for the Stripe webhook handler.
 *
 *   src/app/api/_payments/stripe/webhook/route.ts
 *
 * Covers the security + correctness contract:
 *   1. Returns 503 when STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY are missing
 *   2. Returns 400 when the stripe-signature header is missing
 *   3. Returns 400 when the signature is invalid (forgery rejected)
 *   4. Returns 400 when the event timestamp is older than 5 minutes (replay)
 *   5. Returns { duplicate: true } on the second delivery of the same event ID
 *      (idempotency via @/lib/idempotency)
 *   6. checkout.session.completed → upserts the subscription with the metadata.plan
 *   7. customer.subscription.updated → maps Stripe status to our internal status
 *   8. customer.subscription.deleted → downgrades the user to the free plan
 *   9. invoice.payment_failed → flags the subscription as past_due
 *
 * The whole webhook surface is the highest-blast-radius integration in the
 * codebase: one bug here lets attackers forge subscription upgrades or
 * silently lose paying customers' billing state.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import Stripe from "stripe";

// ────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────

const STRIPE_SECRET = "sk_test_dummy_key_for_signing";
const WEBHOOK_SECRET = "whsec_test_dummy_secret";

// Capture every DB mutation the webhook performs so each test can assert
// the exact writes triggered by an event.
type DbCall =
  | {
      op: "insert.upsert";
      values: Record<string, unknown>;
      target: string;
      set: Record<string, unknown>;
    }
  | { op: "update"; set: Record<string, unknown>; whereCalled: boolean };
const dbCalls: DbCall[] = [];

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (cfg: {
          target: { name?: string } | unknown;
          set: Record<string, unknown>;
        }) => {
          dbCalls.push({
            op: "insert.upsert",
            values,
            target: String(
              (cfg.target as { name?: string })?.name ?? "subscriptions.userId",
            ),
            set: cfg.set,
          });
          return Promise.resolve();
        },
      }),
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: () => {
          dbCalls.push({ op: "update", set, whereCalled: true });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  subscriptions: {
    userId: { name: "user_id" },
    stripeCustomerId: { name: "stripe_customer_id" },
  },
}));

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

/**
 * Sign a payload using Stripe's documented HMAC scheme so the route's
 * `stripe.webhooks.constructEvent` accepts it without hitting the network.
 *
 * Format: t=<unix>,v1=<HMAC_SHA256(secret, "<unix>.<payload>")>
 */
function signStripePayload(payload: string, secret: string, timestamp: number) {
  const signedPayload = `${timestamp}.${payload}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

function buildEventBody(
  event: Partial<Stripe.Event> & { type: string; data: { object: unknown } },
) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    id: event.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    api_version: "2025-04-30.basil",
    created: event.created ?? now,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    ...event,
  });
}

function buildRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://app.local/api/_payments/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/_payments/stripe/webhook/route");
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe("Stripe webhook — environment & signature gates", () => {
  beforeEach(() => {
    dbCalls.length = 0;
    vi.unstubAllEnvs();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns 503 when STRIPE_SECRET_KEY is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);

    const { POST } = await loadRoute();
    const res = await POST(buildRequest("{}"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const { POST } = await loadRoute();
    const res = await POST(buildRequest("{}"));
    expect(res.status).toBe(503);
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);

    const { POST } = await loadRoute();
    const res = await POST(buildRequest('{"id":"evt_x"}'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing signature/i);
  });

  it("returns 400 when the signature is forged with a different secret", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);

    const body = buildEventBody({
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1", plan: "node" } } },
    });
    const sig = signStripePayload(
      body,
      "whsec_attacker_secret",
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid signature/i);
    expect(dbCalls).toHaveLength(0);
  });

  it("returns 400 when the body has been tampered with after signing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);

    const original = buildEventBody({
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1", plan: "starter" } } },
    });
    const sig = signStripePayload(
      original,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    // Attacker swaps "starter" → "enterprise" but reuses the original signature.
    const tampered = original.replace(
      '"plan":"starter"',
      '"plan":"enterprise"',
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(tampered, { "stripe-signature": sig }));
    expect(res.status).toBe(400);
    expect(dbCalls).toHaveLength(0);
  });

  it("returns 400 when the event timestamp is older than 5 minutes (replay)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);

    const sixMinAgo = Math.floor(Date.now() / 1000) - 6 * 60;
    const body = buildEventBody({
      type: "checkout.session.completed",
      created: sixMinAgo,
      data: { object: { metadata: { userId: "u1", plan: "node" } } },
    });
    // Sign the body with a fresh timestamp so signature passes — the route
    // rejects on event.created age, not signature timestamp.
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/stale/i);
    expect(dbCalls).toHaveLength(0);
  });
});

describe("Stripe webhook — idempotency", () => {
  beforeEach(() => {
    dbCalls.length = 0;
    vi.unstubAllEnvs();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  });

  it("the second delivery of the same event is skipped (no duplicate write)", async () => {
    const eventId = "evt_idem_" + Math.random();
    const body = buildEventBody({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "u_idem", plan: "starter" },
          customer: "cus_idem",
          subscription: "sub_idem",
        },
      },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const first = await POST(buildRequest(body, { "stripe-signature": sig }));
    const second = await POST(buildRequest(body, { "stripe-signature": sig }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.received).toBe(true);
    expect(firstBody.duplicate).toBeUndefined();
    expect(secondBody.duplicate).toBe(true);

    // The DB upsert ran once even though Stripe delivered the event twice.
    expect(dbCalls.filter((c) => c.op === "insert.upsert")).toHaveLength(1);
  });
});

describe("Stripe webhook — event handlers", () => {
  beforeEach(() => {
    dbCalls.length = 0;
    vi.unstubAllEnvs();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_SECRET);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  });

  it("checkout.session.completed → upserts subscription with the right plan + customer ids", async () => {
    const body = buildEventBody({
      id: "evt_checkout_" + Math.random(),
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_buyer", plan: "node" },
          customer: "cus_real",
          subscription: "sub_real",
        },
      },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);

    const upsert = dbCalls.find((c) => c.op === "insert.upsert");
    expect(upsert).toBeDefined();
    expect(upsert!.values.userId).toBe("user_buyer");
    expect(upsert!.values.plan).toBe("node");
    expect(upsert!.values.status).toBe("active");
    expect(upsert!.values.stripeCustomerId).toBe("cus_real");
    expect(upsert!.values.stripeSubscriptionId).toBe("sub_real");
    expect(upsert!.set.plan).toBe("node");
    expect(upsert!.set.status).toBe("active");
  });

  it("checkout.session.completed → defaults plan to 'node' when metadata.plan is missing", async () => {
    const body = buildEventBody({
      id: "evt_default_plan_" + Math.random(),
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_no_plan" },
          customer: "cus_x",
          subscription: "sub_x",
        },
      },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);

    const upsert = dbCalls.find((c) => c.op === "insert.upsert");
    expect(upsert!.values.plan).toBe("node");
  });

  it("checkout.session.completed → no DB write when userId metadata is missing (anonymous purchase)", async () => {
    const body = buildEventBody({
      id: "evt_anon_" + Math.random(),
      type: "checkout.session.completed",
      data: {
        object: { metadata: {}, customer: "cus_y", subscription: "sub_y" },
      },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);
    expect(dbCalls).toHaveLength(0);
  });

  it("checkout.session.completed → reads stripe ids from expanded objects (not [object Object])", async () => {
    // Stripe sometimes sends customer/subscription as expanded objects rather
    // than ID strings. The route must extract .id, never call .toString().
    const body = buildEventBody({
      id: "evt_expanded_" + Math.random(),
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_expanded", plan: "starter" },
          customer: { id: "cus_from_object" },
          subscription: { id: "sub_from_object" },
        },
      },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);

    const upsert = dbCalls.find((c) => c.op === "insert.upsert");
    expect(upsert!.values.stripeCustomerId).toBe("cus_from_object");
    expect(upsert!.values.stripeSubscriptionId).toBe("sub_from_object");
  });

  it("customer.subscription.updated (active) → marks subscription active", async () => {
    const body = buildEventBody({
      id: "evt_updated_active_" + Math.random(),
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_upd_a", status: "active" } },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);

    const update = dbCalls.find((c) => c.op === "update");
    expect(update!.set.status).toBe("active");
    expect(update!.set.updatedAt).toBeInstanceOf(Date);
  });

  it("customer.subscription.updated (past_due) → maps to past_due", async () => {
    const body = buildEventBody({
      id: "evt_updated_pd_" + Math.random(),
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_pd", status: "past_due" } },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    await POST(buildRequest(body, { "stripe-signature": sig }));

    const update = dbCalls.find((c) => c.op === "update");
    expect(update!.set.status).toBe("past_due");
  });

  it("customer.subscription.updated (canceled) → maps to inactive", async () => {
    const body = buildEventBody({
      id: "evt_updated_canc_" + Math.random(),
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_canc", status: "canceled" } },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    await POST(buildRequest(body, { "stripe-signature": sig }));

    const update = dbCalls.find((c) => c.op === "update");
    expect(update!.set.status).toBe("inactive");
  });

  it("customer.subscription.deleted → downgrades plan to 'free' and status to 'cancelled'", async () => {
    const body = buildEventBody({
      id: "evt_deleted_" + Math.random(),
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_deleted", status: "canceled" } },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);

    const update = dbCalls.find((c) => c.op === "update");
    expect(update!.set.plan).toBe("free");
    expect(update!.set.status).toBe("cancelled");
  });

  it("invoice.payment_failed → flags subscription as past_due", async () => {
    const body = buildEventBody({
      id: "evt_failed_" + Math.random(),
      type: "invoice.payment_failed",
      data: {
        object: { id: "in_failed", customer: "cus_failed_pay" },
      },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);

    const update = dbCalls.find((c) => c.op === "update");
    expect(update!.set.status).toBe("past_due");
  });

  it("subscription events without a customer id silently no-op (no crash)", async () => {
    const body = buildEventBody({
      id: "evt_no_customer_" + Math.random(),
      type: "customer.subscription.deleted",
      data: { object: { customer: null, status: "canceled" } },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);
    expect(dbCalls).toHaveLength(0);
  });

  it("unhandled event types return 200 received (no crash, no write)", async () => {
    const body = buildEventBody({
      id: "evt_unknown_" + Math.random(),
      type: "customer.created",
      data: { object: { id: "cus_new" } },
    });
    const sig = signStripePayload(
      body,
      WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    );

    const { POST } = await loadRoute();
    const res = await POST(buildRequest(body, { "stripe-signature": sig }));
    expect(res.status).toBe(200);
    expect(dbCalls).toHaveLength(0);
  });
});
