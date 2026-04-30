/**
 * AGENT-FACTORY POLICY GATE — Move 2 of the proof-conversion arc.
 *
 * Wires R100 Policy Engine into the agent factory's execution path.
 * Default-OFF — gated behind SOVEREIGN_POLICY_GATE_ENABLED=true env
 * var so existing 223 agents continue to flow without behavior change.
 *
 * STRATEGIC PURPOSE:
 *
 *   Until this module, R100 was a beautifully tested pure function
 *   with zero impact on real agent execution. After this module is
 *   wired in (one call site in src/lib/agent-factory.ts), specific
 *   agents can carry a `policies: PolicyRule[]` field that GATES
 *   their execution — a denied policy means the handler never runs.
 *
 * SAFETY POSTURE:
 *
 *   1. Feature-flagged via env var. SOVEREIGN_POLICY_GATE_ENABLED=true
 *      to opt in. Without the flag, this module is a no-op even if
 *      an agent declares policies.
 *
 *   2. Per-agent opt-in. An agent without `config.policies` is
 *      transparent to this module regardless of the flag. The 222
 *      existing agents that don't declare policies see no change.
 *
 *   3. Pure-function evaluation. The decision is computed via R100's
 *      `evaluatePolicies` — already 36 tests covering every predicate.
 *
 *   4. Procurement-readable refusal. When a policy denies, the
 *      response includes the matched policy name + reason + (if
 *      eligible) break-glass eligibility. Auditors get receipts,
 *      not 500s.
 *
 *   5. R26 audit chain entry on denial. Every policy refusal is
 *      written to the audit chain so SOC 2 + EU AI Act auditors
 *      see proof of enforcement.
 *
 * COMPOSITION:
 *
 *   - R100 Policy Engine (src/lib/control-plane/policy-engine.ts)
 *   - R26 audit log (src/lib/audit-log.ts)
 *   - Agent factory (src/lib/agent-factory.ts) — single call site
 */

import {
  evaluatePolicies,
  type PolicyRule,
  type PolicyDecision,
  type PolicyContext,
} from "@/lib/control-plane/policy-engine";
import type { LetterGrade } from "@/lib/agent-reputation";

// ── Feature flag ──────────────────────────────────────────────────

/**
 * Pure: read the feature flag at evaluation time. Module-load cache
 * intentionally avoided — operators flipping the env var without
 * a redeploy is a critical incident-response capability.
 */
export function isPolicyGateEnabled(): boolean {
  return process.env.SOVEREIGN_POLICY_GATE_ENABLED === "true";
}

// ── Gate input shape (what the agent factory passes us) ──────────

export interface PolicyGateInput {
  /** Agent name from AgentConfig (used as agentId in policy context). */
  agentName: string;
  /** Policies declared on the AgentConfig. May be undefined. */
  policies?: ReadonlyArray<PolicyRule>;
  /** Authenticated user invoking the agent. */
  userId: string;
  /** Tenant id for multi-tenant scoping (resolved upstream). */
  tenantId?: string;
  /** Org scope if applicable. */
  orgId?: string;
  /** Action tier from AgentConfig (1=read-only, 2=writes, 3=external). */
  agentTier: 1 | 2 | 3;
  /** Optional reputation grade snapshot (R40). */
  reputationGrade?: LetterGrade;
  /** Optional credit-line headroom (R42, in cents). */
  creditHeadroomCents?: number;
  /** Optional ACT chain hash present (R37). */
  actPresent?: boolean;
  /** Optional ACAT presence + scope (R91). */
  acat?: PolicyContext["acat"];
  /** Optional cart context for commerce paths. */
  cart?: PolicyContext["cart"];
  /** Resource tags from request body / headers (free-form per tenant). */
  resourceTags?: Record<string, string>;
  /** Caller-supplied — for testability. */
  now?: Date;
}

// ── Gate verdict (what we return to the agent factory) ──────────

export type PolicyGateVerdict =
  | {
      proceed: true;
      reason: "gate_disabled" | "no_policies" | "policy_allowed";
      matchedPolicyName?: string;
    }
  | {
      proceed: false;
      reason: "policy_denied" | "act_required" | "acat_required" | "hitl_required";
      decision: PolicyDecision;
      /** Procurement-readable response body the factory returns. */
      response: {
        error: "policy_gate_refused";
        policyName: string;
        verdict: PolicyDecision["verdict"];
        rationale: string;
        breakGlassEligible: boolean;
        regulatoryCitation?: string;
      };
      /** Audit log entry the factory writes to R26. */
      auditEntry: {
        action: "agent.policy_gate.deny";
        resource: string;
        details: Record<string, unknown>;
      };
    };

// ── Pure: gate evaluator ─────────────────────────────────────────

/**
 * Pure: evaluate the policy gate for an agent execution attempt.
 *
 * Call sites: src/lib/agent-factory.ts only (single call site to
 * minimize blast radius).
 *
 * Behavior:
 *   - If gate disabled → proceed with reason "gate_disabled".
 *   - If no policies → proceed with reason "no_policies".
 *   - If R100 returns allow → proceed with reason "policy_allowed".
 *   - Otherwise → block with the appropriate verdict + audit entry.
 *
 * No I/O. The factory is responsible for actually writing the audit
 * entry to R26 and producing the HTTP response from `response`.
 */
export function evaluatePolicyGate(
  input: PolicyGateInput,
): PolicyGateVerdict {
  if (!isPolicyGateEnabled()) {
    return { proceed: true, reason: "gate_disabled" };
  }
  if (!input.policies || input.policies.length === 0) {
    return { proceed: true, reason: "no_policies" };
  }

  const ctx: PolicyContext = {
    userId: input.userId,
    agentId: input.agentName,
    agentTier: input.agentTier,
    reputationGrade: input.reputationGrade,
    creditHeadroomCents: input.creditHeadroomCents,
    actPresent: input.actPresent,
    acat: input.acat,
    cart: input.cart,
    resourceTags: input.resourceTags,
    now: input.now,
  };

  const decision = evaluatePolicies(input.policies, ctx);

  if (decision.verdict === "allow") {
    return {
      proceed: true,
      reason: "policy_allowed",
      matchedPolicyName: decision.matchedPolicyName,
    };
  }

  // For verdicts we want to surface as block:
  //   deny / require-hitl / require-acat / require-attestation
  // (require-break-glass renders as deny per R100 design)
  const matchedName =
    decision.matchedPolicyName === "default"
      ? "(no matching policy)"
      : decision.matchedPolicyName;
  const rationale = decision.reason;
  const breakGlassEligible =
    decision.matchedPolicyName !== "default" &&
    "breakGlassEligible" in decision &&
    decision.breakGlassEligible === true;
  const regulatoryCitation =
    "regulatoryCitation" in decision ? decision.regulatoryCitation : undefined;

  // Map verdict → block reason
  let blockReason: Extract<PolicyGateVerdict, { proceed: false }>["reason"];
  switch (decision.verdict) {
    case "deny":
      blockReason = "policy_denied";
      break;
    case "require-hitl":
      blockReason = "hitl_required";
      break;
    case "require-acat":
      blockReason = "acat_required";
      break;
    case "require-attestation":
      blockReason = "policy_denied"; // generic block — attestation not yet wired
      break;
  }

  return {
    proceed: false,
    reason: blockReason,
    decision,
    response: {
      error: "policy_gate_refused",
      policyName: matchedName,
      verdict: decision.verdict,
      rationale,
      breakGlassEligible,
      regulatoryCitation,
    },
    auditEntry: {
      action: "agent.policy_gate.deny",
      resource: `agent:${input.agentName}`,
      details: {
        policyName: matchedName,
        verdict: decision.verdict,
        rationale,
        userId: input.userId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentTier: input.agentTier,
        breakGlassEligible,
        regulatoryCitation,
      },
    },
  };
}
