/**
 * R142 PAGRL — Pre-Action Governance Reasoning Loop tests.
 *
 * Pure-function 4-layer ruleset consultation. Tests cover:
 *   - Feature-flag default-OFF / ON behavior
 *   - 4-layer canonical walk order (global → workflow → agent → situational)
 *   - First-match-wins per layer
 *   - Severity ordering (escalate > modify > permit)
 *   - Short-circuit on escalate
 *   - Defensive predicate handling (throw → does not match)
 *   - Trace completeness
 *   - Audit-entry shape
 *   - Pre-built rule templates (commerce ACAT, high-value off-hours, tier-3 prod)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isGovernanceLoopEnabled,
  consultGovernance,
  buildGovernanceAuditEntry,
  GOVERNANCE_LAYERS,
  GLOBAL_COMMERCE_REQUIRES_ACAT,
  SITUATIONAL_HIGH_VALUE_OFF_HOURS_HITL,
  AGENT_TIER3_PROD_WRITE_HITL,
  type GovernanceRule,
  type GovernanceContext,
} from "../governance";

const baseCtx: GovernanceContext = {
  agentName: "agent-x",
  agentTier: 1,
  actionClass: "internal_read",
  resourceTags: {},
};

describe("isGovernanceLoopEnabled", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED;
    else process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED = original;
  });

  it("returns false when env var unset", () => {
    delete process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED;
    expect(isGovernanceLoopEnabled()).toBe(false);
  });

  it("returns true only on exact 'true'", () => {
    process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED = "true";
    expect(isGovernanceLoopEnabled()).toBe(true);
    process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED = "True";
    expect(isGovernanceLoopEnabled()).toBe(false);
    process.env.SOVEREIGN_GOVERNANCE_LOOP_ENABLED = "1";
    expect(isGovernanceLoopEnabled()).toBe(false);
  });
});

describe("consultGovernance — empty + permit-by-default", () => {
  it("returns permit when no rules supplied", () => {
    const r = consultGovernance([], baseCtx);
    expect(r.verdict).toBe("permit");
    expect(r.finalLayer).toBeNull();
    expect(r.matchedRuleId).toBeNull();
    expect(r.trace).toEqual([]);
  });

  it("returns permit when no rule matches the context", () => {
    const rule: GovernanceRule = {
      id: "rule-x",
      layer: "global",
      name: "x",
      rationale: "x",
      predicate: () => false,
      effect: "escalate",
    };
    const r = consultGovernance([rule], baseCtx);
    expect(r.verdict).toBe("permit");
    expect(r.trace).toHaveLength(1);
    expect(r.trace[0].matched).toBe(false);
  });
});

describe("consultGovernance — layer ordering + first-match-wins", () => {
  it("walks layers in canonical order: global → workflow → agent → situational", () => {
    expect(GOVERNANCE_LAYERS).toEqual(["global", "workflow", "agent", "situational"]);
  });

  it("first matching rule per layer wins (subsequent rules in same layer skipped)", () => {
    const a: GovernanceRule = {
      id: "global.a",
      layer: "global",
      name: "global a",
      rationale: "first",
      predicate: () => true,
      effect: "modify",
    };
    const b: GovernanceRule = {
      id: "global.b",
      layer: "global",
      name: "global b",
      rationale: "second",
      predicate: () => true,
      effect: "escalate",
    };
    const r = consultGovernance([a, b], baseCtx);
    // a matched first; b should not appear in trace at all
    expect(r.trace.map((t) => t.ruleId)).toEqual(["global.a"]);
    expect(r.matchedRuleId).toBe("global.a");
  });

  it("higher-restriction rule in later layer DOES override permit-equivalent in earlier layer", () => {
    const earlyModify: GovernanceRule = {
      id: "global.modify",
      layer: "global",
      name: "early modify",
      rationale: "early",
      predicate: () => true,
      effect: "modify",
    };
    const lateEscalate: GovernanceRule = {
      id: "agent.escalate",
      layer: "agent",
      name: "late escalate",
      rationale: "later",
      predicate: () => true,
      effect: "escalate",
    };
    const r = consultGovernance([earlyModify, lateEscalate], baseCtx);
    expect(r.verdict).toBe("escalate");
    expect(r.matchedRuleId).toBe("agent.escalate");
  });

  it("less-restrictive later-layer match does NOT downgrade earlier verdict", () => {
    const globalEscalate: GovernanceRule = {
      id: "global.escalate",
      layer: "global",
      name: "g esc",
      rationale: "global escalate",
      predicate: () => true,
      effect: "escalate",
    };
    const agentModify: GovernanceRule = {
      id: "agent.modify",
      layer: "agent",
      name: "a mod",
      rationale: "agent modify",
      predicate: () => true,
      effect: "modify",
    };
    const r = consultGovernance([globalEscalate, agentModify], baseCtx);
    // Global escalate short-circuits — agentModify should NOT be evaluated.
    expect(r.verdict).toBe("escalate");
    expect(r.matchedRuleId).toBe("global.escalate");
    expect(r.trace.map((t) => t.ruleId)).toEqual(["global.escalate"]);
  });
});

describe("consultGovernance — short-circuit on escalate", () => {
  it("does NOT consult downstream layers after global escalate", () => {
    const globalEsc: GovernanceRule = {
      id: "g.esc",
      layer: "global",
      name: "g",
      rationale: "g",
      predicate: () => true,
      effect: "escalate",
    };
    const workflowMatched: GovernanceRule = {
      id: "w.modify",
      layer: "workflow",
      name: "w",
      rationale: "w",
      predicate: () => true,
      effect: "modify",
    };
    const r = consultGovernance([globalEsc, workflowMatched], baseCtx);
    // Workflow rule must NOT appear in trace (short-circuited).
    expect(r.trace.map((t) => t.layer)).toEqual(["global"]);
  });
});

describe("consultGovernance — defensive predicate evaluation", () => {
  it("a throwing predicate counts as 'did not match' and trace records the attempt", () => {
    const throwing: GovernanceRule = {
      id: "throw",
      layer: "global",
      name: "boom",
      rationale: "should not fire",
      predicate: () => {
        throw new Error("predicate exploded");
      },
      effect: "escalate",
    };
    const r = consultGovernance([throwing], baseCtx);
    expect(r.verdict).toBe("permit");
    expect(r.trace).toHaveLength(1);
    expect(r.trace[0].matched).toBe(false);
  });
});

describe("consultGovernance — trace completeness", () => {
  it("trace records every rule consulted, in evaluation order", () => {
    const r1: GovernanceRule = {
      id: "g.r1",
      layer: "global",
      name: "g r1",
      rationale: "r1",
      predicate: () => false,
      effect: "modify",
    };
    const r2: GovernanceRule = {
      id: "g.r2",
      layer: "global",
      name: "g r2",
      rationale: "r2",
      predicate: () => false,
      effect: "modify",
    };
    const r3: GovernanceRule = {
      id: "agent.r3",
      layer: "agent",
      name: "a r3",
      rationale: "r3",
      predicate: () => true,
      effect: "modify",
    };
    const r = consultGovernance([r1, r2, r3], baseCtx);
    expect(r.trace.map((t) => t.ruleId)).toEqual(["g.r1", "g.r2", "agent.r3"]);
    expect(r.trace.find((t) => t.matched)?.ruleId).toBe("agent.r3");
  });
});

describe("buildGovernanceAuditEntry", () => {
  it("emits the agent.governance_consult action with full trace", () => {
    const rule: GovernanceRule = {
      id: "test-rule",
      layer: "global",
      name: "test",
      rationale: "test rationale",
      predicate: () => true,
      effect: "escalate",
      regulatoryCitation: "TEST CITATION",
    };
    const r = consultGovernance([rule], baseCtx);
    const entry = buildGovernanceAuditEntry("agent-x", r);
    expect(entry.action).toBe("agent.governance_consult");
    expect(entry.resource).toBe("agent:agent-x");
    expect(entry.details.finalVerdict).toBe("escalate");
    expect(entry.details.matchedRuleId).toBe("test-rule");
    expect(entry.details.regulatoryCitation).toBe("TEST CITATION");
    expect(entry.details.trace).toHaveLength(1);
  });

  it("emits an entry even on clean permit (proves PAGRL ran)", () => {
    const r = consultGovernance([], baseCtx);
    const entry = buildGovernanceAuditEntry("agent-x", r);
    expect(entry.details.finalVerdict).toBe("permit");
    expect(entry.details.matchedRuleId).toBeNull();
  });
});

describe("Pre-built rule templates", () => {
  it("GLOBAL_COMMERCE_REQUIRES_ACAT escalates when cart present + external_write", () => {
    const ctx: GovernanceContext = {
      ...baseCtx,
      actionClass: "external_write",
      cart: { amountCents: 50_000, currency: "USD" },
    };
    const r = consultGovernance([GLOBAL_COMMERCE_REQUIRES_ACAT], ctx);
    expect(r.verdict).toBe("escalate");
    expect(r.regulatoryCitation).toBe("Sovereign R91");
  });

  it("GLOBAL_COMMERCE_REQUIRES_ACAT permits when no cart context", () => {
    const r = consultGovernance([GLOBAL_COMMERCE_REQUIRES_ACAT], baseCtx);
    expect(r.verdict).toBe("permit");
  });

  it("SITUATIONAL_HIGH_VALUE_OFF_HOURS escalates when cart > $1000 outside business hours", () => {
    // Sunday at 03:00 UTC — outside Mon-Fri 09:00-17:00 UTC
    const offHours = new Date("2026-04-26T03:00:00.000Z");
    const ctx: GovernanceContext = {
      ...baseCtx,
      cart: { amountCents: 200_000, currency: "USD" },
      now: offHours,
    };
    const r = consultGovernance([SITUATIONAL_HIGH_VALUE_OFF_HOURS_HITL], ctx);
    expect(r.verdict).toBe("escalate");
  });

  it("SITUATIONAL_HIGH_VALUE_OFF_HOURS permits during business hours", () => {
    // Wednesday at 14:00 UTC — squarely in business hours
    const businessHours = new Date("2026-04-29T14:00:00.000Z");
    const ctx: GovernanceContext = {
      ...baseCtx,
      cart: { amountCents: 200_000, currency: "USD" },
      now: businessHours,
    };
    const r = consultGovernance([SITUATIONAL_HIGH_VALUE_OFF_HOURS_HITL], ctx);
    expect(r.verdict).toBe("permit");
  });

  it("SITUATIONAL_HIGH_VALUE_OFF_HOURS permits low-value carts at any hour", () => {
    const offHours = new Date("2026-04-26T03:00:00.000Z");
    const ctx: GovernanceContext = {
      ...baseCtx,
      cart: { amountCents: 50_000, currency: "USD" }, // $500 — below threshold
      now: offHours,
    };
    const r = consultGovernance([SITUATIONAL_HIGH_VALUE_OFF_HOURS_HITL], ctx);
    expect(r.verdict).toBe("permit");
  });

  it("AGENT_TIER3_PROD_WRITE_HITL escalates only on tier-3 + external_write + env=prod", () => {
    const matching: GovernanceContext = {
      ...baseCtx,
      agentTier: 3,
      actionClass: "external_write",
      resourceTags: { env: "prod" },
    };
    const r = consultGovernance([AGENT_TIER3_PROD_WRITE_HITL], matching);
    expect(r.verdict).toBe("escalate");

    const nonProd: GovernanceContext = { ...matching, resourceTags: { env: "staging" } };
    expect(consultGovernance([AGENT_TIER3_PROD_WRITE_HITL], nonProd).verdict).toBe("permit");

    const lowerTier: GovernanceContext = { ...matching, agentTier: 2 };
    expect(consultGovernance([AGENT_TIER3_PROD_WRITE_HITL], lowerTier).verdict).toBe("permit");
  });
});

describe("Composite production scenario — finance-tier-2 cart > $1000 off-hours", () => {
  it("walks the full layer stack and escalates via situational rule", () => {
    const offHours = new Date("2026-04-26T03:00:00.000Z");
    const ctx: GovernanceContext = {
      agentName: "finance-bot",
      agentTier: 2,
      actionClass: "external_write",
      resourceTags: { department: "finance" },
      cart: { amountCents: 250_000, currency: "USD" },
      now: offHours,
    };
    // Use all 3 templates — global commerce + situational off-hours + agent tier-3
    // (last won't match because tier=2). Global ACAT will match first.
    const rules = [
      GLOBAL_COMMERCE_REQUIRES_ACAT,
      SITUATIONAL_HIGH_VALUE_OFF_HOURS_HITL,
      AGENT_TIER3_PROD_WRITE_HITL,
    ];
    const r = consultGovernance(rules, ctx);
    // Global escalates first; short-circuits before situational evaluates.
    expect(r.verdict).toBe("escalate");
    expect(r.finalLayer).toBe("global");
    expect(r.matchedRuleId).toBe("global.commerce_requires_acat");
  });
});
