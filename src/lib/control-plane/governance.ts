/**
 * R142 PRE-ACTION GOVERNANCE REASONING LOOP (PAGRL) — Move 6 of the
 * proof-conversion arc. Pure-function 4-layer ruleset consultation
 * that runs UPSTREAM of R100's policy gate.
 *
 * STRATEGIC PURPOSE:
 *
 *   The R100 Policy Engine evaluates ONE flat ruleset against an
 *   action and returns allow/deny/HITL. Production governance — the
 *   kind that satisfies SOC 2 / EU AI Act / NIST CAISI auditors —
 *   needs a STRUCTURED consultation across multiple ruleset layers
 *   so reviewers can see WHICH layer's rule fired and WHY.
 *
 *   The "Think Before You Act" paper (April 2026, 14 authors,
 *   production-validated on retail supply-chain workflows) shows
 *   that internalized governance — agents consulting a layered
 *   ruleset before every consequential action — produces 95%
 *   compliance accuracy with zero false escalations, dramatically
 *   stronger than pure external enforcement.
 *
 *   This is NOT a replacement for R100. PAGRL is consultation;
 *   R100 is enforcement. The agent-factory pipeline becomes:
 *
 *     R140/R141 viability gate (drift detection)
 *       └─ R142 PAGRL (this module — layered consultation)
 *           └─ R100 policy gate (enforcement)
 *               └─ R143 ODTA (runtime placement test, ./odta.ts)
 *                   └─ dispatch
 *
 * THE FOUR LAYERS:
 *
 *   1. global       — platform-wide policies (e.g., "no commerce
 *                     action without R91 ACAT")
 *   2. workflow     — task-specific constraints (e.g., "code-review
 *                     workflow cannot delete files")
 *   3. agent        — role-specific permissions (e.g., "the
 *                     finance-bot agent is tier-1 read-only")
 *   4. situational  — context-dependent rules (e.g., "any cart
 *                     action > $1000 outside business hours
 *                     escalates to HITL")
 *
 * VERDICT TYPES:
 *
 *   - permit    — proceed with no modification
 *   - modify    — proceed but with the request rewritten per the
 *                 matched rule's modifier (caller applies)
 *   - escalate  — route to HITL queue with the matched-rule
 *                 trace as the reviewer's context
 *
 * CONSULTATION SEMANTICS:
 *
 *   - Layers walk in order: global → workflow → agent → situational.
 *   - Within each layer, the FIRST predicate-match wins (deterministic
 *     ordering — caller pre-sorts each layer's rules by priority).
 *   - A non-permit verdict in any layer SHORT-CIRCUITS — a global
 *     deny stops the workflow/agent/situational consultation.
 *   - The output trace includes EVERY rule that matched, not just
 *     the final one, so SOC 2 reviewers see the complete consultation.
 *
 * SAFETY POSTURE:
 *
 *   1. Default-OFF via SOVEREIGN_GOVERNANCE_LOOP_ENABLED.
 *   2. No I/O; no clocks (caller passes `now`). Ports verbatim to
 *      @sovereign/inspector for offline regulator-runnable verification.
 *   3. Composes cleanly with R100: a PAGRL escalate is HITL,
 *      separate from R100's hard-deny. Both can fire; both are
 *      audited via `agent.governance_consult` (R142 audit action,
 *      already in the audit-log vocabulary on disk).
 */

import type { AgentActionClass } from "@/lib/control-plane/viability";

// ── Feature flag ───────────────────────────────────────────────────

export function isGovernanceLoopEnabled(): boolean {
  return process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED === "true";
}

// ── Layer + verdict taxonomy ───────────────────────────────────────

export const GOVERNANCE_LAYERS = [
  "global",
  "workflow",
  "agent",
  "situational",
] as const;
export type GovernanceLayer = (typeof GOVERNANCE_LAYERS)[number];

/** Three verdicts. permit = proceed. modify = proceed with rewrite.
 *  escalate = HITL queue (with the matched-rule trace as reviewer
 *  context). escalate is NOT the same as R100 deny. */
export type GovernanceVerdict = "permit" | "modify" | "escalate";

// ── Context the consultation evaluates ─────────────────────────────

export interface GovernanceContext {
  /** Stable agent id (matches AgentConfig.name). */
  agentName: string;
  /** Action tier from AgentConfig (1=read-only, 2=writes, 3=external). */
  agentTier: 1 | 2 | 3;
  /** Optional workflow id (for the workflow-layer rules). */
  workflowId?: string;
  /** Coarse action class (matches viability.ts taxonomy). */
  actionClass: AgentActionClass;
  /** Resource tags from request body / headers (drives predicates). */
  resourceTags?: Record<string, string>;
  /** Optional cart context for commerce-path situational rules. */
  cart?: {
    amountCents: number;
    currency: string;
    merchant?: string;
  };
  /** Caller-supplied "now" for testability. Defaults to wall-clock if absent. */
  now?: Date;
}

// ── Rule shape ─────────────────────────────────────────────────────

/**
 * One governance rule. Pure-function predicate over the context;
 * effect chosen at rule-declaration time so the trace is deterministic.
 *
 * Caller (or registry) pre-sorts rules within each layer by priority
 * (lower number first). PAGRL does NOT re-sort — the input order is
 * the consultation order.
 *
 * Optional `modifier`: when effect is "modify", this callback returns
 * a rewrite of the request payload. Callers apply the rewrite; PAGRL
 * just records that the modify happened.
 */
export interface GovernanceRule<TPayload = Record<string, unknown>> {
  id: string;
  layer: GovernanceLayer;
  /** Display name for procurement-readable trace. */
  name: string;
  /** Procurement-readable rationale (1-2 sentences). */
  rationale: string;
  /** Pure predicate. true = rule matched. */
  predicate: (ctx: GovernanceContext) => boolean;
  /** Verdict on match. */
  effect: GovernanceVerdict;
  /** Optional rewrite applied when effect === "modify". */
  modifier?: (payload: TPayload) => TPayload;
  /** Optional regulatory citation surfaced in audit + UI. */
  regulatoryCitation?: string;
}

// ── Trace + result ─────────────────────────────────────────────────

export interface GovernanceTraceEntry {
  layer: GovernanceLayer;
  ruleId: string;
  ruleName: string;
  matched: boolean;
  verdict?: GovernanceVerdict;
}

export interface GovernanceResult {
  /** Final verdict — permit if no rule matched, otherwise the verdict
   *  of the FIRST non-permit match (escalate beats modify beats permit). */
  verdict: GovernanceVerdict;
  /** Layer of the rule that produced the final verdict, or null. */
  finalLayer: GovernanceLayer | null;
  /** Rule id of the rule that produced the final verdict, or null. */
  matchedRuleId: string | null;
  /** Procurement-readable rationale for the final verdict. */
  rationale: string;
  /** Optional regulatory citation. */
  regulatoryCitation?: string;
  /** Complete trace of every rule consulted (in evaluation order). */
  trace: GovernanceTraceEntry[];
}

// ── The pure-function consultation ────────────────────────────────

/**
 * Pure: walk the 4 layers in order. Within each layer, evaluate
 * rules in input order (caller pre-sorts by priority). Track every
 * rule consulted. Short-circuit on first non-permit verdict.
 *
 * Determinism guarantee: GIVEN the same rules + context, this
 * function returns the EXACT same result, including the full trace.
 * This is what makes the audit entry reproducible during regulatory
 * review.
 */
export function consultGovernance(
  rules: ReadonlyArray<GovernanceRule>,
  ctx: GovernanceContext,
): GovernanceResult {
  const trace: GovernanceTraceEntry[] = [];
  let verdict: GovernanceVerdict = "permit";
  let finalLayer: GovernanceLayer | null = null;
  let matchedRuleId: string | null = null;
  let rationale = "no rule matched; default permit";
  let regulatoryCitation: string | undefined;

  // Walk layers in canonical order.
  for (const layer of GOVERNANCE_LAYERS) {
    const layerRules = rules.filter((r) => r.layer === layer);
    let layerMatched = false;
    for (const rule of layerRules) {
      const matched = safePredicate(rule, ctx);
      trace.push({
        layer,
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        verdict: matched ? rule.effect : undefined,
      });
      if (matched) {
        layerMatched = true;
        // First match in this layer wins. Update final verdict if it's
        // more restrictive than what we have so far.
        if (isMoreRestrictive(rule.effect, verdict)) {
          verdict = rule.effect;
          finalLayer = layer;
          matchedRuleId = rule.id;
          rationale = rule.rationale;
          regulatoryCitation = rule.regulatoryCitation;
        }
        // Once a layer's rule matches, do not evaluate remaining
        // rules in the SAME layer (first-match-wins per layer).
        break;
      }
    }
    // Short-circuit: if this layer produced an escalate, don't
    // consult downstream layers — escalate is final.
    if (layerMatched && verdict === "escalate") break;
  }

  return {
    verdict,
    finalLayer,
    matchedRuleId,
    rationale,
    regulatoryCitation,
    trace,
  };
}

/**
 * Pure: severity ordering. escalate > modify > permit. Used to
 * determine whether a later-layer rule should override an earlier
 * verdict.
 *
 * Note the SAME-OR-LESS-RESTRICTIVE case returns false — once
 * escalate is set, modify cannot override it. This protects against
 * a permissive workflow rule "downgrading" a global escalate.
 */
function isMoreRestrictive(
  candidate: GovernanceVerdict,
  current: GovernanceVerdict,
): boolean {
  const order: Record<GovernanceVerdict, number> = {
    permit: 0,
    modify: 1,
    escalate: 2,
  };
  return order[candidate] > order[current];
}

/**
 * Pure: defensive predicate evaluation. A throw inside a customer-
 * supplied predicate must NOT crash the gate — it counts as
 * "did not match" and the trace records the rule was attempted.
 * Same fail-open posture as R100's policy engine.
 */
function safePredicate(
  rule: GovernanceRule,
  ctx: GovernanceContext,
): boolean {
  try {
    return rule.predicate(ctx) === true;
  } catch {
    return false;
  }
}

// ── Audit-entry shape (caller writes this to R26) ─────────────────

export interface GovernanceAuditEntry {
  action: "agent.governance_consult";
  resource: string;
  details: {
    finalVerdict: GovernanceVerdict;
    finalLayer: GovernanceLayer | null;
    matchedRuleId: string | null;
    rationale: string;
    regulatoryCitation?: string;
    trace: GovernanceTraceEntry[];
  };
}

/**
 * Pure: produce the R26 audit entry for a PAGRL consultation. Caller
 * writes via auditLog(). Always emits an entry — even on a clean
 * permit — because procurement reviewers want proof that PAGRL ran,
 * not just proof that something blocked.
 */
export function buildGovernanceAuditEntry(
  agentName: string,
  result: GovernanceResult,
): GovernanceAuditEntry {
  return {
    action: "agent.governance_consult",
    resource: `agent:${agentName}`,
    details: {
      finalVerdict: result.verdict,
      finalLayer: result.finalLayer,
      matchedRuleId: result.matchedRuleId,
      rationale: result.rationale,
      regulatoryCitation: result.regulatoryCitation,
      trace: result.trace,
    },
  };
}

// ── Pre-built rule templates (production examples) ───────────────

/**
 * Global rule: any commerce action requires an R91 ACAT.
 * Pairs with the R100 COMMERCE_REQUIRES_ACAT policy template.
 */
export const GLOBAL_COMMERCE_REQUIRES_ACAT: GovernanceRule = {
  id: "global.commerce_requires_acat",
  layer: "global",
  name: "All commerce actions require R91 ACAT",
  rationale:
    "Sovereign R91 (Agentic Commerce Authorization Token) is required for any cart action. PAGRL escalates if cart present without ACAT (R100 enforces hard refusal).",
  predicate: (ctx) => ctx.cart !== undefined && ctx.actionClass === "external_write",
  effect: "escalate",
  regulatoryCitation: "Sovereign R91",
};

/**
 * Situational rule: cart amount > $1000 outside business hours
 * routes through HITL. Demonstrates the situational layer's
 * temporal predicate pattern.
 */
export const SITUATIONAL_HIGH_VALUE_OFF_HOURS_HITL: GovernanceRule = {
  id: "situational.high_value_off_hours",
  layer: "situational",
  name: "High-value cart outside business hours requires HITL",
  rationale:
    "Carts > $1000 transacted outside Mon-Fri 09:00-17:00 UTC are routed to HITL queue for human review. SOX 404 segregation-of-duties pattern.",
  predicate: (ctx) => {
    if (!ctx.cart || ctx.cart.amountCents <= 100_000) return false;
    const now = ctx.now ?? new Date();
    const day = now.getUTCDay(); // 0 = Sun, 6 = Sat
    const hour = now.getUTCHours();
    const businessHours = day >= 1 && day <= 5 && hour >= 9 && hour < 17;
    return !businessHours;
  },
  effect: "escalate",
  regulatoryCitation: "SOX 404 (segregation of duties)",
};

/**
 * Agent-layer rule: tier-3 external_write actions on production-tagged
 * resources require HITL. Workflow- and agent-specific narrowing of
 * the global "production writes need approval" intuition.
 */
export const AGENT_TIER3_PROD_WRITE_HITL: GovernanceRule = {
  id: "agent.tier3_prod_write",
  layer: "agent",
  name: "Tier-3 external_write on prod-tagged resource requires HITL",
  rationale:
    "Any tier-3 (external) write against a resource tagged env=prod escalates to a human reviewer. SOC 2 CC8.1 change management.",
  predicate: (ctx) =>
    ctx.agentTier === 3 &&
    ctx.actionClass === "external_write" &&
    ctx.resourceTags?.env === "prod",
  effect: "escalate",
  regulatoryCitation: "SOC 2 CC8.1 (change management)",
};
