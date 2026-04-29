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

export const HITL_ROUTING_RULES: RoutingRule[] = [
  // TODO(user): insert rules here. The default "no rules → no HITL"
  // is a permissive starting point. Add rules as your customer
  // profile demands.
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
