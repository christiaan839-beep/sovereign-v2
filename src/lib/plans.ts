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

export type PlanId = "free" | "starter" | "founder" | "array" | "node" | "enterprise";

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
  /** Monthly price in USD cents (for MRR calculations) */
  priceUsdCents: number;
  /** Monthly price in ZAR cents (for PayFast/Yoco) */
  priceZarCents: number;
  /** Display price string (USD) */
  priceDisplayUsd: string;
  /** Display price string (ZAR) */
  priceDisplayZar: string;
  /**
   * Whether this plan shows on the public /pricing page. Existing
   * subscribers on archived tiers keep their plan; only NEW signups
   * are gated to marketing-visible tiers. This lets us consolidate
   * the funnel without forcing migrations on current customers.
   *
   * Default: true (legacy plans we haven't marked).
   */
  marketing?: boolean;
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
    priceUsdCents: 0,
    priceZarCents: 0,
    priceDisplayUsd: "$0/mo",
    priceDisplayZar: "R0/mo",
    stripePriceEnvKey: null,
    purchasable: false,
    marketing: true,
    description: "50 runs/month. No credit card. Full platform access.",
  },
  // ARCHIVED: Starter $19 was a commitment-avoidance tier that
  // cannibalized Growth conversions. Existing subscribers keep it;
  // new signups are not shown this tier. See plans rationale in
  // CLAUDE.md.
  starter: {
    name: "Starter",
    runsPerMonth: 200,
    apiRatePerDay: 1_000,
    demoRatePerDay: 5,
    priceUsdCents: 1_900,
    priceZarCents: 34_900,
    priceDisplayUsd: "$19/mo",
    priceDisplayZar: "R349/mo",
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    purchasable: true,
    marketing: false, // archived — legacy subscribers only
    description: "5 agents, 200 runs/month, email support",
  },
  // FOUNDER: free enterprise-tier for first-10 cohort; internal only,
  // never shown on pricing page. Assigned manually via admin API.
  founder: {
    name: "Founder",
    runsPerMonth: 10_000,
    apiRatePerDay: Infinity,
    demoRatePerDay: 5,
    priceUsdCents: 0,
    priceZarCents: 0,
    priceDisplayUsd: "Free",
    priceDisplayZar: "Free",
    stripePriceEnvKey: null,
    purchasable: false,
    marketing: false, // assigned by founder, not self-serve
    description: "Enterprise-level access for first 10 users",
  },
  array: {
    name: "Growth",
    runsPerMonth: 500,
    apiRatePerDay: 5_000,
    demoRatePerDay: 5,
    priceUsdCents: 4_900,
    priceZarCents: 499_700,
    priceDisplayUsd: "$49/mo",
    priceDisplayZar: "R4,997/mo",
    stripePriceEnvKey: "STRIPE_PRICE_ARRAY",
    purchasable: true,
    marketing: true,
    description: "500 runs/month. All 5 featured playbooks. Email support.",
  },
  // ARCHIVED: Node $199 was an enterprise-discount tier that
  // confused positioning. Consolidated into Enterprise + per-deal
  // concierge pricing. Existing subscribers keep it.
  node: {
    name: "Sovereign Node",
    runsPerMonth: 2_000,
    apiRatePerDay: 10_000,
    demoRatePerDay: 5,
    priceUsdCents: 19_900,
    priceZarCents: 999_700,
    priceDisplayUsd: "$199/mo",
    priceDisplayZar: "R9,997/mo",
    stripePriceEnvKey: "STRIPE_PRICE_NODE",
    purchasable: true,
    marketing: false, // archived — legacy subscribers only
    description: "Unlimited agents, 2,000 runs/month, local execution",
  },
  enterprise: {
    name: "Enterprise",
    runsPerMonth: 10_000,
    apiRatePerDay: Infinity,
    demoRatePerDay: 5,
    priceUsdCents: 49_900,
    priceZarCents: 4_999_700,
    priceDisplayUsd: "$499/mo",
    priceDisplayZar: "R49,997/mo",
    stripePriceEnvKey: "STRIPE_PRICE_ENTERPRISE",
    purchasable: true,
    marketing: true,
    description: "10,000 runs/month. SAML SSO, SOC 2 evidence, direct Slack.",
  },
};

/** Plans visible to new prospects on /pricing. Filters on marketing flag. */
export function getMarketingPlans(): Array<PlanDefinition & { id: PlanId }> {
  return (Object.entries(PLANS) as Array<[PlanId, PlanDefinition]>)
    .filter(([, p]) => p.marketing === true)
    .map(([id, p]) => ({ ...p, id }));
}

// ── Upgrade Path ──

export const UPGRADE_PATH: Record<PlanId, PlanId | null> = {
  free: "starter",
  starter: "array",
  founder: null,
  array: "node",
  node: "enterprise",
  enterprise: null,
};

/** Maximum number of Free Founder slots (enterprise-level access, no charge). */
export const MAX_FOUNDERS = 10;

/**
 * The Founder Network — Proposal L. Separate cohort from the free
 * Founders program above. Members are paying customers (any plan) in
 * the first-100 cohort, receiving:
 *   - 50% lifetime discount on their paid plan
 *     (applied via Stripe coupon `founder-network-50`)
 *   - 30% referral commission (vs the 20% default)
 *   - Direct Slack access + monthly 30-min 1:1 with the founder
 *   - Optional public "Founder Network Member" badge
 *
 * Numbers diverge on purpose: the FREE Founders program is a closed
 * 10-slot bet (enterprise access, in exchange for feedback); the
 * Founder Network is an open-until-full 100-slot program for paying
 * customers. Both can coexist on the same subscription row — they
 * are flags, not plan tiers.
 */
export const FOUNDER_NETWORK_MAX = 100;
export const FOUNDER_NETWORK_COMMISSION_PCT = 30;
export const FOUNDER_NETWORK_DISCOUNT_PCT = 50;
export const FOUNDER_NETWORK_COUPON_ID = "founder-network-50";

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
export function getStripePriceId(planId: string | null | undefined): string | null {
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
export function getNextPlan(planId: string | null | undefined): PlanDefinition | null {
  const id = normalizePlanId(planId);
  const nextId = UPGRADE_PATH[id];
  return nextId ? PLANS[nextId] : null;
}

/**
 * Build a map of planId → run limit (for backward compatibility).
 * Prefer using getPlanLimit() directly in new code.
 */
export const PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLANS).map(([id, plan]) => [id, plan.runsPerMonth])
);
