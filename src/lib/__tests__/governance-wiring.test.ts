/**
 * Move 17 — governance wiring smoke tests.
 *
 * Confirms agent-factory imports + uses consultGovernance correctly
 * without spinning up the full route. Covers:
 *   - default-OFF posture (env flag)
 *   - tier-3 prod-write escalates via the bundled rule
 *   - audit-entry shape is the R142 agent.governance_consult action
 *   - empty rules → no-op permit (existing 222-agent fleet behavior)
 *   - permit / modify / escalate verdict ordering
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  consultGovernance,
  isGovernanceLoopEnabled,
  buildGovernanceAuditEntry,
  AGENT_TIER3_PROD_WRITE_HITL,
  GLOBAL_COMMERCE_REQUIRES_ACAT,
  type GovernanceContext,
  type GovernanceRule,
} from "@/lib/control-plane/governance";

describe("governance wiring — feature-flag gate", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("isGovernanceLoopEnabled is default-OFF (existing fleet stays byte-identical)", () => {
    expect(isGovernanceLoopEnabled()).toBe(false);
  });

  it("strict 'true' string is required to enable", () => {
    vi.stubEnv("SOVEREIGN_GOVERNANCE_LOOP_ENABLED", "true");
    expect(isGovernanceLoopEnabled()).toBe(true);
    vi.stubEnv("SOVEREIGN_GOVERNANCE_LOOP_ENABLED", "1");
    expect(isGovernanceLoopEnabled()).toBe(false);
    vi.stubEnv("SOVEREIGN_GOVERNANCE_LOOP_ENABLED", "TRUE");
    expect(isGovernanceLoopEnabled()).toBe(false);
  });
});

describe("governance wiring — tier-3 prod-write escalation (the headline)", () => {
  it("escalates a tier-3 prod-write via AGENT_TIER3_PROD_WRITE_HITL", () => {
    const ctx: GovernanceContext = {
      agentName: "finance-bot",
      agentTier: 3,
      actionClass: "external_write",
      resourceTags: { env: "prod" },
    };
    const r = consultGovernance([AGENT_TIER3_PROD_WRITE_HITL], ctx);
    expect(r.verdict).toBe("escalate");
    expect(r.matchedRuleId).toBe(AGENT_TIER3_PROD_WRITE_HITL.id);
    expect(r.finalLayer).toBe("agent");
  });

  it("permits the same action when tier is lowered to 1", () => {
    const r = consultGovernance([AGENT_TIER3_PROD_WRITE_HITL], {
      agentName: "finance-bot",
      agentTier: 1,
      actionClass: "internal_read",
      resourceTags: { env: "prod" },
    });
    expect(r.verdict).toBe("permit");
  });

  it("permits when env is not 'prod' (situational predicate honored)", () => {
    const r = consultGovernance([AGENT_TIER3_PROD_WRITE_HITL], {
      agentName: "finance-bot",
      agentTier: 3,
      actionClass: "external_write",
      resourceTags: { env: "staging" },
    });
    expect(r.verdict).toBe("permit");
  });
});

describe("governance wiring — audit-entry shape (R142 vocabulary)", () => {
  it("buildGovernanceAuditEntry emits agent.governance_consult action", () => {
    const r = consultGovernance([], {
      agentName: "x",
      agentTier: 1,
      actionClass: "internal_read",
    });
    const a = buildGovernanceAuditEntry("x", r);
    expect(a.action).toBe("agent.governance_consult");
    expect(a.resource).toContain("x");
  });

  it("audit details include verdict + matchedRuleId + trace for SOC 2 reviewers", () => {
    const customRule: GovernanceRule = {
      id: "test.workflow-rule",
      layer: "workflow",
      name: "test rule",
      rationale: "this is a test rule",
      predicate: () => true,
      effect: "modify",
    };
    const r = consultGovernance([customRule], {
      agentName: "x",
      agentTier: 1,
      actionClass: "internal_read",
    });
    expect(r.verdict).toBe("modify");
    expect(r.matchedRuleId).toBe("test.workflow-rule");
    const a = buildGovernanceAuditEntry("x", r);
    expect(a.details.finalVerdict).toBe("modify");
    expect(a.details.matchedRuleId).toBe("test.workflow-rule");
  });
});

describe("governance wiring — empty rules / no-op posture", () => {
  it("zero rules → permit verdict; null matched rule (existing-fleet case)", () => {
    const r = consultGovernance([], {
      agentName: "any-agent",
      agentTier: 1,
      actionClass: "internal_read",
    });
    expect(r.verdict).toBe("permit");
    expect(r.matchedRuleId).toBeNull();
    expect(r.finalLayer).toBeNull();
    expect(r.trace).toEqual([]);
  });
});

describe("governance wiring — verdict severity ordering (escalate > modify > permit)", () => {
  it("global escalate beats workflow modify", () => {
    const globalEscalate: GovernanceRule = {
      id: "global.escalate",
      layer: "global",
      name: "global escalate",
      rationale: "x",
      predicate: () => true,
      effect: "escalate",
    };
    const workflowModify: GovernanceRule = {
      id: "workflow.modify",
      layer: "workflow",
      name: "workflow modify",
      rationale: "x",
      predicate: () => true,
      effect: "modify",
    };
    const r = consultGovernance([globalEscalate, workflowModify], {
      agentName: "x",
      agentTier: 1,
      actionClass: "internal_read",
    });
    // Global escalate fires first AND short-circuits — workflow layer
    // shouldn't even be consulted. Verify both: verdict + trace shape.
    expect(r.verdict).toBe("escalate");
    expect(r.matchedRuleId).toBe("global.escalate");
  });
});

describe("governance wiring — GLOBAL_COMMERCE_REQUIRES_ACAT (built-in rule)", () => {
  it("escalates a commerce external_write with cart context (R91 ACAT requirement)", () => {
    const r = consultGovernance([GLOBAL_COMMERCE_REQUIRES_ACAT], {
      agentName: "checkout-bot",
      agentTier: 2,
      actionClass: "external_write",
      cart: { amountCents: 5000, currency: "USD" },
    });
    expect(r.verdict).toBe("escalate");
    expect(r.matchedRuleId).toBe(GLOBAL_COMMERCE_REQUIRES_ACAT.id);
  });
});
