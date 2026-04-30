/**
 * R155 CONFIDENCE-CALIBRATED HITL ROUTING — Move 9 of the proof-
 * conversion arc.
 *
 * Pure-function decision logic that consumes the upstream gate
 * verdicts (R100 policy / R140-R141 viability VI(t) / R143 ODTA)
 * and decides whether a state-changing action should:
 *
 *   - auto_proceed     — all upstream signals clean; do not gate on
 *                        a human; log the auto-pass for audit
 *   - silent_approval  — minor warn-level signals; record review but
 *                        do not block dispatch
 *   - hitl_required    — meaningful uncertainty; enqueue via the
 *                        existing src/lib/hitl-approval.ts queue
 *   - hard_deny        — R100 policy gate produced a hard deny;
 *                        no point bothering a human, refuse outright
 *
 * STRATEGIC PURPOSE:
 *
 *   The "human-in-the-loop" safety mechanism is at structural risk
 *   in 2026 due to APPROVAL FATIGUE: humans asked to approve too
 *   many agent actions stop paying attention — exactly when
 *   oversight is most needed. The Responsible AI Foundation analysis
 *   notes that >80% of agents currently require more manual oversight
 *   than they save in efficiency, and that organizations relying on
 *   blanket HITL will largely fail in 2026.
 *
 *   The fix is NOT to remove HITL — it's to ESCALATE INTELLIGENTLY.
 *   When all upstream gates produce clean signals (VI(t) high, R100
 *   allow, ODTA all-pass), there's no signal that warrants human
 *   attention. When even ONE gate produces meaningful uncertainty
 *   (drift detected, policy says require-hitl, ODTA timeliness fail),
 *   that's exactly the case humans CAN review productively.
 *
 *   Result: HITL queue gets only the cases where humans add value.
 *   Approval fatigue drops because the signal-to-noise ratio improves.
 *   This directly closes Gaps 9 (OWASP ASI09 trust exploitation) and
 *   41 (HITL fatigue) from the 73-gap inventory.
 *
 * SAFETY POSTURE:
 *
 *   1. Pure function. No I/O. No clocks (caller passes "now").
 *      Ports to inspector for offline replay.
 *   2. Default-OFF via SOVEREIGN_HITL_ROUTING_ENABLED. When off,
 *      every action returns "hitl_required" with reason="gate_disabled"
 *      — preserves the existing always-route-to-HITL behavior so
 *      enabling the gate is a strict improvement, never a regression.
 *      Note: this is the OPPOSITE of the other gates' default-OFF
 *      behavior, because this gate REDUCES escalations. Default-OFF
 *      means "be conservative; route everything to HITL."
 *   3. Always-HITL action classes. A configurable allowlist of action
 *      classes that ALWAYS escalate regardless of upstream signals
 *      (e.g., "delete_user_data", "cancel_subscription"). This is
 *      the procurement-readable safety floor.
 *   4. Composes with R100 gate's break-glass escape — if a policy
 *      verdict is hard-deny but break-glass-eligible, the decision
 *      stays hard_deny here (the human admin invoking break-glass
 *      is a separate path through R100's applyBreakGlass).
 */

import type { PolicyDecision } from "@/lib/control-plane/policy-engine";
import type { ViabilityScore, AgentActionClass } from "@/lib/control-plane/viability";
import type { ODTAResult } from "@/lib/control-plane/odta";

// ── Feature flag ───────────────────────────────────────────────────

/**
 * Pure: the gate enables the SMART routing. When off, every action
 * routes to HITL (conservative default — preserves prior behavior).
 */
export function isHITLRoutingEnabled(): boolean {
  return process.env.SOVEREIGN_HITL_ROUTING_ENABLED === "true";
}

// ── Decision taxonomy ─────────────────────────────────────────────

export type HITLRoutingKind =
  | "auto_proceed"
  | "silent_approval"
  | "hitl_required"
  | "hard_deny";

/** Why the routing landed where it did. Procurement-readable. */
export type HITLRoutingReason =
  | "gate_disabled"
  | "policy_deny"
  | "policy_requires_hitl"
  | "policy_requires_acat_missing"
  | "viability_below_block_threshold"
  | "viability_below_escalate_threshold"
  | "viability_warn"
  | "odta_failed"
  | "always_hitl_action_class"
  | "all_signals_clean";

// ── Input + decision shapes ───────────────────────────────────────

/**
 * The composite input to the routing decision. Caller assembles
 * verdicts from the upstream gates (each is its own pure function
 * already). All fields are optional EXCEPT actionClass + agentName,
 * because a deployment may have only some of the gates enabled.
 */
export interface HITLRoutingInput {
  agentName: string;
  actionClass: AgentActionClass;
  /** R100 policy gate verdict. */
  policyDecision?: PolicyDecision;
  /** Was R91 ACAT presented when the policy required it? */
  acatPresent?: boolean;
  /** R140/R141 viability score. */
  viabilityScore?: ViabilityScore;
  /** R143 ODTA result. */
  odtaResult?: ODTAResult;
  /** Configurable always-HITL action classes (procurement floor). */
  alwaysHITLClasses?: ReadonlyArray<AgentActionClass>;
}

/**
 * The structured decision. Trace records every signal that influenced
 * the outcome, in evaluation order, so SOC reviewers see WHY the
 * routing chose this path.
 */
export interface HITLRoutingTraceEntry {
  signal: string;
  observed: string;
  influence: "decided" | "considered";
}

export interface HITLRoutingDecision {
  kind: HITLRoutingKind;
  reason: HITLRoutingReason;
  /** Human-readable rationale (≤200 chars). */
  rationale: string;
  /** Optional regulatory citation when policy verdict drove the outcome. */
  regulatoryCitation?: string;
  /** Complete signal trace, ordered. */
  trace: HITLRoutingTraceEntry[];
}

// ── The pure-function evaluator ───────────────────────────────────

const ALWAYS_HITL_CLASSES_DEFAULT: ReadonlyArray<AgentActionClass> = [
  // No defaults — operators set per-deployment per their threat model.
];

/** Pure helper: defensive narrowing of regulatoryCitation across the
 *  PolicyDecision discriminated union (allow/default-deny variants
 *  do not carry the field). */
function extractRegulatoryCitation(
  decision: PolicyDecision,
): string | undefined {
  return "regulatoryCitation" in decision
    ? decision.regulatoryCitation
    : undefined;
}

/**
 * Pure: evaluate the routing decision for an action. Order matters —
 * a hard-deny short-circuits other signals; an always-HITL class is
 * checked AFTER hard-deny but BEFORE upstream gates so the procurement
 * floor cannot be bypassed.
 *
 * Signal evaluation order (deterministic):
 *   1. Gate disabled                  → hitl_required (conservative)
 *   2. Policy = deny                  → hard_deny
 *   3. Always-HITL action class       → hitl_required
 *   4. Policy = require-hitl          → hitl_required
 *   5. Policy = require-acat + missing→ hitl_required
 *   6. ODTA failed                    → hitl_required
 *   7. Viability "block"              → hitl_required (NOT hard_deny —
 *                                       drift can still be reviewed)
 *   8. Viability "escalate_hitl"      → hitl_required
 *   9. Viability "proceed" with warn  → silent_approval
 *  10. All clean                      → auto_proceed
 */
export function routeToHITL(input: HITLRoutingInput): HITLRoutingDecision {
  const trace: HITLRoutingTraceEntry[] = [];

  if (!isHITLRoutingEnabled()) {
    trace.push({ signal: "gate-flag", observed: "disabled", influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "gate_disabled",
      rationale: "HITL routing gate disabled — conservative default routes every action to human review",
      trace,
    };
  }

  // (2) Hard policy deny short-circuits.
  if (input.policyDecision?.verdict === "deny") {
    trace.push({
      signal: "policy",
      observed: "deny",
      influence: "decided",
    });
    return {
      kind: "hard_deny",
      reason: "policy_deny",
      rationale: input.policyDecision.reason ?? "policy gate produced a hard deny",
      regulatoryCitation: extractRegulatoryCitation(input.policyDecision),
      trace,
    };
  }

  // (3) Always-HITL procurement floor.
  const always = input.alwaysHITLClasses ?? ALWAYS_HITL_CLASSES_DEFAULT;
  if (always.includes(input.actionClass)) {
    trace.push({
      signal: "always-hitl-class",
      observed: input.actionClass,
      influence: "decided",
    });
    return {
      kind: "hitl_required",
      reason: "always_hitl_action_class",
      rationale: `action class ${input.actionClass} is on the always-HITL allowlist`,
      trace,
    };
  }

  // (4) Policy require-hitl.
  if (input.policyDecision?.verdict === "require-hitl") {
    trace.push({ signal: "policy", observed: "require-hitl", influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "policy_requires_hitl",
      rationale: input.policyDecision.reason ?? "policy gate requires human approval",
      regulatoryCitation: extractRegulatoryCitation(input.policyDecision),
      trace,
    };
  }

  // (5) Policy require-acat without an ACAT.
  if (
    input.policyDecision?.verdict === "require-acat" &&
    input.acatPresent !== true
  ) {
    trace.push({
      signal: "policy",
      observed: "require-acat (no ACAT present)",
      influence: "decided",
    });
    return {
      kind: "hitl_required",
      reason: "policy_requires_acat_missing",
      rationale: "policy requires R91 ACAT but none was presented; routing for human review",
      regulatoryCitation: extractRegulatoryCitation(input.policyDecision),
      trace,
    };
  } else if (input.policyDecision?.verdict === "require-acat") {
    trace.push({ signal: "policy", observed: "require-acat (ACAT present)", influence: "considered" });
  } else if (input.policyDecision?.verdict === "allow") {
    trace.push({ signal: "policy", observed: "allow", influence: "considered" });
  }

  // (6) ODTA failure.
  if (input.odtaResult && input.odtaResult.ok === false) {
    trace.push({
      signal: "odta",
      observed: `failed: ${input.odtaResult.failed.join(",")}`,
      influence: "decided",
    });
    return {
      kind: "hitl_required",
      reason: "odta_failed",
      rationale: `ODTA runtime placement failed: ${input.odtaResult.failed.join(", ")}`,
      trace,
    };
  } else if (input.odtaResult?.ok === true) {
    trace.push({ signal: "odta", observed: "all 4 predicates pass", influence: "considered" });
  }

  // (7) Viability block.
  if (input.viabilityScore?.recommendation === "block") {
    trace.push({
      signal: "viability",
      observed: `block (VI=${input.viabilityScore.vi.toFixed(2)})`,
      influence: "decided",
    });
    return {
      kind: "hitl_required",
      reason: "viability_below_block_threshold",
      rationale: `viability VI(t)=${input.viabilityScore.vi.toFixed(2)} below block threshold; ${input.viabilityScore.rationale}`,
      trace,
    };
  }

  // (8) Viability escalate.
  if (input.viabilityScore?.recommendation === "escalate_hitl") {
    trace.push({
      signal: "viability",
      observed: `escalate (VI=${input.viabilityScore.vi.toFixed(2)})`,
      influence: "decided",
    });
    return {
      kind: "hitl_required",
      reason: "viability_below_escalate_threshold",
      rationale: `viability VI(t)=${input.viabilityScore.vi.toFixed(2)} in escalate band; ${input.viabilityScore.rationale}`,
      trace,
    };
  }

  // Viability proceed but with non-zero penalties → warn-level signal.
  if (input.viabilityScore?.recommendation === "proceed") {
    const totalPenalty =
      (input.viabilityScore.penalties.kl ?? 0) +
      (input.viabilityScore.penalties.z ?? 0) +
      (input.viabilityScore.penalties.novelty ?? 0);
    if (totalPenalty > 0) {
      trace.push({
        signal: "viability",
        observed: `proceed with warn (VI=${input.viabilityScore.vi.toFixed(2)})`,
        influence: "decided",
      });
      return {
        kind: "silent_approval",
        reason: "viability_warn",
        rationale: `viability VI(t)=${input.viabilityScore.vi.toFixed(2)} acceptable but carries warn-level penalties; logging without HITL`,
        trace,
      };
    }
    trace.push({ signal: "viability", observed: "proceed (clean)", influence: "considered" });
  }

  // (10) All clean.
  trace.push({ signal: "composite", observed: "all signals clean", influence: "decided" });
  return {
    kind: "auto_proceed",
    reason: "all_signals_clean",
    rationale: "policy=allow, viability=proceed (clean), ODTA=ok, no always-HITL match",
    trace,
  };
}

// ── Audit-entry shape (caller fires per outcome) ──────────────────

export interface HITLRoutingAuditEntry {
  action: "agent.governance_consult";
  resource: string;
  details: {
    phase: "hitl-routing";
    kind: HITLRoutingKind;
    reason: HITLRoutingReason;
    rationale: string;
    regulatoryCitation?: string;
    trace: HITLRoutingTraceEntry[];
  };
}

/**
 * Pure: produce an audit entry for the routing decision. Reuses the
 * existing R142 audit action (agent.governance_consult) with a
 * "phase: hitl-routing" discriminator. Procurement reviewers see
 * the routing decision sit alongside PAGRL + ODTA in one filter.
 */
export function buildHITLRoutingAuditEntry(
  agentName: string,
  decision: HITLRoutingDecision,
): HITLRoutingAuditEntry {
  return {
    action: "agent.governance_consult",
    resource: `agent:${agentName}`,
    details: {
      phase: "hitl-routing",
      kind: decision.kind,
      reason: decision.reason,
      rationale: decision.rationale,
      regulatoryCitation: decision.regulatoryCitation,
      trace: decision.trace,
    },
  };
}
