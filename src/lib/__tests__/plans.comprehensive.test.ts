/**
 * Comprehensive plan & pricing tests — covers edge cases
 */
import { describe, it, expect } from "vitest";
import { PLANS, normalizePlanId, getPlan, getPlanLimit, getApiRateLimit, getPlanMrrUsd, isUnlimited, getNextPlan, UPGRADE_PATH, PLAN_LIMITS } from "@/lib/plans";

describe("plans.ts — Comprehensive Edge Cases", () => {
  // ── Pricing Integrity ──

  it("no plan has negative price", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.priceUsdCents).toBeGreaterThanOrEqual(0);
      expect(plan.priceZarCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("ZAR price is always higher than USD price", () => {
    for (const plan of Object.values(PLANS)) {
      if (plan.priceUsdCents > 0) {
        expect(plan.priceZarCents).toBeGreaterThan(plan.priceUsdCents);
      }
    }
  });

  it("API rate limits increase with plan tier", () => {
    expect(getApiRateLimit("free")).toBeLessThan(getApiRateLimit("starter"));
    expect(getApiRateLimit("starter")).toBeLessThanOrEqual(getApiRateLimit("array"));
    expect(getApiRateLimit("array")).toBeLessThanOrEqual(getApiRateLimit("node"));
  });

  it("run limits increase with plan tier", () => {
    expect(getPlanLimit("free")).toBeLessThan(getPlanLimit("starter"));
    expect(getPlanLimit("starter")).toBeLessThan(getPlanLimit("array"));
    expect(getPlanLimit("array")).toBeLessThan(getPlanLimit("node"));
  });

  // ── Normalization Stress Tests ──

  it("handles whitespace in plan names", () => {
    expect(normalizePlanId("  free  ")).toBe("free");
    expect(normalizePlanId(" NODE ")).toBe("node");
  });

  it("handles mixed case", () => {
    expect(normalizePlanId("FrEe")).toBe("free");
    expect(normalizePlanId("ENTERPRISE")).toBe("enterprise");
    expect(normalizePlanId("Starter")).toBe("starter");
  });

  it("handles all legacy names", () => {
    expect(normalizePlanId("pro")).toBe("node");
    expect(normalizePlanId("sniper")).toBe("free");
    expect(normalizePlanId("basic")).toBe("free");
  });

  // ── Upgrade Path Completeness ──

  it("upgrade path has no cycles", () => {
    const visited = new Set<string>();
    for (const start of Object.keys(PLANS)) {
      visited.clear();
      let current: string | null = start;
      while (current && !visited.has(current)) {
        visited.add(current);
        current = UPGRADE_PATH[current as keyof typeof UPGRADE_PATH] ?? null;
      }
      // If we exited the loop because current is in visited, there's a cycle
      if (current && visited.has(current)) {
        expect.fail(`Cycle detected starting from ${start}`);
      }
    }
  });

  it("upgrade targets are valid plan IDs", () => {
    for (const [from, to] of Object.entries(UPGRADE_PATH)) {
      if (to !== null) {
        expect(PLANS[to as keyof typeof PLANS], `${from} → ${to} is invalid`).toBeDefined();
      }
    }
  });

  // ── MRR Calculations ──

  it("MRR calculations match cents/100", () => {
    for (const [id, plan] of Object.entries(PLANS)) {
      expect(getPlanMrrUsd(id)).toBe(plan.priceUsdCents / 100);
    }
  });

  it("total MRR for 100 starter users", () => {
    expect(getPlanMrrUsd("starter") * 100).toBe(1900);
  });

  // ── PLAN_LIMITS Backward Compat ──

  it("PLAN_LIMITS includes starter", () => {
    expect(PLAN_LIMITS.starter).toBe(200);
  });

  it("PLAN_LIMITS includes all plans", () => {
    for (const id of Object.keys(PLANS)) {
      expect(PLAN_LIMITS[id]).toBeDefined();
    }
  });

  // ── Display Strings ──

  it("all plans have display price strings", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.priceDisplayUsd.length).toBeGreaterThan(0);
      expect(plan.priceDisplayZar.length).toBeGreaterThan(0);
    }
  });

  it("all plans have descriptions", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.description.length).toBeGreaterThan(5);
    }
  });

  // ── Stripe Config ──

  it("purchasable subscription plans have Stripe env keys", () => {
    // pay_per_run is purchasable but uses one-time Stripe charges
    // (not a recurring price) — so its stripePriceEnvKey is null.
    // Everything else that's purchasable must have a recurring price.
    for (const [id, plan] of Object.entries(PLANS)) {
      if (plan.purchasable && id !== "pay_per_run") {
        expect(plan.stripePriceEnvKey, `plan ${id}`).toBeTruthy();
      }
    }
  });

  it("non-purchasable plans have no Stripe key", () => {
    expect(PLANS.free.stripePriceEnvKey).toBeNull();
    expect(PLANS.founder.stripePriceEnvKey).toBeNull();
  });

  it("pay_per_run uses one-time charges (null stripePriceEnvKey)", () => {
    expect(PLANS.pay_per_run.stripePriceEnvKey).toBeNull();
    expect(PLANS.pay_per_run.purchasable).toBe(true);
  });
});
