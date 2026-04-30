/**
 * R155 HITL Routing — pure-function decision-logic tests.
 *
 * Covers signal-priority ordering, default-OFF behavior, every named
 * routing reason, and the composite "all-signals-clean" path.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isHITLRoutingEnabled,
  routeToHITL,
  buildHITLRoutingAuditEntry,
  type HITLRoutingInput,
} from "../hitl-routing";
import type { PolicyDecision } from "@/lib/control-plane/policy-engine";
import type { ViabilityScore, AgentActionClass } from "@/lib/control-plane/viability";
import type { ODTAResult } from "@/lib/control-plane/odta";

const baseInput: HITLRoutingInput = {
  agentName: "agent-x",
  actionClass: "internal_read" as AgentActionClass,
};

const cleanViability: ViabilityScore = {
  vi: 1.0,
  recommendation: "proceed",
  rationale: "VI=1.00 (no drift)",
  penalties: { kl: 0, z: 0, novelty: 0 },
};

const cleanODTA: ODTAResult = {
  ok: true,
  passes: { observability: true, decidability: true, timeliness: true, attestability: true },
  timelinessBudgetMs: 50,
};

const allowPolicy: PolicyDecision = {
  verdict: "allow",
  matchedPolicyName: "test",
  reason: "test",
};

describe("isHITLRoutingEnabled", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.SOVEREIGN_HITL_ROUTING_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SOVEREIGN_HITL_ROUTING_ENABLED;
    else process.env.SOVEREIGN_HITL_ROUTING_ENABLED = original;
  });

  it("default false when unset", () => {
    delete process.env.SOVEREIGN_HITL_ROUTING_ENABLED;
    expect(isHITLRoutingEnabled()).toBe(false);
  });

  it("true only on exact 'true'", () => {
    process.env.SOVEREIGN_HITL_ROUTING_ENABLED = "true";
    expect(isHITLRoutingEnabled()).toBe(true);
  });
});

describe("routeToHITL — gate disabled (conservative default)", () => {
  it("returns hitl_required when gate is off (preserves prior route-everything behavior)", () => {
    delete process.env.SOVEREIGN_HITL_ROUTING_ENABLED;
    const r = routeToHITL(baseInput);
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("gate_disabled");
  });
});

describe("routeToHITL — signal priority + each named reason", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_HITL_ROUTING_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_HITL_ROUTING_ENABLED;
  });

  it("policy=deny short-circuits to hard_deny", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: {
        verdict: "deny",
        matchedPolicyName: "p",
        reason: "tier-2 finance write blocked",
        breakGlassEligible: true,
      },
    });
    expect(r.kind).toBe("hard_deny");
    expect(r.reason).toBe("policy_deny");
  });

  it("always-HITL action class wins over allow policy", () => {
    const r = routeToHITL({
      ...baseInput,
      actionClass: "external_write" as AgentActionClass,
      policyDecision: allowPolicy,
      alwaysHITLClasses: ["external_write" as AgentActionClass],
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("always_hitl_action_class");
  });

  it("policy=require-hitl routes to hitl_required", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: {
        verdict: "require-hitl",
        matchedPolicyName: "p",
        reason: "prod write",
        breakGlassEligible: false,
      },
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("policy_requires_hitl");
  });

  it("policy=require-acat without ACAT routes to hitl_required", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: {
        verdict: "require-acat",
        matchedPolicyName: "p",
        reason: "commerce",
        breakGlassEligible: false,
      },
      acatPresent: false,
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("policy_requires_acat_missing");
  });

  it("policy=require-acat WITH ACAT proceeds (downstream signals decide)", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: {
        verdict: "require-acat",
        matchedPolicyName: "p",
        reason: "commerce",
        breakGlassEligible: false,
      },
      acatPresent: true,
      viabilityScore: cleanViability,
      odtaResult: cleanODTA,
    });
    expect(r.kind).toBe("auto_proceed");
  });

  it("ODTA failure routes to hitl_required", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: cleanViability,
      odtaResult: {
        ok: false,
        failed: ["timeliness"],
        details: "60ms exceeds 50ms budget",
        timelinessBudgetMs: 50,
        auditEntry: {
          action: "agent.governance_consult",
          resource: "agent:x",
          details: { phase: "odta", failed: ["timeliness"], policyLatencyMs: 60, timelinessBudgetMs: 50, actionDescriptor: "x" },
        },
      },
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("odta_failed");
  });

  it("viability=block routes to hitl_required (NOT hard_deny — drift can be reviewed)", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: {
        vi: -0.6,
        recommendation: "block",
        rationale: "VI=-0.60 :: KL-penalty=1.00 · novelty-penalty=0.40",
        penalties: { kl: 1.0, z: 0, novelty: 0.4 },
      },
      odtaResult: cleanODTA,
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("viability_below_block_threshold");
  });

  it("viability=escalate_hitl routes to hitl_required", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: {
        vi: 0.1,
        recommendation: "escalate_hitl",
        rationale: "VI=0.10",
        penalties: { kl: 0.6, z: 0, novelty: 0 },
      },
      odtaResult: cleanODTA,
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("viability_below_escalate_threshold");
  });

  it("viability=proceed-with-warn routes to silent_approval (do not gate)", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: {
        vi: 0.7,
        recommendation: "proceed",
        rationale: "VI=0.70 :: KL-penalty=0.30",
        penalties: { kl: 0.3, z: 0, novelty: 0 },
      },
      odtaResult: cleanODTA,
    });
    expect(r.kind).toBe("silent_approval");
    expect(r.reason).toBe("viability_warn");
  });

  it("all signals clean → auto_proceed (does NOT route to HITL)", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: cleanViability,
      odtaResult: cleanODTA,
    });
    expect(r.kind).toBe("auto_proceed");
    expect(r.reason).toBe("all_signals_clean");
  });

  it("trace records every signal that influenced the outcome", () => {
    const r = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: cleanViability,
      odtaResult: cleanODTA,
    });
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.trace.some((t) => t.signal === "policy")).toBe(true);
    expect(r.trace.some((t) => t.signal === "odta")).toBe(true);
    expect(r.trace.some((t) => t.signal === "viability")).toBe(true);
  });

  it("approval-fatigue scenario: 100 clean actions all auto_proceed (zero HITL escalations)", () => {
    const counts: Record<string, number> = {
      auto_proceed: 0,
      silent_approval: 0,
      hitl_required: 0,
      hard_deny: 0,
    };
    for (let i = 0; i < 100; i++) {
      const r = routeToHITL({
        agentName: `agent-${i}`,
        actionClass: "internal_read" as AgentActionClass,
        policyDecision: allowPolicy,
        viabilityScore: cleanViability,
        odtaResult: cleanODTA,
      });
      counts[r.kind] += 1;
    }
    expect(counts.auto_proceed).toBe(100);
    expect(counts.hitl_required).toBe(0);
  });
});

describe("buildHITLRoutingAuditEntry", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_HITL_ROUTING_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_HITL_ROUTING_ENABLED;
  });

  it("emits agent.governance_consult with phase=hitl-routing", () => {
    const decision = routeToHITL({
      ...baseInput,
      policyDecision: allowPolicy,
      viabilityScore: cleanViability,
      odtaResult: cleanODTA,
    });
    const entry = buildHITLRoutingAuditEntry("agent-x", decision);
    expect(entry.action).toBe("agent.governance_consult");
    expect(entry.resource).toBe("agent:agent-x");
    expect(entry.details.phase).toBe("hitl-routing");
    expect(entry.details.kind).toBe("auto_proceed");
    expect(entry.details.trace.length).toBeGreaterThan(0);
  });
});
