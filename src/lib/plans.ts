/**
 * SOVEREIGN MATRIX — Plan & Pricing Configuration (Single Source of Truth)
 *
 * ALL plan limits, pricing, rate limits, and upgrade paths are defined here.
 * No other file should hardcode plan values — import from this module instead.
 *
 * When changing plans:
 * 1. Update the PLANS record below
 * 2. Update Stripe prices in the dashboard if USD amounts change
 * 3. Update PayFast/Yoco amounts if ZAR changes
 * 4. Run `npm run build` to catch any type errors
 */

// ── Plan IDs ──

export type PlanId =
  | "free"
  | "starter"
  | "founder"
  | "array"
  | "node"
  | "enterprise";

/** Legacy plan names that may exist in the database or older code paths */
type LegacyPlanId = "pro" | "sniper" | "basic";

// ── Plan Definition ──

export interface PlanDefinition {
  /** Display name */
  name: string;
  /** Monthly agent run limit (Infinity for unlimited) */
  runsPerMonth: number;
  /** Daily API rate limit for /api/v1 proxy */
  apiRatePerDay: number;
  /** Daily demo/anonymous rate limit */
  demoRatePerDay: number;
  /** Hard daily AI-spend cap in USD cents. Once a user hits this in a
   *  single calendar day across all paid models, agent execution is
   *  blocked until midnight UTC. Free models (NIM, local Ollama,
   *  Cerebras) cost 0 and never count against this budget. Set to
   *  Infinity for unlimited spend. */
  dailyBudgetCents: number;
  /** Monthly price in USD cents (for MRR calculations) */
  priceUsdCents: number;
  /** Monthly price in ZAR cents (for PayFast/Yoco) */
  priceZarCents: number;
  /** Display price string (USD) */
  priceDisplayUsd: string;
  /** Display price string (ZAR) */
  priceDisplayZar: string;
  /** Stripe price env var key (null if not purchasable via Stripe) */
  stripePriceEnvKey: string | null;
  /** Whether this plan can be purchased by users */
  purchasable: boolean;
  /** Short description */
  description: string;
}

// ── The Canonical Plan Registry ──

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    name: "Free",
    runsPerMonth: 50,
    apiRatePerDay: 100,
    demoRatePerDay: 5,
    dailyBudgetCents: 50, // $0.50/day — should only ever hit free models
    priceUsdCents: 0,
    priceZarCents: 0,
    priceDisplayUsd: "$0/mo",
    priceDisplayZar: "R0/mo",
    stripePriceEnvKey: null,
    purchasable: false,
    description: "3 agents, 50 runs/month",
  },
  starter: {
    name: "Starter",
    runsPerMonth: 200,
    apiRatePerDay: 1_000,
    demoRatePerDay: 5,
    dailyBudgetCents: 200, // $2/day — covers ~200 cheap calls
    priceUsdCents: 1_900,
    priceZarCents: 34_900,
    priceDisplayUsd: "$19/mo",
    priceDisplayZar: "R349/mo",
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    purchasable: true,
    description: "5 agents, 200 runs/month, email support",
  },
  founder: {
    name: "Founder",
    runsPerMonth: 10_000,
    apiRatePerDay: Infinity,
    demoRatePerDay: 5,
    dailyBudgetCents: 5_000, // $50/day for founders — generous cap
    priceUsdCents: 0,
    priceZarCents: 0,
    priceDisplayUsd: "Free",
    priceDisplayZar: "Free",
    stripePriceEnvKey: null,
    purchasable: false,
    description: "Enterprise-level access for first 10 users",
  },
  array: {
    name: "Growth",
    runsPerMonth: 500,
    apiRatePerDay: 5_000,
    demoRatePerDay: 5,
    dailyBudgetCents: 1_000, // $10/day
    priceUsdCents: 4_900,
    priceZarCents: 499_700,
    priceDisplayUsd: "$49/mo",
    priceDisplayZar: "R4,997/mo",
    stripePriceEnvKey: "STRIPE_PRICE_ARRAY",
    purchasable: true,
    description: "10 agents, 500 runs/month",
  },
  node: {
    name: "Sovereign Node",
    runsPerMonth: 2_000,
    apiRatePerDay: 10_000,
    demoRatePerDay: 5,
    dailyBudgetCents: 5_000, // $50/day
    priceUsdCents: 19_900,
    priceZarCents: 999_700,
    priceDisplayUsd: "$199/mo",
    priceDisplayZar: "R9,997/mo",
    stripePriceEnvKey: "STRIPE_PRICE_NODE",
    purchasable: true,
    description: "Unlimited agents, 2,000 runs/month, local execution",
  },
  enterprise: {
    name: "Enterprise",
    runsPerMonth: 10_000,
    apiRatePerDay: Infinity,
    demoRatePerDay: 5,
    dailyBudgetCents: 25_000, // $250/day
    priceUsdCents: 49_900,
    priceZarCents: 4_999_700,
    priceDisplayUsd: "$499/mo",
    priceDisplayZar: "R49,997/mo",
    stripePriceEnvKey: "STRIPE_PRICE_ENTERPRISE",
    purchasable: true,
    description: "White-label, voice agents, video generation",
  },
};

// ── Upgrade Path ──

export const UPGRADE_PATH: Record<PlanId, PlanId | null> = {
  free: "starter",
  starter: "array",
  founder: null,
  array: "node",
  node: "enterprise",
  enterprise: null,
};

/** Maximum number of founder slots */
export const MAX_FOUNDERS = 10;

/** Bonus runs granted per referral */
export const REFERRAL_BONUS_RUNS = 50;

// ── Helper Functions ──

/** Map legacy plan names to canonical PlanId */
const LEGACY_MAP: Record<LegacyPlanId, PlanId> = {
  pro: "node",
  sniper: "free",
  basic: "free",
};

/**
 * Normalize any plan string to a valid PlanId.
 * Handles legacy names, null/undefined, and unknown values.
 */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (!raw) return "free";
  const lower = raw.toLowerCase().trim();
  if (lower in PLANS) return lower as PlanId;
  if (lower in LEGACY_MAP) return LEGACY_MAP[lower as LegacyPlanId];
  return "free";
}

/** Get the full plan definition. Safe for any input. */
export function getPlan(planId: string | null | undefined): PlanDefinition {
  return PLANS[normalizePlanId(planId)];
}

/** Get the monthly run limit for a plan. */
export function getPlanLimit(planId: string | null | undefined): number {
  return getPlan(planId).runsPerMonth;
}

/** Get the daily API rate limit for a plan. */
export function getApiRateLimit(planId: string | null | undefined): number {
  return getPlan(planId).apiRatePerDay;
}

/** Get MRR in USD dollars for a plan (for admin dashboard). */
export function getPlanMrrUsd(planId: string | null | undefined): number {
  return getPlan(planId).priceUsdCents / 100;
}

/** Get the Stripe price ID from env for a plan. Returns null if not purchasable. */
export function getStripePriceId(
  planId: string | null | undefined,
): string | null {
  const plan = getPlan(planId);
  if (!plan.stripePriceEnvKey) return null;
  return process.env[plan.stripePriceEnvKey] ?? null;
}

/** Check if a plan has unlimited runs. */
export function isUnlimited(planId: string | null | undefined): boolean {
  const limit = getPlanLimit(planId);
  return limit >= 10_000;
}

/** Get the next plan in the upgrade path, or null if at max. */
export function getNextPlan(
  planId: string | null | undefined,
): PlanDefinition | null {
  const id = normalizePlanId(planId);
  const nextId = UPGRADE_PATH[id];
  return nextId ? PLANS[nextId] : null;
}

/**
 * Build a map of planId → run limit (for backward compatibility).
 * Prefer using getPlanLimit() directly in new code.
 */
export const PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLANS).map(([id, plan]) => [id, plan.runsPerMonth]),
);

/**
 * Returns the public-facing plans for marketing surfaces (landing page,
 * SEO JSON-LD, FAQ blurbs). Excludes archived or invite-only tiers so
 * promotional copy can never advertise a plan that's not currently
 * purchasable. Order matches user-facing display.
 */
export function getMarketingPlans(): PlanDefinition[] {
  // Public-marketing surface (pricing page TIERS, JSON-LD Offer list,
  // root-layout FAQ answer). Three visible tiers: Free / Pro (array) /
  // Team (node). Enterprise is rendered as a separate "contact sales"
  // strip and intentionally excluded here so Google's rich-result
  // pricing table matches what visitors see.
  //
  // Legacy `starter` ($19) is kept purchasable in PLANS for existing
  // subscribers but not surfaced to new visitors.
  const order: PlanId[] = ["free", "array", "node"];
  return order
    .filter((id) => PLANS[id]?.purchasable || PLANS[id]?.priceUsdCents === 0)
    .map((id) => PLANS[id]);
}
