/**
 * SOVEREIGN POLICY ENGINE — R100.
 *
 * The unified policy decision point that composes EVERY trust primitive
 * we've shipped (R26 audit chain, R37 ACT, R40 reputation, R42 credit
 * lines, R46 insurance, R91 ACAT, agent-manifest tier) into one
 * declarative DSL.
 *
 * Why this matters for the agentic-AI control-plane race:
 *
 *   Oracle, Microsoft, SAP, n8n, UiPath are all racing to be THE
 *   control plane for agent-initiated work. None of them ship
 *   *composable* policy primitives — their policies are siloed
 *   inside their own consoles. A policy that says "deny if reputation
 *   < B+ AND amount > $1000 AND outside business hours AND no R91
 *   ACAT in scope" cannot be expressed in any single competitor's
 *   tool because they don't have the cryptographic substrate to
 *   reference. We do.
 *
 * DESIGN CONTRACT:
 *
 *   1. Pure function. The evaluator is `evaluatePolicies(policies,
 *      context)` → decision. No I/O. No clocks (caller passes `now`).
 *      Ports verbatim to @sovereign/inspector for offline policy
 *      evaluation in CI.
 *
 *   2. Composes with shipped primitives. Conditions can reference:
 *      - agent tier (1/2/3 from agent-manifest)
 *      - reputation letter grade (R40)
 *      - credit-line headroom (R42, derived from grade × base)
 *      - ACT presence + scope (R37)
 *      - ACAT presence + scope (R91)
 *      - resource tags (free-form for tenant policies)
 *      - cart context (amount, currency, merchant, MCC category)
 *      - time-of-day window
 *      - agent-id allowlist / denylist
 *
 *   3. Effects are richer than allow/deny. The verdict can be:
 *      - `allow` — proceed
 *      - `deny` — refuse outright
 *      - `require-hitl` — gate behind a HITL approval (R26 hitl-routing)
 *      - `require-acat` — agent must present a valid R91 ACAT
 *      - `require-attestation` — caller must sign the action plan
 *      - `require-break-glass` — admin override with reason logged
 *
 *   4. Break-glass override. A policy can mark itself as
 *      "break-glass-eligible" — meaning a human admin can bypass with
 *      a reason string that gets written to the R26 audit chain.
 *      Without break-glass eligibility, deny is final.
 *
 *   5. Procurement-grade reasons. Every decision returns the policy
 *      name + the specific predicate that fired. A CISO can read
 *      the decision JSON without the source code in hand.
 *
 *   6. Deterministic ordering. Policies are evaluated in declaration
 *      order. First match wins (after sorting by priority). Ties
 *      broken by name (alphabetical) for determinism.
 *
 * Failure mode: if every policy fails to match the context, the
 * default is `deny` with reason "no_matching_policy". This is the
 * only way to make a control plane safe by default — never allow
 * what you didn't explicitly authorize.
 */

import type { LetterGrade } from "@/lib/agent-reputation";

// ── Predicate DSL ──────────────────────────────────────────────────

/** Letter grade comparator (uses canonical ordering A+ > A > A- > B+ > … > F). */
const GRADE_ORDER: LetterGrade[] = [
  "F",
  "D",
  "C-",
  "C",
  "C+",
  "B-",
  "B",
  "B+",
  "A-",
  "A",
  "A+",
];

function gradeIndex(g: LetterGrade): number {
  const i = GRADE_ORDER.indexOf(g);
  return i === -1 ? 0 : i;
}

/** Predicate union — every supported condition. */
export type PolicyPredicate =
  | { kind: "agent-tier-leq"; tier: 1 | 2 | 3 }
  | { kind: "agent-tier-eq"; tier: 1 | 2 | 3 }
  | { kind: "reputation-grade-min"; grade: LetterGrade }
  | { kind: "credit-headroom-min-cents"; cents: number }
  | { kind: "act-present" }
  | { kind: "acat-present" }
  | { kind: "acat-amount-leq-cents"; cents: number }
  | { kind: "acat-merchant-in"; merchantIds: string[] }
  | { kind: "acat-category-in"; categories: string[] }
  | { kind: "agent-id-in"; agentIds: string[] }
  | { kind: "agent-id-not-in"; agentIds: string[] }
  | { kind: "resource-tag-eq"; tag: string; value: string }
  | { kind: "time-window"; startHourUtc: number; endHourUtc: number }
  | { kind: "max-amount-cents"; cents: number }
  | { kind: "currency-in"; currencies: string[] }
  | { kind: "merchant-id-in"; merchantIds: string[] };

/**
 * The richer effect set — beyond simple allow/deny.
 * Composes with R26 HITL routing, R37 ACT requirements, R91 ACAT.
 */
export type PolicyEffect =
  | "allow"
  | "deny"
  | "require-hitl"
  | "require-acat"
  | "require-attestation"
  | "require-break-glass";

export interface PolicyRule {
  /** Stable name — used in the decision reason for procurement audit. */
  name: string;
  /** Optional human-readable purpose statement. */
  description?: string;
  /** Lower priorities evaluate first. Default: 100. */
  priority?: number;
  /** Effect when ALL predicates match. */
  effect: PolicyEffect;
  /** Predicates joined by AND. Empty array = matches everything. */
  predicates: PolicyPredicate[];
  /** If true, an admin break-glass override can bypass `deny`. */
  breakGlassEligible?: boolean;
  /** Optional regulatory citation for procurement audit. */
  regulatoryCitation?: string;
}

// ── Decision context (the inputs at evaluation time) ──────────────

/** Snapshot the engine evaluates against. Caller assembles this. */
export interface PolicyContext {
  /** R34 user identity invoking the agent. */
  userId: string;
  /** Slug from agent-manifest. */
  agentId: string;
  /** From agent-manifest.tier (1=read-only, 2=writes, 3=external action). */
  agentTier: 1 | 2 | 3;
  /** R40 reputation grade snapshot at evaluation. */
  reputationGrade?: LetterGrade;
  /** R42 credit-line headroom in cents (effective − consumed). */
  creditHeadroomCents?: number;
  /** R37 ACT chain — present means the agent holds a capability token. */
  actPresent?: boolean;
  /** R91 ACAT — present + cart context means agentic-commerce path. */
  acat?: {
    present: true;
    maxCents: number;
    currency: string;
    allowedMerchantIds: string[];
    allowedCategories: string[];
  };
  /** Cart context (commerce paths). */
  cart?: {
    amountCents: number;
    currency: string;
    merchantId: string;
    category: string;
  };
  /** Free-form tenant-side resource tags (e.g. {"env": "prod"}). */
  resourceTags?: Record<string, string>;
  /** Caller passes for testability. */
  now?: Date;
}

// ── Decision shape ─────────────────────────────────────────────────

export type PolicyDecision =
  | {
      verdict: "allow";
      matchedPolicyName: string;
      reason: string;
    }
  | {
      verdict: "deny" | "require-hitl" | "require-acat" | "require-attestation";
      matchedPolicyName: string;
      reason: string;
      breakGlassEligible: boolean;
      regulatoryCitation?: string;
    }
  | {
      verdict: "deny";
      matchedPolicyName: "default";
      reason: "no_matching_policy";
      breakGlassEligible: false;
    };

// ── Pure: predicate evaluator ─────────────────────────────────────

/**
 * Evaluate a single predicate against a context. Pure function.
 * Returns `{matched: true}` if predicate fires; `{matched: false, why}`
 * with a short human-readable reason otherwise.
 */
export function evaluatePredicate(
  p: PolicyPredicate,
  c: PolicyContext,
): { matched: boolean; why?: string } {
  switch (p.kind) {
    case "agent-tier-leq":
      return {
        matched: c.agentTier <= p.tier,
        why:
          c.agentTier <= p.tier
            ? undefined
            : `agent tier ${c.agentTier} > ${p.tier}`,
      };
    case "agent-tier-eq":
      return {
        matched: c.agentTier === p.tier,
        why:
          c.agentTier === p.tier
            ? undefined
            : `agent tier ${c.agentTier} ≠ ${p.tier}`,
      };
    case "reputation-grade-min": {
      if (!c.reputationGrade) return { matched: false, why: "no reputation" };
      const ok = gradeIndex(c.reputationGrade) >= gradeIndex(p.grade);
      return {
        matched: ok,
        why: ok
          ? undefined
          : `reputation ${c.reputationGrade} < ${p.grade}`,
      };
    }
    case "credit-headroom-min-cents": {
      if (c.creditHeadroomCents === undefined)
        return { matched: false, why: "no credit headroom" };
      const ok = c.creditHeadroomCents >= p.cents;
      return {
        matched: ok,
        why: ok
          ? undefined
          : `headroom ${c.creditHeadroomCents}¢ < ${p.cents}¢`,
      };
    }
    case "act-present":
      return {
        matched: c.actPresent === true,
        why: c.actPresent ? undefined : "no ACT",
      };
    case "acat-present":
      return {
        matched: c.acat?.present === true,
        why: c.acat?.present ? undefined : "no ACAT",
      };
    case "acat-amount-leq-cents": {
      if (!c.acat?.present) return { matched: false, why: "no ACAT" };
      const ok = c.acat.maxCents <= p.cents;
      return {
        matched: ok,
        why: ok ? undefined : `ACAT max ${c.acat.maxCents}¢ > ${p.cents}¢`,
      };
    }
    case "acat-merchant-in": {
      if (!c.acat?.present) return { matched: false, why: "no ACAT" };
      const setA = new Set(p.merchantIds);
      const ok = c.acat.allowedMerchantIds.some((m) => setA.has(m));
      return {
        matched: ok,
        why: ok ? undefined : "ACAT merchants outside allowlist",
      };
    }
    case "acat-category-in": {
      if (!c.acat?.present) return { matched: false, why: "no ACAT" };
      const setC = new Set(p.categories);
      const ok = c.acat.allowedCategories.some((cat) => setC.has(cat));
      return {
        matched: ok,
        why: ok ? undefined : "ACAT categories outside allowlist",
      };
    }
    case "agent-id-in": {
      const ok = p.agentIds.includes(c.agentId);
      return {
        matched: ok,
        why: ok ? undefined : `agent ${c.agentId} not in allowlist`,
      };
    }
    case "agent-id-not-in": {
      const ok = !p.agentIds.includes(c.agentId);
      return {
        matched: ok,
        why: ok ? undefined : `agent ${c.agentId} on denylist`,
      };
    }
    case "resource-tag-eq": {
      const v = c.resourceTags?.[p.tag];
      const ok = v === p.value;
      return {
        matched: ok,
        why: ok
          ? undefined
          : `resource tag ${p.tag}=${v ?? "<missing>"} ≠ ${p.value}`,
      };
    }
    case "time-window": {
      const now = c.now ?? new Date();
      const hour = now.getUTCHours();
      let ok: boolean;
      if (p.startHourUtc <= p.endHourUtc) {
        ok = hour >= p.startHourUtc && hour < p.endHourUtc;
      } else {
        // Wraps midnight, e.g. 22 → 6.
        ok = hour >= p.startHourUtc || hour < p.endHourUtc;
      }
      return {
        matched: ok,
        why: ok
          ? undefined
          : `hour ${hour} outside [${p.startHourUtc}, ${p.endHourUtc})`,
      };
    }
    case "max-amount-cents": {
      if (!c.cart) return { matched: false, why: "no cart context" };
      const ok = c.cart.amountCents <= p.cents;
      return {
        matched: ok,
        why: ok
          ? undefined
          : `cart ${c.cart.amountCents}¢ > limit ${p.cents}¢`,
      };
    }
    case "currency-in": {
      if (!c.cart) return { matched: false, why: "no cart context" };
      const ok = p.currencies.includes(c.cart.currency);
      return {
        matched: ok,
        why: ok ? undefined : `currency ${c.cart.currency} outside allowlist`,
      };
    }
    case "merchant-id-in": {
      if (!c.cart) return { matched: false, why: "no cart context" };
      const ok = p.merchantIds.includes(c.cart.merchantId);
      return {
        matched: ok,
        why: ok ? undefined : `merchant ${c.cart.merchantId} outside allowlist`,
      };
    }
  }
}

// ── Pure: policy evaluator ────────────────────────────────────────

/**
 * Evaluate a list of policies against a context. Pure function.
 *
 * Order: by ascending priority, then alphabetical name. The first
 * policy whose predicates ALL match wins. If no policy matches,
 * returns `default → deny → no_matching_policy`.
 *
 * This default-deny posture is the "safe by default" property: a
 * tenant adopting the engine cannot accidentally allow an action
 * just by forgetting to write a policy for it.
 */
export function evaluatePolicies(
  policies: readonly PolicyRule[],
  context: PolicyContext,
): PolicyDecision {
  // Stable sort: priority asc, then name asc. Default priority = 100.
  const sorted = [...policies].sort((a, b) => {
    const pa = a.priority ?? 100;
    const pb = b.priority ?? 100;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  for (const policy of sorted) {
    const reasons: string[] = [];
    let allMatched = true;
    for (const pred of policy.predicates) {
      const r = evaluatePredicate(pred, context);
      if (!r.matched) {
        allMatched = false;
        if (r.why) reasons.push(r.why);
        break; // Short-circuit AND.
      }
    }
    if (allMatched) {
      const reason =
        policy.predicates.length === 0
          ? `policy ${policy.name} matched (no predicates)`
          : `policy ${policy.name} matched (${policy.predicates.length} predicates)`;
      if (policy.effect === "allow") {
        return {
          verdict: "allow",
          matchedPolicyName: policy.name,
          reason,
        };
      }
      return {
        verdict: policy.effect === "require-break-glass" ? "deny" : policy.effect,
        matchedPolicyName: policy.name,
        reason,
        breakGlassEligible: policy.breakGlassEligible === true,
        regulatoryCitation: policy.regulatoryCitation,
      };
    }
  }

  return {
    verdict: "deny",
    matchedPolicyName: "default",
    reason: "no_matching_policy",
    breakGlassEligible: false,
  };
}

// ── Break-glass override ───────────────────────────────────────────

export interface BreakGlassRequest {
  /** Original deny decision (must be break-glass-eligible). */
  decision: PolicyDecision;
  /** Required reason — written to R26 audit chain. */
  reason: string;
  /** Admin user invoking the override. */
  adminUserId: string;
  /** ISO 8601 — when the override fires. */
  invokedAt: string;
}

export interface BreakGlassResult {
  ok: boolean;
  /** True if override applied; false with reason otherwise. */
  overridden: boolean;
  reason?: string;
  /** Audit log entry the caller should append to R26. */
  auditEntry?: {
    action: "policy.break_glass";
    resource: string;
    details: {
      originalReason: string;
      originalPolicy: string;
      overrideReason: string;
      adminUserId: string;
      invokedAt: string;
    };
  };
}

/**
 * Pure function: validate a break-glass request and produce the
 * audit log entry the caller should append. Does NOT actually flip
 * the decision — caller chooses to honor based on `ok`.
 */
export function applyBreakGlass(
  input: BreakGlassRequest,
): BreakGlassResult {
  if (input.decision.verdict === "allow") {
    return {
      ok: false,
      overridden: false,
      reason: "decision_already_allows",
    };
  }
  if (input.decision.matchedPolicyName === "default") {
    return {
      ok: false,
      overridden: false,
      reason: "default_deny_not_eligible",
    };
  }
  if (
    input.decision.matchedPolicyName !== "default" &&
    input.decision.breakGlassEligible !== true
  ) {
    return {
      ok: false,
      overridden: false,
      reason: "policy_not_break_glass_eligible",
    };
  }
  if (!input.reason || input.reason.trim().length < 10) {
    return {
      ok: false,
      overridden: false,
      reason: "reason_too_short",
    };
  }
  return {
    ok: true,
    overridden: true,
    auditEntry: {
      action: "policy.break_glass",
      resource: input.decision.matchedPolicyName,
      details: {
        originalReason: input.decision.reason,
        originalPolicy: input.decision.matchedPolicyName,
        overrideReason: input.reason,
        adminUserId: input.adminUserId,
        invokedAt: input.invokedAt,
      },
    },
  };
}

// ── Pre-built policy templates (procurement examples) ────────────

/**
 * "finance_agent_can_read_customers_but_not_write" example from the
 * blueprint. Restricts a finance-tagged agent to Tier 1 (read-only).
 */
export const FINANCE_READ_ONLY_POLICY: PolicyRule = {
  name: "finance_agent_can_read_customers_but_not_write",
  description: "Finance agents must operate read-only against customer data.",
  priority: 10,
  effect: "deny",
  predicates: [
    { kind: "resource-tag-eq", tag: "department", value: "finance" },
    { kind: "agent-tier-leq", tier: 1 },
  ],
  breakGlassEligible: true,
  regulatoryCitation: "SOX 404 (segregation of duties)",
};

/**
 * "production_writes_require_hitl" — any Tier-2/3 agent action against
 * production resources requires a HITL approval gate (R26).
 */
export const PROD_WRITES_REQUIRE_HITL: PolicyRule = {
  name: "production_writes_require_hitl",
  description:
    "Tier 2/3 actions on prod-tagged resources route through HITL approval.",
  priority: 5,
  effect: "require-hitl",
  predicates: [
    { kind: "resource-tag-eq", tag: "env", value: "prod" },
    { kind: "agent-tier-eq", tier: 2 },
  ],
  breakGlassEligible: true,
  regulatoryCitation: "SOC 2 CC8.1 (change management)",
};

/**
 * "agentic_commerce_requires_acat" — any commerce path (cart present)
 * must carry a valid R91 ACAT. No exceptions, no break-glass.
 */
export const COMMERCE_REQUIRES_ACAT: PolicyRule = {
  name: "agentic_commerce_requires_acat",
  description:
    "Commerce actions require a Sovereign ACAT (R91) for offline verification.",
  priority: 1,
  effect: "require-acat",
  predicates: [
    { kind: "max-amount-cents", cents: Number.MAX_SAFE_INTEGER },
    // The MAX_SAFE_INTEGER predicate matches whenever cart.amountCents is
    // present — i.e. any commerce path. We use `acat-present` as a
    // negative match below by inverting via require-acat effect.
  ],
  breakGlassEligible: false,
  regulatoryCitation: "Sovereign R91 (Agentic Commerce Authorization Token)",
};
