/**
 * @sovereign/inspector — R142 PAGRL + R143 ODTA (Move 6).
 *
 * Pure-function port of src/lib/control-plane/{governance,odta}.ts to
 * standalone Node ESM. Same 4-layer consultation order, same severity
 * ordering, same first-match-wins semantics. Same 4 ODTA predicates,
 * same canonical failure-name set.
 *
 * Strategic property: when Sovereign claims "this state-changing action
 * was governed by these rules and passed runtime placement," a customer
 * or auditor uses this module to:
 *   1. Replay the governance consultation against the rule set + context
 *      and confirm the verdict produced matches what was claimed.
 *   2. Verify ODTA predicates given the same evidence inputs.
 *   3. Reproduce the audit-entry payload that R26 received.
 * No Sovereign network call required.
 *
 * Coverage:
 *   - GOVERNANCE_LAYERS canonical order
 *   - consultGovernance (4-layer walk, severity ordering, short-circuit)
 *   - buildGovernanceAuditEntry
 *   - ODTA_PREDICATES, ODTA_TIMELINESS_BUDGET_MS
 *   - evaluateODTA (4 predicates, multi-failure aggregation, custom budget)
 */

// ── Layer + verdict taxonomy ─────────────────────────────────────

export const GOVERNANCE_LAYERS = ["global", "workflow", "agent", "situational"];

const VERDICT_ORDER = { permit: 0, modify: 1, escalate: 2 };

function isMoreRestrictive(candidate, current) {
  return VERDICT_ORDER[candidate] > VERDICT_ORDER[current];
}

function safePredicate(rule, ctx) {
  try {
    return rule.predicate(ctx) === true;
  } catch {
    return false;
  }
}

// ── PAGRL consultation ────────────────────────────────────────────

export function consultGovernance(rules, ctx) {
  const trace = [];
  let verdict = "permit";
  let finalLayer = null;
  let matchedRuleId = null;
  let rationale = "no rule matched; default permit";
  let regulatoryCitation;

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
        if (isMoreRestrictive(rule.effect, verdict)) {
          verdict = rule.effect;
          finalLayer = layer;
          matchedRuleId = rule.id;
          rationale = rule.rationale;
          regulatoryCitation = rule.regulatoryCitation;
        }
        break;
      }
    }
    if (layerMatched && verdict === "escalate") break;
  }

  return { verdict, finalLayer, matchedRuleId, rationale, regulatoryCitation, trace };
}

export function buildGovernanceAuditEntry(agentName, result) {
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

// ── ODTA test ────────────────────────────────────────────────────

export const ODTA_PREDICATES = ["observability", "decidability", "timeliness", "attestability"];
export const ODTA_TIMELINESS_BUDGET_MS = 50;

function buildODTADetails(failed, policyLatencyMs, budgetMs) {
  const parts = [];
  for (const f of failed) {
    switch (f) {
      case "observability":
        parts.push("no observability probe configured for this action class");
        break;
      case "decidability":
        parts.push("no policy verdict was produced upstream");
        break;
      case "timeliness":
        parts.push(`policy decision took ${policyLatencyMs}ms (budget ${budgetMs}ms)`);
        break;
      case "attestability":
        parts.push("no R26 audit entry will be written");
        break;
    }
  }
  return `ODTA failed: ${parts.join("; ")}`.slice(0, 200);
}

/**
 * Pure: inspector-side replay of evaluateODTA. Note this version does
 * NOT consult an env var — when used for offline verification, the
 * inspector ALWAYS evaluates the predicates (otherwise the customer
 * could not check whether the platform's ODTA gate worked).
 */
export function evaluateODTA(input) {
  const budget = input.timelinessBudgetMs ?? ODTA_TIMELINESS_BUDGET_MS;
  const failed = [];

  if (!input.hasObservabilityProbe) failed.push("observability");
  if (!input.hasPolicyDecision) failed.push("decidability");
  if (!Number.isFinite(input.policyLatencyMs) || input.policyLatencyMs > budget) {
    failed.push("timeliness");
  }
  if (!input.hasAttestableAuditEntry) failed.push("attestability");

  if (failed.length === 0) {
    return {
      ok: true,
      passes: { observability: true, decidability: true, timeliness: true, attestability: true },
      timelinessBudgetMs: budget,
    };
  }

  return {
    ok: false,
    failed,
    details: buildODTADetails(failed, input.policyLatencyMs, budget),
    timelinessBudgetMs: budget,
    auditEntry: {
      action: "agent.governance_consult",
      resource: `agent:${input.agentName}`,
      details: {
        phase: "odta",
        failed,
        policyLatencyMs: input.policyLatencyMs,
        timelinessBudgetMs: budget,
        actionDescriptor: input.actionDescriptor,
      },
    },
  };
}

// ── verify-governance-trace ───────────────────────────────────────

/**
 * High-level verifier used by the CLI. Given:
 *   - a rule set (with live predicates)
 *   - a context
 *   - a claimed result (verdict + matchedRuleId + finalLayer)
 * recompute the consultation locally and confirm the claimed verdict
 * matches. Returns a structured pass/fail.
 *
 * Note: predicates cannot serialize across JSON. For CLI use over a
 * stdin JSON pipe, use verifyGovernanceTraceStructure instead.
 */
export function verifyGovernanceTrace({ rules, context, claimed }) {
  const replay = consultGovernance(rules, context);
  const errors = [];
  if (replay.verdict !== claimed.verdict) {
    errors.push(`verdict mismatch: replay=${replay.verdict} claimed=${claimed.verdict}`);
  }
  if (replay.matchedRuleId !== claimed.matchedRuleId) {
    errors.push(
      `matched rule mismatch: replay=${replay.matchedRuleId} claimed=${claimed.matchedRuleId}`,
    );
  }
  if (replay.finalLayer !== claimed.finalLayer) {
    errors.push(
      `final layer mismatch: replay=${replay.finalLayer} claimed=${claimed.finalLayer}`,
    );
  }
  if (errors.length === 0) {
    return { ok: true, replay };
  }
  return { ok: false, errors, replay };
}

/**
 * Structural verifier — accepts ONLY the trace + claimed result. Used
 * by the CLI because predicates don't survive JSON. Confirms the trace
 * is internally consistent with PAGRL semantics:
 *
 *   1. Layers in the trace appear in canonical order (no out-of-order
 *      entries; an entry at layer N cannot appear before all entries
 *      at layer N-1 are exhausted).
 *   2. At most one matched=true entry per layer (first-match-wins).
 *   3. The claimed verdict is the most-restrictive verdict among
 *      matched-entry effects.
 *   4. The claimed matchedRuleId references an actual matched entry,
 *      and that entry sits at the claimed finalLayer.
 *   5. No entry appears in the trace AFTER a matched escalate
 *      (short-circuit guarantee).
 */
export function verifyGovernanceTraceStructure({ trace, claimed }) {
  const errors = [];
  if (!Array.isArray(trace)) {
    return { ok: false, errors: ["trace must be an array"] };
  }

  // (1) layer ordering
  const layerIndex = (l) => GOVERNANCE_LAYERS.indexOf(l);
  for (let i = 1; i < trace.length; i++) {
    if (layerIndex(trace[i].layer) < layerIndex(trace[i - 1].layer)) {
      errors.push(
        `layer out of canonical order at index ${i}: ${trace[i - 1].layer} → ${trace[i].layer}`,
      );
    }
  }

  // (2) at most one match per layer
  const matchedByLayer = {};
  for (const entry of trace) {
    if (entry.matched) {
      if (matchedByLayer[entry.layer]) {
        errors.push(`multiple matches in layer ${entry.layer} (first-match-wins violated)`);
      }
      matchedByLayer[entry.layer] = entry;
    }
  }

  // (3) claimed verdict is most-restrictive among matched entries
  const matchedEntries = trace.filter((t) => t.matched);
  let mostRestrictive = "permit";
  for (const e of matchedEntries) {
    if (VERDICT_ORDER[e.verdict] > VERDICT_ORDER[mostRestrictive]) {
      mostRestrictive = e.verdict;
    }
  }
  if (claimed.verdict !== mostRestrictive) {
    errors.push(
      `claimed verdict ${claimed.verdict} does not match most-restrictive matched-entry verdict ${mostRestrictive}`,
    );
  }

  // (4) matchedRuleId + finalLayer consistency
  if (claimed.matchedRuleId !== null) {
    const ref = trace.find((t) => t.matched && t.ruleId === claimed.matchedRuleId);
    if (!ref) {
      errors.push(`claimed matchedRuleId ${claimed.matchedRuleId} not found among matched entries`);
    } else if (ref.layer !== claimed.finalLayer) {
      errors.push(
        `claimed finalLayer ${claimed.finalLayer} does not match the layer of matched rule (${ref.layer})`,
      );
    } else if (ref.verdict !== claimed.verdict) {
      errors.push(
        `claimed matchedRuleId points to a rule with verdict ${ref.verdict} but claimed verdict is ${claimed.verdict}`,
      );
    }
  } else if (matchedEntries.length > 0 && claimed.verdict !== "permit") {
    errors.push("claimed matchedRuleId is null but the trace has matched entries");
  }

  // (5) no entries after escalate
  const escalateIdx = trace.findIndex((t) => t.matched && t.verdict === "escalate");
  if (escalateIdx !== -1) {
    const sameLayer = trace[escalateIdx].layer;
    const after = trace.slice(escalateIdx + 1);
    const violatingAfter = after.filter((t) => t.layer !== sameLayer);
    if (violatingAfter.length > 0) {
      errors.push(
        `${violatingAfter.length} trace entries appear after a matched escalate (short-circuit violated)`,
      );
    }
  }

  if (errors.length === 0) return { ok: true };
  return { ok: false, errors };
}
