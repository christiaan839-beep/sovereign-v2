/**
 * HITL ROUTING RULES — the policy layer.
 *
 * Round 33 deep work. Maps an action's `RoutingContext` to the
 * sequence of approval stages that must fire.
 *
 * This file is the SHIPPED CHOICE for the platform's default
 * approval policy. Customers on Enterprise+ can override per-tenant
 * via tenant-policy-resolver.ts; this file is the universal default.
 *
 * DESIGN: declarative rule array. Each rule is:
 *   { match: (ctx) => boolean,
 *     stages: StageDefinition[],
 *     name: string  ← human-readable for audit ("high-cost: compliance + finance") }
 *
 * The engine evaluates rules IN ORDER. The FIRST matching rule wins.
 * If no rule matches, the action proceeds without HITL (no stages).
 *
 * Rule ORDER matters — put the strictest rules first. For example:
 *   1. "Critical action with sensitive data" → 3-stage
 *   2. "Critical action" → 2-stage
 *   3. "High cost (>$1000)" → 2-stage
 *   4. "Sensitive data" → 1-stage
 *   5. (default: no HITL)
 *
 * WHY DECLARATIVE: imperative `if/else` chains drift over time. A
 * rules array is auditable, testable, and can be diffed in code review.
 *
 * WHY THIS LIVES IN-CODE NOT IN-DB: the policy IS the audit artifact.
 * Procurement teams reviewing the platform want to see the rules in
 * the source where they can be diff'd against past versions. A
 * runtime DB-table version would be tampered without diff trail.
 */

import type {
  RoutingContext,
  StageDefinition,
} from "./multi-stage-hitl";

// ── Stage helpers — readability for the rule array below ───────────

const HOUR = 60 * 60;

// Stage shorthand. Tweak per-stage timeouts here in one place;
// individual rules just compose these.
const COMPLIANCE_STAGE: StageDefinition = {
  role: "compliance",
  timeoutSeconds: 12 * HOUR,
};
const SECURITY_STAGE: StageDefinition = {
  role: "security",
  timeoutSeconds: 12 * HOUR,
};
const FINANCE_STAGE: StageDefinition = {
  role: "finance",
  timeoutSeconds: 12 * HOUR,
};
const BUSINESS_STAGE: StageDefinition = {
  role: "business",
  timeoutSeconds: 24 * HOUR,
};
// Reserved for future expansion: legal, executive, board.

export interface RoutingRule {
  /** Human-readable name (used in audit logs + dashboard). */
  name: string;
  /** Pure-function predicate. NEVER throws; on doubt, return false. */
  match: (ctx: RoutingContext) => boolean;
  /** Stages to fire IF this rule matches. */
  stages: StageDefinition[];
  /** Optional rationale shown in the admin dashboard. */
  rationale?: string;
}

// ── USER CONTRIBUTION POINT ────────────────────────────────────────
//
// Define the rules below. Rules are evaluated TOP-TO-BOTTOM; first
// match wins. Put the strictest rules first.
//
// CONTEXT FOR YOUR DECISIONS:
//
// What triggers MULTI-STAGE in your customers' compliance regimes?
//
//   COMMON FOUNDATION (any of these usually requires MORE than
//   single-approver review):
//     * Action tier "critical" — irreversible / high-blast-radius
//     * Cost > some threshold — ranges from $100 (small ops) to
//       $10,000 (Fortune-500 procurement)
//     * Sensitive data export — PII, PHI, financial records
//     * External system writes — public posts, third-party API calls
//
//   COMMON STAGES (in approximate sequence preference):
//     1. compliance — legal/regulatory review (HIPAA, SOC2, GDPR)
//     2. security  — data-flow review (does this leak/expose?)
//     3. finance   — cost authorization (budget, approval ceiling)
//     4. business  — owner / domain-lead final sign-off
//
// EXAMPLE RULES (uncomment + tune to match your customer profile):
//
//   {
//     name: "critical_with_sensitive_data",
//     match: (ctx) => ctx.actionTier === "critical" && ctx.involvesSensitiveData === true,
//     stages: [COMPLIANCE_STAGE, SECURITY_STAGE, BUSINESS_STAGE],
//     rationale: "Critical action touching sensitive data — full chain.",
//   },
//   {
//     name: "high_cost_external",
//     match: (ctx) => (ctx.costCents ?? 0) > 100_000 && ctx.involvesExternalSystem === true,
//     stages: [FINANCE_STAGE, BUSINESS_STAGE],
//     rationale: "Spend over $1,000 on external system — finance + business.",
//   },
//   {
//     name: "sensitive_export",
//     match: (ctx) => ctx.involvesSensitiveData === true,
//     stages: [COMPLIANCE_STAGE],
//     rationale: "Single compliance review for sensitive data export.",
//   },
//
// Rule design questions to answer for your customer profile:
//
//   1. Is "$1,000" the right cost threshold for your customers? Lower
//      for SMB (where $100 is meaningful), higher for enterprise
//      (where $10K is routine).
//
//   2. Does "external_system" always require business approval, or is
//      finance enough? Depends on whether your customers care more
//      about money or about brand-risk from external posts.
//
//   3. For data export rules, what's the role taxonomy that maps best
//      to your customers' org charts? Some have a single "DPO" (data
//      protection officer); others have separate compliance + security.
//
// This is the file to edit. Keep additions narrow + named; the
// rules array is the audit artifact procurement teams will read.

/**
 * SHIPPED CHOICE (R33): Pattern A+B hybrid — enterprise-leaning with
 * SMB-protective floors.
 *
 * Rationale: the platform positioning is "trustable compute layer for
 * agentic commerce" with Fortune-500 procurement aspirations. The
 * rules below default to multi-stage when ANY of these flags fire:
 *   - Action tier "critical" (irreversible / high-blast-radius)
 *   - Spend > $50 (low floor — SMB buyers see protection too)
 *   - Sensitive data export (PII / PHI / financial)
 *   - External system writes ($100+ on third-party calls)
 *
 * Cost thresholds:
 *   * $50 (5,000 cents)   — minimum ANY review (SMB-protective)
 *   * $1,000 (100K cents) — finance review required
 *   * $5,000 (500K cents) — finance + business review
 *
 * Order matters: STRICTEST RULES FIRST. The first matching rule wins,
 * so "critical-with-sensitive-data" must come before "any-critical"
 * which must come before "high-cost".
 *
 * Revisit triggers:
 *   - Customer feedback that a threshold blocks legitimate use → relax
 *   - SOC 2 audit feedback → likely tighten
 *   - New regulatory regime (FedRAMP, HIPAA-BAA) → add tier-3 rules
 *
 * Per-tenant overrides: live in tenant-policy-resolver.ts. Enterprise+
 * tenants can replace these with custom rules.
 */
export const HITL_ROUTING_RULES: RoutingRule[] = [
  // 1. CRITICAL action that touches sensitive data → full chain (3 stages)
  //    Compliance reviews data flow → Security reviews exposure path →
  //    Business owns the final approval.
  {
    name: "critical_with_sensitive_data",
    match: (ctx) =>
      ctx.actionTier === "critical" && ctx.involvesSensitiveData === true,
    stages: [COMPLIANCE_STAGE, SECURITY_STAGE, BUSINESS_STAGE],
    rationale:
      "Critical action touching sensitive data — compliance + security + business chain.",
  },

  // 2. CRITICAL action (irreversible / high-blast-radius) → 2 stages
  //    Even without sensitive data, criticals get business sign-off
  //    AFTER security review (which catches "is this really irreversible?").
  {
    name: "any_critical",
    match: (ctx) => ctx.actionTier === "critical",
    stages: [SECURITY_STAGE, BUSINESS_STAGE],
    rationale: "Critical action — security + business final approval.",
  },

  // 3. HIGH cost ($5,000+) on external system → finance + business
  //    The enterprise procurement default: anything that materially
  //    moves money outside the platform needs both budget approval
  //    and business owner sign-off.
  {
    name: "high_cost_external",
    match: (ctx) =>
      (ctx.costCents ?? 0) >= 500_000 && ctx.involvesExternalSystem === true,
    stages: [FINANCE_STAGE, BUSINESS_STAGE],
    rationale: "Spend ≥$5,000 on external system — finance + business.",
  },

  // 4. SENSITIVE data export → compliance review (single stage)
  //    Most data exports are routine; we don't want to block them with
  //    a 3-stage chain. But ANY sensitive export gets compliance eyes.
  {
    name: "sensitive_data_export",
    match: (ctx) => ctx.involvesSensitiveData === true,
    stages: [COMPLIANCE_STAGE],
    rationale: "Sensitive data export — single compliance review.",
  },

  // 5. MEDIUM-HIGH cost ($1,000+) → finance review (single stage)
  //    Catches "agent paid $1,500 for SaaS without sign-off" — a real
  //    procurement complaint at scale.
  {
    name: "medium_high_cost",
    match: (ctx) => (ctx.costCents ?? 0) >= 100_000,
    stages: [FINANCE_STAGE],
    rationale: "Spend ≥$1,000 — finance budget approval.",
  },

  // 6. LOW-FLOOR external system writes ($100+) → business owner sign-off
  //    Catches "agent posted to your social media" or "agent bought $200
  //    of stock photos" without ownership review. SMB-protective floor.
  {
    name: "low_floor_external",
    match: (ctx) =>
      (ctx.costCents ?? 0) >= 10_000 && ctx.involvesExternalSystem === true,
    stages: [BUSINESS_STAGE],
    rationale: "Spend ≥$100 on external system — business owner sign-off.",
  },

  // 7. ANY external write below thresholds → no HITL (permissive)
  //    External writes under $100 on non-sensitive data are routine
  //    agent activity (e.g. small API calls, content generation).
];

// ── End user contribution point ────────────────────────────────────

/**
 * Pure-function rule evaluator. Given a routing context, returns the
 * stages that must fire. Returns empty array → no HITL needed.
 *
 * Evaluates rules in order; first match wins. NEVER throws.
 */
export function selectApprovalStages(ctx: RoutingContext): {
  stages: StageDefinition[];
  matchedRule: string | null;
} {
  for (const rule of HITL_ROUTING_RULES) {
    try {
      if (rule.match(ctx)) {
        return { stages: rule.stages, matchedRule: rule.name };
      }
    } catch {
      // Defensive: a buggy match() must not break the platform.
      // The action proceeds as if the rule didn't match.
      continue;
    }
  }
  return { stages: [], matchedRule: null };
}
