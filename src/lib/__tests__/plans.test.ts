/**
 * Tests for src/lib/plans.ts — Plan & Pricing Configuration
 */
import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_LIMITS,
  UPGRADE_PATH,
  MAX_FOUNDERS,
  REFERRAL_BONUS_RUNS,
  normalizePlanId,
  getPlan,
  getPlanLimit,
  getApiRateLimit,
  getPlanMrrUsd,
  isUnlimited,
  getNextPlan,
  getStripePriceId as _getStripePriceId,
  type PlanId,
} from "@/lib/plans";

describe("plans.ts — Single Source of Truth", () => {
  // ── Plan Registry ──

  it("defines all 6 plan tiers", () => {
    const ids: PlanId[] = [
      "free",
      "starter",
      "founder",
      "array",
      "node",
      "enterprise",
    ];
    for (const id of ids) {
      expect(PLANS[id]).toBeDefined();
      expect(PLANS[id].name).toBeTruthy();
      expect(PLANS[id].runsPerMonth).toBeGreaterThanOrEqual(0);
    }
  });

  it("pricing is consistent (starter < array < node < enterprise)", () => {
    expect(PLANS.starter.priceUsdCents).toBeLessThan(PLANS.array.priceUsdCents);
    expect(PLANS.array.priceUsdCents).toBeLessThan(PLANS.node.priceUsdCents);
    expect(PLANS.node.priceUsdCents).toBeLessThan(
      PLANS.enterprise.priceUsdCents,
    );
  });

  it("run limits are consistent (free < starter < array < node <= enterprise)", () => {
    expect(PLANS.free.runsPerMonth).toBeLessThan(PLANS.starter.runsPerMonth);
    expect(PLANS.starter.runsPerMonth).toBeLessThan(PLANS.array.runsPerMonth);
    expect(PLANS.array.runsPerMonth).toBeLessThan(PLANS.node.runsPerMonth);
    expect(PLANS.node.runsPerMonth).toBeLessThanOrEqual(
      PLANS.enterprise.runsPerMonth,
    );
  });

  it("starter tier is $19/mo", () => {
    expect(PLANS.starter.priceUsdCents).toBe(1_900);
    expect(PLANS.starter.priceDisplayUsd).toBe("$19/mo");
  });

  it("free and founder tiers are not purchasable", () => {
    expect(PLANS.free.purchasable).toBe(false);
    expect(PLANS.founder.purchasable).toBe(false);
  });

  it("paid tiers have Stripe price env keys", () => {
    expect(PLANS.starter.stripePriceEnvKey).toBe("STRIPE_PRICE_STARTER");
    expect(PLANS.array.stripePriceEnvKey).toBe("STRIPE_PRICE_ARRAY");
    expect(PLANS.node.stripePriceEnvKey).toBe("STRIPE_PRICE_NODE");
    expect(PLANS.enterprise.stripePriceEnvKey).toBe("STRIPE_PRICE_ENTERPRISE");
  });

  // ── normalizePlanId ──

  it("normalizes valid plan IDs", () => {
    expect(normalizePlanId("free")).toBe("free");
    expect(normalizePlanId("starter")).toBe("starter");
    expect(normalizePlanId("node")).toBe("node");
    expect(normalizePlanId("enterprise")).toBe("enterprise");
  });

  it("normalizes legacy plan names", () => {
    expect(normalizePlanId("pro")).toBe("node");
    expect(normalizePlanId("sniper")).toBe("free");
    expect(normalizePlanId("basic")).toBe("free");
  });

  it("normalizes null/undefined/empty to free", () => {
    expect(normalizePlanId(null)).toBe("free");
    expect(normalizePlanId(undefined)).toBe("free");
    expect(normalizePlanId("")).toBe("free");
  });

  it("normalizes unknown strings to free", () => {
    expect(normalizePlanId("gold")).toBe("free");
    expect(normalizePlanId("premium")).toBe("free");
  });

  it("is case-insensitive", () => {
    expect(normalizePlanId("FREE")).toBe("free");
    expect(normalizePlanId("Node")).toBe("node");
    expect(normalizePlanId("ENTERPRISE")).toBe("enterprise");
  });

  // ── getPlan ──

  it("returns full plan definition", () => {
    const plan = getPlan("node");
    expect(plan.name).toBe("Sovereign Node");
    expect(plan.runsPerMonth).toBe(2_000);
    expect(plan.priceUsdCents).toBe(19_900);
  });

  it("returns free plan for invalid input", () => {
    expect(getPlan("garbage").name).toBe("Free");
    expect(getPlan(null).runsPerMonth).toBe(50);
  });

  // ── getPlanLimit ──

  it("returns correct limits", () => {
    expect(getPlanLimit("free")).toBe(50);
    expect(getPlanLimit("starter")).toBe(200);
    expect(getPlanLimit("array")).toBe(500);
    expect(getPlanLimit("node")).toBe(2_000);
    expect(getPlanLimit("enterprise")).toBe(10_000);
    expect(getPlanLimit("founder")).toBe(10_000);
  });

  // ── getApiRateLimit ──

  it("returns API rate limits per day", () => {
    expect(getApiRateLimit("free")).toBe(100);
    expect(getApiRateLimit("starter")).toBe(1_000);
    expect(getApiRateLimit("enterprise")).toBe(Infinity);
  });

  // ── getPlanMrrUsd ──

  it("returns MRR in USD dollars", () => {
    expect(getPlanMrrUsd("free")).toBe(0);
    expect(getPlanMrrUsd("starter")).toBe(19);
    expect(getPlanMrrUsd("array")).toBe(49);
    expect(getPlanMrrUsd("node")).toBe(199);
    expect(getPlanMrrUsd("enterprise")).toBe(499);
  });

  // ── isUnlimited ──

  it("identifies unlimited plans", () => {
    expect(isUnlimited("enterprise")).toBe(true);
    expect(isUnlimited("founder")).toBe(true);
    expect(isUnlimited("free")).toBe(false);
    expect(isUnlimited("starter")).toBe(false);
    expect(isUnlimited("node")).toBe(false);
  });

  // ── getNextPlan ──

  it("returns correct upgrade path", () => {
    expect(getNextPlan("free")?.name).toBe("Starter");
    expect(getNextPlan("starter")?.name).toBe("Growth");
    expect(getNextPlan("array")?.name).toBe("Sovereign Node");
    expect(getNextPlan("node")?.name).toBe("Enterprise");
    // Enterprise now upgrades to the contract-tier Sovereign plan
    // (audit-2026-05 — added per the enterprise unlock lever set).
    expect(getNextPlan("enterprise")?.name).toBe("Sovereign");
    expect(getNextPlan("sovereign")).toBeNull();
    expect(getNextPlan("founder")).toBeNull();
  });

  // ── PLAN_LIMITS backward compat ──

  it("PLAN_LIMITS map matches PLANS", () => {
    for (const [id, limit] of Object.entries(PLAN_LIMITS)) {
      expect(limit).toBe(PLANS[id as PlanId].runsPerMonth);
    }
  });

  // ── Constants ──

  it("MAX_FOUNDERS is 10", () => {
    expect(MAX_FOUNDERS).toBe(10);
  });

  it("REFERRAL_BONUS_RUNS is 50", () => {
    expect(REFERRAL_BONUS_RUNS).toBe(50);
  });

  // ── UPGRADE_PATH completeness ──

  it("every plan has an upgrade path entry", () => {
    for (const id of Object.keys(PLANS) as PlanId[]) {
      expect(UPGRADE_PATH[id]).toBeDefined();
    }
  });
});

// ── Enterprise flag levers (audit-2026-05) ──

describe("enterprise flag levers", () => {
  it("free/starter/array/node have SAML off by default", async () => {
    const { hasSamlSso } = await import("@/lib/plans");
    expect(hasSamlSso("free")).toBe(false);
    expect(hasSamlSso("starter")).toBe(false);
    expect(hasSamlSso("array")).toBe(false);
    expect(hasSamlSso("node")).toBe(false);
  });

  /**
   * Enforcement guard, not an identity assertion. SAML has no implementation
   * in this codebase — no Clerk Organizations usage, no WorkOS dependency —
   * so no plan may advertise it. If you wire the auth path, flip the flag in
   * the same change and this test is what tells you to.
   */
  it("no plan claims SAML while nothing implements it", async () => {
    const { PLANS, hasSamlSso } = await import("@/lib/plans");
    const claiming = (Object.keys(PLANS) as Array<keyof typeof PLANS>).filter(
      (id) => hasSamlSso(id),
    );
    expect(claiming).toEqual([]);
  });

  /**
   * dataResidency and dedicatedRegion were removed in wave 122: there is no
   * region column across the schema, one DATABASE_URL and one Neon region, so
   * neither flag could ever have gated anything. Re-adding either without the
   * substrate puts a claim back on the pricing surface that nothing enforces.
   */
  it("does not carry plan levers with no substrate", async () => {
    const { PLANS } = await import("@/lib/plans");
    for (const plan of Object.values(PLANS)) {
      expect(plan.enterprise).not.toHaveProperty("dataResidency");
      expect(plan.enterprise).not.toHaveProperty("dedicatedRegion");
    }
  });

  it("BYOK is sovereign-only", async () => {
    const { getEnterpriseFlag } = await import("@/lib/plans");
    expect(getEnterpriseFlag("enterprise", "byok")).toBe(false);
    expect(getEnterpriseFlag("sovereign", "byok")).toBe(true);
  });

  // dataResidency / dedicatedRegion were removed: there is no region
  // column across the schema, one DATABASE_URL, one Neon region and no
  // per-tenant deployment, so neither flag could ever have gated
  // anything. A flag with no substrate is copy, not an entitlement.
  it("carries no flag the platform cannot honour", async () => {
    const { PLANS } = await import("@/lib/plans");
    const keys = Object.keys(PLANS.sovereign.enterprise);
    expect(keys).not.toContain("dataResidency");
    expect(keys).not.toContain("dedicatedRegion");
  });

  it("SLA uptime renders as percentage strings", async () => {
    const { slaUptimePercent } = await import("@/lib/plans");
    expect(slaUptimePercent("free")).toBeNull();
    expect(slaUptimePercent("enterprise")).toBe("99.95%");
    expect(slaUptimePercent("sovereign")).toBe("99.99%");
  });

  /**
   * /sla is rendered from this registry and has published "99.9% monthly
   * uptime for all paid plans". Dropping a paid tier's commitment here
   * silently withdraws a promise already made to people who are paying,
   * so every purchasable tier must carry one.
   */
  it("every paid plan carries the uptime commitment /sla publishes", async () => {
    const { PLANS, slaUptimePercent } = await import("@/lib/plans");
    const uncommitted = (Object.keys(PLANS) as Array<keyof typeof PLANS>)
      .filter((id) => PLANS[id].priceUsdCents > 0)
      .filter((id) => slaUptimePercent(id) === null);
    expect(uncommitted).toEqual([]);
    expect(slaUptimePercent("free")).toBeNull();
  });

  it("sovereign is never purchasable via self-serve checkout", async () => {
    const { getPlan } = await import("@/lib/plans");
    expect(getPlan("sovereign").purchasable).toBe(false);
    expect(getPlan("sovereign").stripePriceEnvKey).toBeNull();
  });
});

// ── Untrusted plan writes + entitlement lookup ──

describe("normalizePurchasablePlanId", () => {
  it("accepts the self-serve tiers", async () => {
    const { normalizePurchasablePlanId } = await import("@/lib/plans");
    expect(normalizePurchasablePlanId("starter")).toBe("starter");
    expect(normalizePurchasablePlanId("array")).toBe("array");
    expect(normalizePurchasablePlanId("node")).toBe("node");
    expect(normalizePurchasablePlanId("enterprise")).toBe("enterprise");
  });

  it("rejects tiers checkout can never sell", async () => {
    const { normalizePurchasablePlanId } = await import("@/lib/plans");
    // "sovereign" is contract-only and "founder" comes from the
    // allowlist — neither may arrive from Stripe session metadata.
    expect(normalizePurchasablePlanId("sovereign")).toBeNull();
    expect(normalizePurchasablePlanId("founder")).toBeNull();
    expect(normalizePurchasablePlanId("free")).toBeNull();
  });

  it("rejects garbage and prototype keys instead of defaulting to a tier", async () => {
    const { normalizePurchasablePlanId } = await import("@/lib/plans");
    expect(normalizePurchasablePlanId("gold")).toBeNull();
    expect(normalizePurchasablePlanId("__proto__")).toBeNull();
    expect(normalizePurchasablePlanId(null)).toBeNull();
    expect(normalizePurchasablePlanId(undefined)).toBeNull();
  });
});

describe("cheapestPlanWith", () => {
  it("resolves the cheapest purchasable tier carrying a flag", async () => {
    const { cheapestPlanWith } = await import("@/lib/plans");
    // node ($199) is the first purchasable tier with audit export;
    // white-label starts at enterprise ($499).
    expect(cheapestPlanWith("auditLogExport")).toBe("node");
    expect(cheapestPlanWith("whiteLabel")).toBe("enterprise");
  });

  it("returns null for a flag no purchasable tier carries", async () => {
    const { cheapestPlanWith } = await import("@/lib/plans");
    expect(cheapestPlanWith("byok")).toBeNull();
  });
});

describe("enterprise plan copy matches what is enforced", () => {
  it("does not advertise SAML SSO", async () => {
    const { PLANS } = await import("@/lib/plans");
    // No Clerk Organizations, no WorkOS dependency — nothing in this
    // codebase implements SAML, so the marketing string must not claim it.
    expect(PLANS.enterprise.description).not.toMatch(/SAML/i);
  });

  it("advertises only enforced levers", async () => {
    const { PLANS } = await import("@/lib/plans");
    expect(PLANS.enterprise.description).toMatch(/Audit log export/i);
    expect(PLANS.enterprise.description).toMatch(/white-label/i);
    expect(PLANS.enterprise.description).not.toMatch(/SLA/i);
    expect(PLANS.enterprise.description).not.toMatch(/CSM/i);
  });
});
