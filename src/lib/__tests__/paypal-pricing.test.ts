/**
 * Tests for src/lib/paypal-pricing.ts — the authoritative server-side price
 * resolution that stops a tampered checkout body from naming its own amount.
 */

import { describe, it, expect } from "vitest";
import { resolveOrderPricing } from "../paypal-pricing";
import { PLANS } from "../plans";

describe("resolveOrderPricing", () => {
  it("prices a purchasable plan from the canonical catalog", () => {
    const pricing = resolveOrderPricing("plan", "node");
    expect(pricing).not.toBeNull();
    expect(pricing?.amountUsd).toBe(PLANS.node.priceUsdCents / 100);
    expect(pricing?.description).toContain(PLANS.node.name);
  });

  it("refuses the free plan (not purchasable)", () => {
    expect(resolveOrderPricing("plan", "free")).toBeNull();
  });

  it("refuses an unknown plan id (normalizes to free → not purchasable)", () => {
    expect(resolveOrderPricing("plan", "definitely-not-a-plan")).toBeNull();
  });

  it("refuses unknown add-on / starter-pack skus", () => {
    expect(resolveOrderPricing("addon", "nope")).toBeNull();
    expect(resolveOrderPricing("starter-pack", "nope")).toBeNull();
  });
});
