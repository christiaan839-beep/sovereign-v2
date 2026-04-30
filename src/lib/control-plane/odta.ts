/**
 * R143 ODTA RUNTIME-PLACEMENT TEST — Move 6 of the proof-conversion
 * arc. Pure-function 4-predicate gate that MUST pass before any
 * state-changing agent action dispatches.
 *
 * STRATEGIC PURPOSE:
 *
 *   The "Beyond Task Success: An Evidence-Synthesis Framework"
 *   paper (April 2026) identifies the governance-to-action closure
 *   gap: evaluation tells us whether outcomes were good, governance
 *   defines what should be allowed, but neither identifies WHERE
 *   obligations bind to concrete actions or HOW compliance can later
 *   be proven.
 *
 *   ODTA is the missing test — four pure-function predicates run as
 *   a precondition on every state-changing dispatch:
 *
 *     O — Observability:  Can this action's effects be monitored?
 *     D — Decidability:   Did a policy engine produce a verdict?
 *     T — Timeliness:     Was the verdict produced fast enough for
 *                         production workflows? (default ≤ 50ms)
 *     A — Attestability:  Will this action receive an R26 audit
 *                         entry that can be replayed offline?
 *
 *   An action that fails ANY of the four predicates does not
 *   dispatch. The named failure surface (which predicate failed)
 *   becomes part of the audit entry, so SOC 2 / EU AI Act / NIST
 *   reviewers can filter on the precise failure mode.
 *
 * COMPOSITION WITH SHIPPED PRIMITIVES:
 *
 *   The 4 predicates are HOOKS — caller injects them. This keeps
 *   ODTA a pure function that ports to inspector. Typical wiring:
 *
 *     - hasObservabilityProbe: returns true iff AgentSight (or the
 *       output verifier) is configured to trace this action class
 *     - hasPolicyDecision:     true iff R100 policy gate produced a
 *       verdict (allow / deny / require-hitl / require-acat)
 *     - policyLatencyMs:       measured upstream — typically the
 *       time R100's evaluatePolicies took
 *     - hasAttestableAuditEntry: true iff the dispatcher will write
 *       to R26 audit-log with a non-empty action + resource
 *
 * SAFETY POSTURE:
 *
 *   1. Default-OFF via SOVEREIGN_ODTA_GATE_ENABLED. Same posture as
 *      R100 / R140 / R142 gates.
 *   2. Pure-function. No I/O. No clocks. Ports to inspector.
 *   3. Composes downstream of R142 PAGRL — runs AFTER consultation
 *      + enforcement, BEFORE dispatch. Never displaces upstream
 *      verdicts; only adds a structural soundness check.
 *   4. Audit emission uses `agent.governance_consult` action (R142
 *      vocabulary, already on disk). The `failed` array names the
 *      specific predicates that didn't pass.
 */

// ── Feature flag ───────────────────────────────────────────────────

export function isODTAGateEnabled(): boolean {
  return process.env.SOVEREIGN_ODTA_GATE_ENABLED === "true";
}

// ── The four named predicates ─────────────────────────────────────

export type ODTAPredicate =
  | "observability"
  | "decidability"
  | "timeliness"
  | "attestability";

export const ODTA_PREDICATES: ReadonlyArray<ODTAPredicate> = [
  "observability",
  "decidability",
  "timeliness",
  "attestability",
];

// ── Default timeliness budget ─────────────────────────────────────

/**
 * Default timeliness budget in milliseconds. The "Beyond Task Success"
 * paper notes that policy decisions taking > ~50ms in production
 * pipelines either get bypassed (security violation) or starve
 * downstream workflows. Per-deployment override via input.
 */
export const ODTA_TIMELINESS_BUDGET_MS = 50;

// ── Input + result shapes ─────────────────────────────────────────

/**
 * Caller-supplied evidence for each of the four predicates. Keep
 * shape small and unambiguous so audit-entries are stable.
 */
export interface ODTAInput {
  /** Stable agent id for audit linkage. */
  agentName: string;
  /** Procurement-readable identifier of the action being dispatched. */
  actionDescriptor: string;
  /** O — was an observability probe configured for this action class? */
  hasObservabilityProbe: boolean;
  /** D — did a policy engine produce a non-null verdict? */
  hasPolicyDecision: boolean;
  /** T — measured policy-decision latency in milliseconds. */
  policyLatencyMs: number;
  /** A — will this action receive an R26 audit entry? */
  hasAttestableAuditEntry: boolean;
  /** Optional override for ODTA_TIMELINESS_BUDGET_MS. */
  timelinessBudgetMs?: number;
}

export type ODTAResult =
  | {
      ok: true;
      passes: { observability: true; decidability: true; timeliness: true; attestability: true };
      timelinessBudgetMs: number;
    }
  | {
      ok: false;
      failed: ReadonlyArray<ODTAPredicate>;
      details: string;
      timelinessBudgetMs: number;
      /** R26 audit-entry payload caller writes through auditLog(). */
      auditEntry: {
        action: "agent.governance_consult";
        resource: string;
        details: {
          phase: "odta";
          failed: ReadonlyArray<ODTAPredicate>;
          policyLatencyMs: number;
          timelinessBudgetMs: number;
          actionDescriptor: string;
        };
      };
    };

// ── The pure-function evaluator ───────────────────────────────────

/**
 * Pure: evaluate all four predicates. Any predicate failing causes
 * the result to be `ok: false` with the named failure(s) in the
 * `failed` array. Multiple failures are reported together — caller
 * sees the complete picture, not just the first failure.
 *
 * If the caller has not enabled the ODTA gate (default), this returns
 * `ok: true` with all-passes. Same posture as the other gates.
 */
export function evaluateODTA(input: ODTAInput): ODTAResult {
  // Gate disabled → pass-through. Never blocks when flag off.
  if (!isODTAGateEnabled()) {
    return {
      ok: true,
      passes: { observability: true, decidability: true, timeliness: true, attestability: true },
      timelinessBudgetMs: input.timelinessBudgetMs ?? ODTA_TIMELINESS_BUDGET_MS,
    };
  }

  const budget = input.timelinessBudgetMs ?? ODTA_TIMELINESS_BUDGET_MS;
  const failed: ODTAPredicate[] = [];

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

  const details = buildODTADetails(failed, input.policyLatencyMs, budget);
  return {
    ok: false,
    failed,
    details,
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

/** Pure: procurement-readable details summary capped at 200 chars. */
function buildODTADetails(
  failed: ReadonlyArray<ODTAPredicate>,
  policyLatencyMs: number,
  budgetMs: number,
): string {
  const parts: string[] = [];
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
