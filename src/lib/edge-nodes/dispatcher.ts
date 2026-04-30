/**
 * EDGE NODE DISPATCHER — pure-function routing + plan composition.
 *
 * Caller assembles the dispatch context (R100 policy decision, R102
 * cost verdict, R37 ACT presence, R91 ACAT presence). The pure
 * functions in this file decide: is this dispatch allowed? which
 * Edge Node should receive it? what does the receipt look like?
 *
 * The actual `node.dispatch()` call (impure — network / process /
 * etc.) is invoked by a thin runtime wrapper that composes:
 *   policy → plan → node.dispatch() → audit-chain append.
 *
 * Pure-function design = inspector-portable. A customer auditing
 * "would the platform have dispatched my task X to node Y?" can
 * replay these decisions offline.
 */

import type {
  EdgeNodeCapability,
  EdgeNodeDeployment,
  EdgeNodePersona,
  DispatchRequest,
  DispatchResult,
  EdgeNodeManifest,
} from "./types";
import { findEdgeNodesByCapability, type EdgeNodeRegistry } from "./registry";

// ── Plan: pre-flight resolution ───────────────────────────────────

/**
 * Pre-flight resolution from dispatch request → routing decision.
 * Pure function. Caller wraps with policy + cost gates BEFORE
 * invoking node.dispatch().
 */
export type RoutingDecision =
  | {
      kind: "route";
      target: EdgeNodeManifest;
      score: number;
      rationale: string;
      alternatives: Array<{
        manifest: EdgeNodeManifest;
        score: number;
      }>;
    }
  | {
      kind: "no-match";
      reason: "no_node_supports_capability";
      capability: EdgeNodeCapability;
    }
  | {
      kind: "all-stub";
      best: EdgeNodeManifest;
      reason: "only_stubs_available";
    };

/**
 * Pure: pick the best Edge Node for a dispatch request.
 *
 *   1. Find candidates by capability (and optionally deployment).
 *   2. If no candidates → no-match.
 *   3. If all candidates are stubs → all-stub (caller decides
 *      whether to proceed and surface a procurement-readable error).
 *   4. Otherwise route to the highest-scoring real node.
 *
 * This is the OUTER routing layer. R100 policy + R102 cost run
 * AFTER this picks a target — caller composes them.
 */
export function resolveRouting(
  registry: EdgeNodeRegistry,
  request: {
    capability: EdgeNodeCapability;
    deployment?: EdgeNodeDeployment;
    persona?: EdgeNodePersona;
  },
): RoutingDecision {
  const candidates = findEdgeNodesByCapability(
    registry,
    request.capability,
    request.deployment,
  );
  const filtered = request.persona
    ? candidates.filter((c) => c.manifest.persona === request.persona)
    : candidates;

  if (filtered.length === 0) {
    return {
      kind: "no-match",
      reason: "no_node_supports_capability",
      capability: request.capability,
    };
  }
  const allStubs = filtered.every((c) => c.isStub);
  if (allStubs) {
    return {
      kind: "all-stub",
      best: filtered[0].manifest,
      reason: "only_stubs_available",
    };
  }
  // First non-stub wins (already sorted by score).
  const realFirst = filtered.find((c) => !c.isStub) ?? filtered[0];
  return {
    kind: "route",
    target: realFirst.manifest,
    score: realFirst.score,
    rationale: realFirst.rationale,
    alternatives: filtered.slice(0, 5).map((c) => ({
      manifest: c.manifest,
      score: c.score,
    })),
  };
}

// ── Pure: pre-conditions over the dispatch request ───────────────

/**
 * Pure-function check that runs BEFORE node.dispatch(). The caller
 * provides the policy verdict, cost verdict, and ACT/ACAT presence.
 * This function combines them into a single go/no-go.
 *
 * Order matters — return the FIRST blocker, not all of them, so the
 * audit-chain entry has a single deterministic reason.
 */
export type Preflight =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "policy_denied"
        | "budget_exhausted"
        | "act_required"
        | "acat_required";
      details?: string;
    };

export function preflightDispatch(input: {
  policy:
    | { decision: "allow" }
    | { decision: "deny"; reason: string }
    | { decision: "require-act" }
    | { decision: "require-acat" };
  cost: { decision: "proceed" } | { decision: "deny"; reason: string };
  request: DispatchRequest;
}): Preflight {
  // Policy first — least-effort path. Even budget-OK calls are
  // refused if policy says no.
  if (input.policy.decision === "deny") {
    return {
      ok: false,
      reason: "policy_denied",
      details: input.policy.reason,
    };
  }
  if (input.policy.decision === "require-act") {
    if (!input.request.actChainHash) {
      return { ok: false, reason: "act_required" };
    }
  }
  if (input.policy.decision === "require-acat") {
    if (!input.request.acatChainHash) {
      return { ok: false, reason: "acat_required" };
    }
  }
  if (input.cost.decision === "deny") {
    return {
      ok: false,
      reason: "budget_exhausted",
      details: input.cost.reason,
    };
  }
  return { ok: true };
}

// ── Pure: synthesize a procurement-readable receipt ─────────────

/**
 * Pure: produce the receipt line that gets written to the R26
 * audit chain on every dispatch (success or failure). Procurement
 * teams read these without source code in hand.
 */
export function dispatchReceiptLine(input: {
  request: DispatchRequest;
  outcome: DispatchResult;
}): string {
  const { request, outcome } = input;
  const head = `[edge-node-dispatch] user=${request.userId} cap=${request.capability}`;
  if (outcome.ok) {
    return `${head} → ok via ${outcome.edgeNodeId} (${outcome.durationMs}ms, ${outcome.costCents}¢)`;
  }
  const detail = outcome.details ? ` — ${outcome.details}` : "";
  return `${head} → REFUSED via ${outcome.edgeNodeId} (${outcome.reason})${detail}`;
}

// ── Pure: assemble the full dispatch failure result ──────────────

/**
 * Pure: when preflight refuses (policy / cost / act / acat), the
 * caller materializes a DispatchResult without ever calling the
 * Edge Node. This helper builds the procurement-readable failure.
 */
export function buildPreflightFailure(input: {
  edgeNodeId: string;
  request: DispatchRequest;
  preflight: Extract<Preflight, { ok: false }>;
}): DispatchResult {
  const head = `[edge-node-dispatch] user=${input.request.userId} cap=${input.request.capability}`;
  return {
    ok: false,
    edgeNodeId: input.edgeNodeId,
    capability: input.request.capability,
    reason: input.preflight.reason,
    details: input.preflight.details,
    receiptLine: `${head} → REFUSED preflight (${input.preflight.reason})${
      input.preflight.details ? ` — ${input.preflight.details}` : ""
    }`,
  };
}
