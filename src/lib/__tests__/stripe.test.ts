/**
 * Tests for src/lib/stripe.ts
 *
 * The contract that matters most: when STRIPE_SECRET_KEY is missing
 * (dev / self-hosted / preview deploys), every helper returns null
 * instead of crashing. The whole platform degrades gracefully.
 *
 * Happy-path tests are intentionally omitted: stripe.ts uses
 * `require("stripe")` (CommonJS) inside getStripe(), which bypasses
 * vi.mock("stripe", ...). Covering the success path requires either
 * a real Stripe sandbox key (integration test) or refactoring stripe.ts
 * to dependency-inject the constructor.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

async function freshModule() {
  vi.resetModules();
  return await import("@/lib/stripe");
}

describe("stripe.ts — graceful degradation when STRIPE_SECRET_KEY is missing", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
  });

  it("getStripe() returns null", async () => {
    const { getStripe } = await freshModule();
    expect(getStripe()).toBeNull();
  });

  it("createCheckoutSession returns null without throwing", async () => {
    const { createCheckoutSession } = await freshModule();
    const url = await createCheckoutSession({
      priceId: "price_x",
      customerEmail: "u@example.com",
      successUrl: "https://x/success",
      cancelUrl: "https://x/cancel",
    });
    expect(url).toBeNull();
  });

  it("createPortalSession returns null without throwing", async () => {
    const { createPortalSession } = await freshModule();
    expect(await createPortalSession("cus_123", "https://x/return")).toBeNull();
  });

  it("getSubscriptionStatus returns null without throwing", async () => {
    const { getSubscriptionStatus } = await freshModule();
    expect(await getSubscriptionStatus("cus_123")).toBeNull();
  });

  it("repeated getStripe() calls remain null and never crash", async () => {
    const { getStripe } = await freshModule();
    expect(getStripe()).toBeNull();
    expect(getStripe()).toBeNull();
    expect(getStripe()).toBeNull();
  });
});
