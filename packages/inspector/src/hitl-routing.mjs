/**
 * @sovereign/inspector — R155 Confidence-Calibrated HITL Routing.
 *
 * Pure-function port of src/lib/control-plane/hitl-routing.ts. Customer
 * or auditor uses this module to replay an HITL routing decision
 * offline given the upstream gate inputs (policy verdict, viability
 * score, ODTA result) and confirm the decision claimed in the audit
 * entry was produced by the same algorithm.
 */

const ALWAYS_HITL_CLASSES_DEFAULT = [];

function extractRegulatoryCitation(decision) {
  return decision && "regulatoryCitation" in decision
    ? decision.regulatoryCitation
    : undefined;
}

export function routeToHITL(input, options = {}) {
  // Inspector port: the auditor wants to ALWAYS evaluate. The platform
  // checks the env flag; the inspector takes an explicit "gateEnabled"
  // option (default true).
  const trace = [];
  const gateEnabled = options.gateEnabled !== false;

  if (!gateEnabled) {
    trace.push({ signal: "gate-flag", observed: "disabled", influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "gate_disabled",
      rationale: "HITL routing gate disabled — conservative default routes every action to human review",
      trace,
    };
  }

  if (input.policyDecision?.verdict === "deny") {
    trace.push({ signal: "policy", observed: "deny", influence: "decided" });
    return {
      kind: "hard_deny",
      reason: "policy_deny",
      rationale: input.policyDecision.reason ?? "policy gate produced a hard deny",
      regulatoryCitation: extractRegulatoryCitation(input.policyDecision),
      trace,
    };
  }

  const always = input.alwaysHITLClasses ?? ALWAYS_HITL_CLASSES_DEFAULT;
  if (always.includes(input.actionClass)) {
    trace.push({ signal: "always-hitl-class", observed: input.actionClass, influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "always_hitl_action_class",
      rationale: `action class ${input.actionClass} is on the always-HITL allowlist`,
      trace,
    };
  }

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

  if (input.policyDecision?.verdict === "require-acat" && input.acatPresent !== true) {
    trace.push({ signal: "policy", observed: "require-acat (no ACAT present)", influence: "decided" });
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

  if (input.odtaResult && input.odtaResult.ok === false) {
    trace.push({ signal: "odta", observed: `failed: ${input.odtaResult.failed.join(",")}`, influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "odta_failed",
      rationale: `ODTA runtime placement failed: ${input.odtaResult.failed.join(", ")}`,
      trace,
    };
  } else if (input.odtaResult?.ok === true) {
    trace.push({ signal: "odta", observed: "all 4 predicates pass", influence: "considered" });
  }

  if (input.viabilityScore?.recommendation === "block") {
    trace.push({ signal: "viability", observed: `block (VI=${input.viabilityScore.vi.toFixed(2)})`, influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "viability_below_block_threshold",
      rationale: `viability VI(t)=${input.viabilityScore.vi.toFixed(2)} below block threshold; ${input.viabilityScore.rationale}`,
      trace,
    };
  }

  if (input.viabilityScore?.recommendation === "escalate_hitl") {
    trace.push({ signal: "viability", observed: `escalate (VI=${input.viabilityScore.vi.toFixed(2)})`, influence: "decided" });
    return {
      kind: "hitl_required",
      reason: "viability_below_escalate_threshold",
      rationale: `viability VI(t)=${input.viabilityScore.vi.toFixed(2)} in escalate band; ${input.viabilityScore.rationale}`,
      trace,
    };
  }

  if (input.viabilityScore?.recommendation === "proceed") {
    const totalPenalty =
      (input.viabilityScore.penalties.kl ?? 0) +
      (input.viabilityScore.penalties.z ?? 0) +
      (input.viabilityScore.penalties.novelty ?? 0);
    if (totalPenalty > 0) {
      trace.push({ signal: "viability", observed: `proceed with warn (VI=${input.viabilityScore.vi.toFixed(2)})`, influence: "decided" });
      return {
        kind: "silent_approval",
        reason: "viability_warn",
        rationale: `viability VI(t)=${input.viabilityScore.vi.toFixed(2)} acceptable but carries warn-level penalties; logging without HITL`,
        trace,
      };
    }
    trace.push({ signal: "viability", observed: "proceed (clean)", influence: "considered" });
  }

  trace.push({ signal: "composite", observed: "all signals clean", influence: "decided" });
  return {
    kind: "auto_proceed",
    reason: "all_signals_clean",
    rationale: "policy=allow, viability=proceed (clean), ODTA=ok, no always-HITL match",
    trace,
  };
}

/**
 * Replay-and-confirm helper. Recomputes the routing decision and
 * confirms the claimed kind + reason match. Trace equivalence is
 * checked by INFLUENCE on the same signals (not byte-for-byte trace
 * equality, since narrative wording can be tweaked between releases).
 */
export function verifyHITLRouting({ input, claimed }) {
  const replay = routeToHITL(input);
  const errors = [];
  if (replay.kind !== claimed.kind) {
    errors.push(`kind mismatch: replay=${replay.kind} claimed=${claimed.kind}`);
  }
  if (replay.reason !== claimed.reason) {
    errors.push(`reason mismatch: replay=${replay.reason} claimed=${claimed.reason}`);
  }
  if (errors.length === 0) return { ok: true, replay };
  return { ok: false, errors, replay };
}
