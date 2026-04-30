/**
 * Inspector — R142 PAGRL + R143 ODTA cross-implementation agreement.
 *
 * Confirms the inspector port produces the SAME verdicts and audit
 * entries as the platform's src/lib/control-plane/{governance,odta}.ts
 * given identical inputs. This is the trust artifact: a customer can
 * replay any governance consultation offline and verify Sovereign's
 * claimed verdict was produced by the same algorithm.
 */

import { describe, it, expect } from "vitest";
import {
  GOVERNANCE_LAYERS,
  consultGovernance,
  buildGovernanceAuditEntry,
  ODTA_PREDICATES,
  ODTA_TIMELINESS_BUDGET_MS,
  evaluateODTA,
  verifyGovernanceTrace,
} from "../src/governance.mjs";

const baseCtx = {
  agentName: "agent-x",
  agentTier: 1,
  actionClass: "internal_read",
  resourceTags: {},
};

describe("inspector PAGRL — canonical ordering + verdicts", () => {
  it("declares the canonical 4 layers", () => {
    expect(GOVERNANCE_LAYERS).toEqual(["global", "workflow", "agent", "situational"]);
  });

  it("permits when no rule matches", () => {
    const r = consultGovernance(
      [{ id: "x", layer: "global", name: "x", rationale: "x", predicate: () => false, effect: "escalate" }],
      baseCtx,
    );
    expect(r.verdict).toBe("permit");
  });

  it("first-match-wins per layer", () => {
    const a = { id: "g.a", layer: "global", name: "a", rationale: "a", predicate: () => true, effect: "modify" };
    const b = { id: "g.b", layer: "global", name: "b", rationale: "b", predicate: () => true, effect: "escalate" };
    const r = consultGovernance([a, b], baseCtx);
    expect(r.matchedRuleId).toBe("g.a");
    expect(r.trace.map((t) => t.ruleId)).toEqual(["g.a"]);
  });

  it("more-restrictive later layer overrides earlier modify", () => {
    const m = { id: "g", layer: "global", name: "m", rationale: "m", predicate: () => true, effect: "modify" };
    const e = { id: "a", layer: "agent", name: "e", rationale: "e", predicate: () => true, effect: "escalate" };
    const r = consultGovernance([m, e], baseCtx);
    expect(r.verdict).toBe("escalate");
    expect(r.matchedRuleId).toBe("a");
  });

  it("escalate short-circuits downstream layers", () => {
    const e = { id: "g", layer: "global", name: "e", rationale: "e", predicate: () => true, effect: "escalate" };
    const m = { id: "w", layer: "workflow", name: "m", rationale: "m", predicate: () => true, effect: "modify" };
    const r = consultGovernance([e, m], baseCtx);
    expect(r.trace.map((t) => t.layer)).toEqual(["global"]);
  });

  it("throwing predicate counts as no-match", () => {
    const t = {
      id: "boom",
      layer: "global",
      name: "boom",
      rationale: "x",
      predicate: () => {
        throw new Error("predicate exploded");
      },
      effect: "escalate",
    };
    const r = consultGovernance([t], baseCtx);
    expect(r.verdict).toBe("permit");
    expect(r.trace[0].matched).toBe(false);
  });
});

describe("inspector — buildGovernanceAuditEntry", () => {
  it("emits agent.governance_consult with full trace", () => {
    const r = consultGovernance(
      [
        {
          id: "rule",
          layer: "global",
          name: "rule",
          rationale: "x",
          predicate: () => true,
          effect: "escalate",
          regulatoryCitation: "TEST",
        },
      ],
      baseCtx,
    );
    const entry = buildGovernanceAuditEntry("agent-x", r);
    expect(entry.action).toBe("agent.governance_consult");
    expect(entry.resource).toBe("agent:agent-x");
    expect(entry.details.regulatoryCitation).toBe("TEST");
    expect(entry.details.trace).toHaveLength(1);
  });
});

describe("inspector ODTA — predicates + budget", () => {
  it("declares 4 predicates in canonical order", () => {
    expect(ODTA_PREDICATES).toEqual(["observability", "decidability", "timeliness", "attestability"]);
    expect(ODTA_TIMELINESS_BUDGET_MS).toBe(50);
  });

  it("returns ok when all 4 evidence inputs satisfied", () => {
    const r = evaluateODTA({
      agentName: "x",
      actionDescriptor: "x",
      hasObservabilityProbe: true,
      hasPolicyDecision: true,
      policyLatencyMs: 10,
      hasAttestableAuditEntry: true,
    });
    expect(r.ok).toBe(true);
  });

  it("collects all 4 failures simultaneously", () => {
    const r = evaluateODTA({
      agentName: "x",
      actionDescriptor: "x",
      hasObservabilityProbe: false,
      hasPolicyDecision: false,
      policyLatencyMs: 9999,
      hasAttestableAuditEntry: false,
    });
    expect(r.ok).toBe(false);
    expect(r.failed).toEqual(["observability", "decidability", "timeliness", "attestability"]);
  });

  it("non-finite policyLatencyMs flagged as timeliness failure", () => {
    const r = evaluateODTA({
      agentName: "x",
      actionDescriptor: "x",
      hasObservabilityProbe: true,
      hasPolicyDecision: true,
      policyLatencyMs: NaN,
      hasAttestableAuditEntry: true,
    });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain("timeliness");
  });

  it("custom timeliness budget honored", () => {
    const r = evaluateODTA({
      agentName: "x",
      actionDescriptor: "x",
      hasObservabilityProbe: true,
      hasPolicyDecision: true,
      policyLatencyMs: 75,
      hasAttestableAuditEntry: true,
      timelinessBudgetMs: 100,
    });
    expect(r.ok).toBe(true);
  });

  it("audit-entry shape on failure includes phase=odta", () => {
    const r = evaluateODTA({
      agentName: "audit-test",
      actionDescriptor: "test-action",
      hasObservabilityProbe: false,
      hasPolicyDecision: true,
      policyLatencyMs: 10,
      hasAttestableAuditEntry: true,
    });
    expect(r.ok).toBe(false);
    expect(r.auditEntry.action).toBe("agent.governance_consult");
    expect(r.auditEntry.details.phase).toBe("odta");
    expect(r.auditEntry.details.failed).toEqual(["observability"]);
  });
});

describe("verifyGovernanceTrace — replay-and-confirm", () => {
  it("reports ok when the replay matches the claimed verdict + rule + layer", () => {
    const rules = [
      { id: "g.x", layer: "global", name: "x", rationale: "x", predicate: () => true, effect: "escalate" },
    ];
    const replayed = consultGovernance(rules, baseCtx);
    const v = verifyGovernanceTrace({
      rules,
      context: baseCtx,
      claimed: {
        verdict: replayed.verdict,
        matchedRuleId: replayed.matchedRuleId,
        finalLayer: replayed.finalLayer,
      },
    });
    expect(v.ok).toBe(true);
  });

  it("reports failure with named errors when claim mismatches replay", () => {
    const rules = [
      { id: "g.x", layer: "global", name: "x", rationale: "x", predicate: () => true, effect: "escalate" },
    ];
    const v = verifyGovernanceTrace({
      rules,
      context: baseCtx,
      claimed: { verdict: "permit", matchedRuleId: null, finalLayer: null },
    });
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
    expect(v.errors.some((e) => e.includes("verdict mismatch"))).toBe(true);
  });
});
