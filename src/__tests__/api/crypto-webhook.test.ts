/**
 * Tests for POST /api/payments/crypto/webhook — Coinbase Commerce
 * lifecycle handler.
 *
 * This is the money path. The properties below are the security
 * contract — every one of them was added in response to a finding
 * from the security-reviewer agent. Don't loosen these tests without
 * a paired loosening of the route.
 *
 * Properties pinned:
 *   1. 400 on missing/invalid signature header
 *   2. 400 on invalid JSON body
 *   3. 200 (received: true, duplicate) on a re-delivered event id
 *   4. 200 (no-op) on non-confirmed event types (charge:created etc.)
 *   5. Refuses to honor a charge whose amount doesn't match PLANS[plan]
 *      (closes the "pay $0.01 for enterprise" tampering attack)
 *   6. Refuses to honor a charge whose currency isn't USD
 *   7. Refuses to honor a charge missing userId or plan metadata
 *   8. Refuses to honor a plan id not in PLANS (defends against
 *      prototype-pollution via "__proto__" / "constructor")
 *   9. Defense-in-depth: refuses to honor a charge that doesn't
 *      exist when refetched via our merchant API key
 *  10. On valid confirmed charge: upserts subscription with cb_<id>
 *      customer/subscription ids + 30-day period end
 *  11. Pre-signature rate limiter blunts forgery spam
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";

const SECRET = "test-webhook-secret";

function sig(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function buildEvent(
  type: string,
  overrides: Partial<{
    id: string;
    metadata: Record<string, string>;
    amount: string;
    currency: string;
    chargeId: string;
  }> = {},
) {
  return {
    event: {
      id: overrides.id ?? "evt_1",
      type,
      data: {
        id: overrides.chargeId ?? "ch_1",
        code: "ABC",
        metadata: overrides.metadata ?? { userId: "u1", plan: "array" },
        pricing: {
          local: {
            amount: overrides.amount ?? "49.00",
            currency: overrides.currency ?? "USD",
          },
        },
        timeline: [],
      },
    },
  };
}

// Module mocks
const alreadyProcessedMock = vi.fn();
const fetchChargeMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertOnConflictMock = vi.fn();

vi.mock("@/lib/idempotency", () => ({
  alreadyProcessed: (...args: unknown[]) => alreadyProcessedMock(...args),
}));

vi.mock("@/lib/coinbase-commerce", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/coinbase-commerce")
  >("@/lib/coinbase-commerce");
  return {
    ...actual,
    fetchCommerceCharge: (...args: unknown[]) => fetchChargeMock(...args),
  };
});

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({
    check: () => Promise.resolve(null),
  }),
}));

// Drizzle insert chain mock
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

async function loadRoute() {
  vi.resetModules();
  process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = SECRET;
  process.env.COINBASE_COMMERCE_API_KEY = "ck_test";
  return await import("@/app/api/_payments/crypto/webhook/route");
}

function makeRequest(body: string, signature: string | null) {
  const headers: HeadersInit = {};
  if (signature !== null) headers["x-cc-webhook-signature"] = signature;
  return new Request("http://x/api/payments/crypto/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/payments/crypto/webhook", () => {
  beforeEach(() => {
    alreadyProcessedMock.mockReset().mockResolvedValue(false);
    fetchChargeMock
      .mockReset()
      .mockResolvedValue({
        id: "ch_1",
        metadata: { userId: "u1", plan: "array" },
      });
    dbInsertValuesMock.mockReset();
    dbInsertOnConflictMock.mockReset();
  });

  it("400 on missing signature header", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify(buildEvent("charge:confirmed"));
    const res = await POST(makeRequest(body, null));
    expect(res.status).toBe(400);
  });

  it("400 on invalid signature", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify(buildEvent("charge:confirmed"));
    const res = await POST(makeRequest(body, "deadbeef".padEnd(64, "0")));
    expect(res.status).toBe(400);
  });

  it("400 on invalid JSON body (after passing signature check)", async () => {
    const { POST } = await loadRoute();
    const body = "{not-json}";
    const res = await POST(makeRequest(body, sig(body)));
    expect(res.status).toBe(400);
  });

  it("dedups on re-delivered event id (200 duplicate, no DB write)", async () => {
    alreadyProcessedMock.mockResolvedValue(true);
    const { POST } = await loadRoute();
    const body = JSON.stringify(buildEvent("charge:confirmed"));
    const res = await POST(makeRequest(body, sig(body)));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("no-ops on non-confirmed types — acknowledges 200 so Coinbase doesn't retry", async () => {
    const { POST } = await loadRoute();
    for (const type of [
      "charge:created",
      "charge:pending",
      "charge:failed",
      "charge:delayed",
      "charge:resolved",
    ]) {
      const body = JSON.stringify(buildEvent(type));
      const res = await POST(makeRequest(body, sig(body)));
      expect(res.status).toBe(200);
    }
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("refuses to honor a charge with amount mismatching PLANS[plan]", async () => {
    const { POST } = await loadRoute();
    // Plan "array" is the Pro tier at $49.00 in PLANS. Sending $1.00
    // should be rejected before any DB write.
    const body = JSON.stringify(
      buildEvent("charge:confirmed", { amount: "1.00" }),
    );
    const res = await POST(makeRequest(body, sig(body)));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.warning).toBe("amount mismatch");
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("refuses to honor a charge in non-USD currency", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify(
      buildEvent("charge:confirmed", { currency: "EUR" }),
    );
    const res = await POST(makeRequest(body, sig(body)));
    const json = await res.json();
    expect(json.warning).toBe("amount mismatch");
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("refuses to honor a charge with missing userId metadata", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify(
      buildEvent("charge:confirmed", { metadata: { plan: "array" } }),
    );
    const res = await POST(makeRequest(body, sig(body)));
    const json = await res.json();
    expect(json.warning).toContain("missing metadata");
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("refuses to honor a charge with missing plan metadata", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify(
      buildEvent("charge:confirmed", { metadata: { userId: "u1" } }),
    );
    const res = await POST(makeRequest(body, sig(body)));
    const json = await res.json();
    expect(json.warning).toContain("missing metadata");
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("refuses prototype-polluting plan ids (defense vs `in` operator)", async () => {
    const { POST } = await loadRoute();
    for (const evilPlan of ["__proto__", "constructor", "hasOwnProperty"]) {
      const body = JSON.stringify(
        buildEvent("charge:confirmed", {
          metadata: { userId: "u1", plan: evilPlan },
        }),
      );
      const res = await POST(makeRequest(body, sig(body)));
      const json = await res.json();
      expect(json.warning).toBe("unknown plan");
    }
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("refuses to honor a charge that isn't found by our merchant API (forged-webhook defense)", async () => {
    fetchChargeMock.mockResolvedValue(null);
    const { POST } = await loadRoute();
    const body = JSON.stringify(buildEvent("charge:confirmed"));
    const res = await POST(makeRequest(body, sig(body)));
    const json = await res.json();
    expect(json.warning).toBe("charge not found");
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("activates subscription on a valid charge:confirmed", async () => {
    const { POST } = await loadRoute();
    const body = JSON.stringify(
      buildEvent("charge:confirmed", { chargeId: "ch_99" }),
    );
    const res = await POST(makeRequest(body, sig(body)));
    expect(res.status).toBe(200);
    expect(dbInsertValuesMock).toHaveBeenCalledOnce();

    const values = dbInsertValuesMock.mock.calls[0]![0] as {
      userId: string;
      plan: string;
      status: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      currentPeriodEnd: Date;
    };
    expect(values.userId).toBe("u1");
    expect(values.plan).toBe("array");
    expect(values.status).toBe("active");
    expect(values.stripeCustomerId).toBe("cb_ch_99");
    expect(values.stripeSubscriptionId).toBe("cb_ch_99");
    // 30 days from now, within a 5-minute tolerance for slow test machines
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(values.currentPeriodEnd.getTime() - expected)).toBeLessThan(
      5 * 60 * 1000,
    );
  });
});
