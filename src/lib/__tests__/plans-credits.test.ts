import { describe, it, expect } from "vitest";
import { PLANS, getPlan } from "@/lib/plans";

describe("plan credit allocation (phase 1 Revenue Engine)", () => {
  it("every plan has monthlyCreditsCents as a non-negative number", () => {
    for (const [id, plan] of Object.entries(PLANS)) {
      expect(plan.monthlyCreditsCents, `plan ${id}`).toBeTypeOf("number");
      expect(plan.monthlyCreditsCents, `plan ${id}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("higher-priced plans grant strictly more credits than cheaper ones", () => {
    // Free (0) → Growth (array) → Node → Enterprise
    const free = PLANS.free.monthlyCreditsCents;
    const growth = PLANS.array.monthlyCreditsCents;
    const node = PLANS.node.monthlyCreditsCents;
    const enterprise = PLANS.enterprise.monthlyCreditsCents;
    expect(growth).toBeGreaterThan(free);
    expect(node).toBeGreaterThan(growth);
    expect(enterprise).toBeGreaterThanOrEqual(node);
  });

  it("pay_per_run plan exists, is purchasable, grants zero monthly credits", () => {
    const ppr = getPlan("pay_per_run");
    expect(ppr.purchasable).toBe(true);
    expect(ppr.monthlyCreditsCents).toBe(0);
    expect(ppr.priceUsdCents).toBe(0); // no monthly fee — pay as you go
  });

  it("founder plan grants generous credits (internal tier)", () => {
    expect(PLANS.founder.monthlyCreditsCents).toBeGreaterThanOrEqual(10_000);
  });
});
