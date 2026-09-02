/**
 * SOVEREIGN MATRIX — Paywall Gate
 *
 * Locks agents and features behind plan tiers.
 * Free tier: 3 core agents + 50 runs/month
 * Starter ($19): 5 agents + 200 runs
 * Array ($49): 10 agents + 500 runs
 * Node ($199): All agents + 2,000 runs
 * Enterprise ($499): All agents + 10,000 runs + white-label
 *
 * Usage:
 *   const access = checkAccess("leads", userPlan);
 *   if (!access.allowed) return error(access.reason);
 */

import {
  normalizePlanId,
  getPlan,
  cheapestPlanWith,
  type PlanEnterpriseFlags,
  type PlanId,
} from "@/lib/plans";

// ── Agent Tier Map ──
// Which agents are available on which plan

const FREE_AGENTS = new Set([
  "leads", // Lead finder
  "blog-gen", // Blog generator
  "seo-dominator", // SEO audit
]);

const STARTER_AGENTS = new Set([
  ...FREE_AGENTS,
  "email-sequence", // Email drip
  "organic-content", // Social content
]);

const ARRAY_AGENTS = new Set([
  ...STARTER_AGENTS,
  "competitor-scan", // Competitor intel
  "brand-voice", // Brand voice learning
  "proposal-generator", // Proposal creation
  "creative-director", // Ad copy
  "funnel-xray", // Landing page analysis
]);

// Node + Enterprise = ALL agents (no restrictions)

// ── Feature Gates ──

/**
 * Feature slugs whose tier is owned by the enterprise flags on each
 * PlanDefinition (plans.ts). Deriving the gate from the flag means this
 * module and plan-enforcement's requireEntitlement() answer from the same
 * data — the two vocabularies ("white-label" the slug, `whiteLabel` the
 * flag) can no longer disagree about which tier unlocks a feature.
 *
 * checkFeatureAccess() is the synchronous form for a plan string already
 * in hand; requireEntitlement(userId, flag) is the async form that
 * resolves the plan from the database. Both read PLANS[].enterprise.
 */
function gateFor(flag: keyof PlanEnterpriseFlags): PlanId {
  // No purchasable plan carries the flag → contract tier only.
  return cheapestPlanWith(flag) ?? "sovereign";
}

const FEATURE_GATES: Record<string, PlanId> = {
  "white-label": gateFor("whiteLabel"),
  "custom-domain": gateFor("whiteLabel"),
  "audit-log-export": gateFor("auditLogExport"),
  "priority-support": gateFor("dedicatedSupport"),
  "api-access": "array",
  "scheduled-runs": "starter",
  "workflow-builder": "array",
  "marketplace-publish": "array",
  "voice-agents": "node",
  "video-generation": "node",
  "adversarial-synthesis": "node",
  "graph-memory": "starter",
  "export-results": "starter",
  "team-members": "enterprise",
};

// ── Plan Hierarchy (for >= comparison) ──

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  founder: 5, // Founders get enterprise access
  array: 2,
  node: 3,
  enterprise: 4,
  sovereign: 6, // Contract tier above enterprise — outranks founder.
};

// ── Access Check ──

export interface AccessResult {
  allowed: boolean;
  reason: string;
  requiredPlan: PlanId | null;
  upgradeUrl: string;
}

/**
 * Check if a user's plan allows access to a specific agent.
 */
export function checkAgentAccess(
  agentName: string,
  userPlan: string | null | undefined,
): AccessResult {
  const plan = normalizePlanId(userPlan);
  const rank = PLAN_RANK[plan];

  // Node, Enterprise, Founder = all agents
  if (rank >= PLAN_RANK.node) {
    return { allowed: true, reason: "", requiredPlan: null, upgradeUrl: "" };
  }

  // Array tier
  if (rank >= PLAN_RANK.array && ARRAY_AGENTS.has(agentName)) {
    return { allowed: true, reason: "", requiredPlan: null, upgradeUrl: "" };
  }

  // Starter tier
  if (rank >= PLAN_RANK.starter && STARTER_AGENTS.has(agentName)) {
    return { allowed: true, reason: "", requiredPlan: null, upgradeUrl: "" };
  }

  // Free tier
  if (FREE_AGENTS.has(agentName)) {
    return { allowed: true, reason: "", requiredPlan: null, upgradeUrl: "" };
  }

  // Determine which plan is needed
  let requiredPlan: PlanId = "node"; // Default: need node for unlisted agents
  if (STARTER_AGENTS.has(agentName)) requiredPlan = "starter";
  else if (ARRAY_AGENTS.has(agentName)) requiredPlan = "array";

  const planDef = getPlan(requiredPlan);

  return {
    allowed: false,
    reason: `Agent "${agentName}" requires the ${planDef.name} plan (${planDef.priceDisplayUsd})`,
    requiredPlan,
    upgradeUrl: "/dashboard/billing",
  };
}

/**
 * Check if a user's plan allows access to a specific feature.
 */
export function checkFeatureAccess(
  feature: string,
  userPlan: string | null | undefined,
): AccessResult {
  const plan = normalizePlanId(userPlan);
  const rank = PLAN_RANK[plan];

  const requiredPlan = FEATURE_GATES[feature];
  if (!requiredPlan) {
    // Feature not gated — allow
    return { allowed: true, reason: "", requiredPlan: null, upgradeUrl: "" };
  }

  const requiredRank = PLAN_RANK[requiredPlan];
  if (rank >= requiredRank) {
    return { allowed: true, reason: "", requiredPlan: null, upgradeUrl: "" };
  }

  const planDef = getPlan(requiredPlan);
  return {
    allowed: false,
    reason: `"${feature}" requires the ${planDef.name} plan (${planDef.priceDisplayUsd})`,
    requiredPlan,
    upgradeUrl: "/dashboard/billing",
  };
}

/**
 * Get available agents for a plan.
 */
export function getAvailableAgents(userPlan: string | null | undefined): {
  agents: string[];
  total: number;
  locked: number;
} {
  const plan = normalizePlanId(userPlan);
  const rank = PLAN_RANK[plan];

  if (rank >= PLAN_RANK.node) {
    return { agents: ["*"], total: 129, locked: 0 }; // All agents
  }
  if (rank >= PLAN_RANK.array) {
    return {
      agents: [...ARRAY_AGENTS],
      total: ARRAY_AGENTS.size,
      locked: 129 - ARRAY_AGENTS.size,
    };
  }
  if (rank >= PLAN_RANK.starter) {
    return {
      agents: [...STARTER_AGENTS],
      total: STARTER_AGENTS.size,
      locked: 129 - STARTER_AGENTS.size,
    };
  }

  return {
    agents: [...FREE_AGENTS],
    total: FREE_AGENTS.size,
    locked: 129 - FREE_AGENTS.size,
  };
}

/**
 * Get locked features for a plan.
 */
export function getLockedFeatures(
  userPlan: string | null | undefined,
): string[] {
  const plan = normalizePlanId(userPlan);
  const rank = PLAN_RANK[plan];

  return Object.entries(FEATURE_GATES)
    .filter(([, required]) => PLAN_RANK[required] > rank)
    .map(([feature]) => feature);
}
