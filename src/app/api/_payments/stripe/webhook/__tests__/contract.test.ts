/**
 * Contract tests for /api/_payments/stripe/webhook (audit-2026-05).
 *
 * The audit flagged that the Stripe webhook (the only "money path" in
 * the codebase that handles real $-mutations) had zero direct tests.
 * These cases lock in the security properties without touching the real
 * Stripe API:
 *
 *   1. Returns 503 when STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are unset
 *   2. Returns 400 when stripe-signature header is missing
 *   3. Returns 400 when stripe.webhooks.constructEvent throws (bad sig)
 *   4. Returns 400 when the event is older than the 5-minute replay window
 *   5. Returns {duplicate: true} when alreadyProcessed() reports the eventId
 *      is already in the idempotency ledger
 *   6. Persists a subscription row on checkout.session.completed
 *
 * The handler is exercised directly via its POST export. Stripe's SDK
 * and the db/idempotency modules are mocked so the test is hermetic
 * (no network, no DB).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────

// We control what stripe.webhooks.constructEvent does per-test via this
// shared reference. Default: throw on bad signature (vendor behavior).
const mockConstructEvent = vi.fn();
vi.mock("stripe", () => {
  // Must be a real constructor (the route calls `new Stripe(key)`).
  // vi.fn() returns an arrow function which can't be `new`'d.
  class Stripe {
    webhooks = { constructEvent: mockConstructEvent };
    constructor(_key: string) {
      // Key arg ignored — we don't make real Stripe calls in tests.
    }
  }
  return { default: Stripe };
});

// Capture every subscription insert/update — assert on them.
const insertValues = vi.fn();
const onConflict = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const mockDb = {
  insert: vi.fn(() => ({
    values: (v: unknown) => {
      insertValues(v);
      return { onConflictDoUpdate: (cfg: unknown) => onConflict(cfg) };
    },
  })),
  update: vi.fn(() => ({
    set: (s: unknown) => {
      updateSet(s);
      return { where: (w: unknown) => updateWhere(w) };
    },
  })),
  query: { settings: { findFirst: vi.fn() } },
};
vi.mock("@/db", () => ({ db: mockDb }));
vi.mock("@/db/schema", () => ({
  subscriptions: {
    userId: "userId-col",
    stripeCustomerId: "stripeCustomerId-col",
  },
}));

// Default: treat every eventId as unseen. Individual tests flip this.
const mockAlreadyProcessed = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/idempotency", () => ({
  alreadyProcessed: mockAlreadyProcessed,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// drizzle-orm's eq() is a no-op for our mocked db; just record args.
vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
}));

// ── Helpers ───────────────────────────────────────────────────────────

interface MakeReqOpts {
  signature?: string | null;
  body?: string;
}

function makeReq({
  signature = "t=1,v1=abc",
  body = "{}",
}: MakeReqOpts = {}): Request {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return new Request("http://localhost/api/_payments/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

function setEnv(): void {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAlreadyProcessed.mockResolvedValue(false);
  // No resetModules here — the route reads env at runtime, and the
  // hoisted vi.mock("stripe") factory only runs once. Resetting the
  // module cache would also reset the Stripe constructor mock and break
  // `new Stripe(key)` in subsequent tests.
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("Stripe webhook contract", () => {
  it("returns 503 when STRIPE_SECRET_KEY is unset", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_x";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    setEnv();
    const { POST } = await import("../route");
    const res = await POST(makeReq({ signature: null }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("returns 400 when signature verification throws (forged signature)", async () => {
    setEnv();
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("returns 400 when the event is older than the 5-minute replay window", async () => {
    setEnv();
    const tenMinAgo = Math.floor(Date.now() / 1000) - 10 * 60;
    mockConstructEvent.mockReturnValue({
      id: "evt_stale",
      type: "checkout.session.completed",
      created: tenMinAgo,
      data: { object: {} },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Stale event");
  });

  it("returns {duplicate: true} when alreadyProcessed reports the event id was seen", async () => {
    setEnv();
    mockConstructEvent.mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: { object: { metadata: { userId: "u1", plan: "node" } } },
    });
    mockAlreadyProcessed.mockResolvedValueOnce(true);
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, duplicate: true });
    // Critical: a duplicate must NOT have written a subscription row.
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("persists a subscription row on checkout.session.completed", async () => {
    setEnv();
    mockConstructEvent.mockReturnValue({
      id: "evt_ok",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          metadata: { userId: "u1", plan: "node" },
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        plan: "node",
        status: "active",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      }),
    );
  });

  it("flips status to past_due on invoice.payment_failed", async () => {
    setEnv();
    mockConstructEvent.mockReturnValue({
      id: "evt_fail",
      type: "invoice.payment_failed",
      created: Math.floor(Date.now() / 1000),
      data: { object: { customer: "cus_2", id: "in_1" } },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "past_due" }),
    );
  });

  it("downgrades the plan to free on customer.subscription.deleted", async () => {
    setEnv();
    mockConstructEvent.mockReturnValue({
      id: "evt_del",
      type: "customer.subscription.deleted",
      created: Math.floor(Date.now() / 1000),
      data: { object: { customer: "cus_3" } },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "cancelled" }),
    );
  });
});
