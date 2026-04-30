/**
 * Move 2 — Agent Factory Policy Gate tests.
 *
 * Coverage:
 *   - Gate disabled → proceed regardless of policies (default behavior)
 *   - Gate enabled + no policies → proceed (per-agent opt-in respected)
 *   - Gate enabled + allow policy → proceed with matched policy name
 *   - Gate enabled + deny policy → blocked with audit entry + procurement
 *     response
 *   - Gate enabled + require-hitl → blocked with hitl_required reason
 *   - Gate enabled + require-acat → blocked with acat_required reason
 *   - Default-deny (no_matching_policy) → blocked with breakGlassEligible
 *     correctly false
 *   - Audit entry includes user, tenant, org, agentTier, regulatoryCitation
 *   - Procurement response surfaces matched policy name + rationale
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evaluatePolicyGate, isPolicyGateEnabled } from "@/lib/agent-factory-policy-gate";
import {
  PROD_WRITES_REQUIRE_HITL,
  COMMERCE_REQUIRES_ACAT,
  type PolicyRule,
} from "@/lib/control-plane/policy-engine";

// NOTE: The shipped FINANCE_READ_ONLY_POLICY in policy-engine.ts has
// inverted semantics (deny when tier ≤ 1) that don't match its
// description. Filed as a separate cleanup. We use a properly-formed
// equivalent here:
const FINANCE_TIER2_DENY_POLICY: PolicyRule = {
  name: "finance_writers_blocked_sox",
  description: "Block tier-2 (write-capable) agents from the finance department.",
  priority: 10,
  effect: "deny",
  predicates: [
    { kind: "resource-tag-eq", tag: "department", value: "finance" },
    { kind: "agent-tier-eq", tier: 2 },
  ],
  breakGlassEligible: true,
  regulatoryCitation: "SOX 404 (segregation of duties)",
};

const ORIGINAL_FLAG = process.env.SOVEREIGN_POLICY_GATE_ENABLED;

beforeEach(() => {
  delete process.env.SOVEREIGN_POLICY_GATE_ENABLED;
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) {
    delete process.env.SOVEREIGN_POLICY_GATE_ENABLED;
  } else {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = ORIGINAL_FLAG;
  }
});

describe("isPolicyGateEnabled", () => {
  it("returns false when flag unset", () => {
    expect(isPolicyGateEnabled()).toBe(false);
  });
  it("returns true only when flag is exactly 'true'", () => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "true";
    expect(isPolicyGateEnabled()).toBe(true);
  });
  it("returns false on any other value (defensive)", () => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "yes";
    expect(isPolicyGateEnabled()).toBe(false);
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "1";
    expect(isPolicyGateEnabled()).toBe(false);
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "TRUE";
    expect(isPolicyGateEnabled()).toBe(false); // case-sensitive
  });
});

describe("evaluatePolicyGate — gate disabled (default behavior)", () => {
  it("proceeds with reason=gate_disabled when flag unset", () => {
    const v = evaluatePolicyGate({
      agentName: "test-agent",
      policies: [FINANCE_TIER2_DENY_POLICY], // even with policies declared
      userId: "u",
      agentTier: 2, // would otherwise block
      resourceTags: { department: "finance" },
    });
    expect(v.proceed).toBe(true);
    if (v.proceed) expect(v.reason).toBe("gate_disabled");
  });
});

describe("evaluatePolicyGate — gate enabled, per-agent opt-in", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "true";
  });

  it("proceeds with no_policies when agent has no policies (transparent for 222 agents)", () => {
    const v = evaluatePolicyGate({
      agentName: "untouched-agent",
      // no policies
      userId: "u",
      agentTier: 1,
    });
    expect(v.proceed).toBe(true);
    if (v.proceed) expect(v.reason).toBe("no_policies");
  });

  it("proceeds with empty policies array (defensive)", () => {
    const v = evaluatePolicyGate({
      agentName: "empty-policies-agent",
      policies: [],
      userId: "u",
      agentTier: 1,
    });
    expect(v.proceed).toBe(true);
    if (v.proceed) expect(v.reason).toBe("no_policies");
  });

  it("proceeds with policy_allowed when an allow policy matches", () => {
    const allowPolicy: PolicyRule = {
      name: "tier1-allow",
      effect: "allow",
      predicates: [{ kind: "agent-tier-leq", tier: 1 }],
    };
    const v = evaluatePolicyGate({
      agentName: "summarizer",
      policies: [allowPolicy],
      userId: "u",
      agentTier: 1,
    });
    expect(v.proceed).toBe(true);
    if (v.proceed) {
      expect(v.reason).toBe("policy_allowed");
      expect(v.matchedPolicyName).toBe("tier1-allow");
    }
  });
});

describe("evaluatePolicyGate — denial paths", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "true";
  });

  it("blocks with policy_denied when finance-read-only fires on tier 2", () => {
    const v = evaluatePolicyGate({
      agentName: "finance-writer",
      policies: [FINANCE_TIER2_DENY_POLICY],
      userId: "u_finance",
      agentTier: 2,
      resourceTags: { department: "finance" },
    });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      expect(v.reason).toBe("policy_denied");
      expect(v.response.policyName).toContain("finance_writers_blocked");
      expect(v.response.breakGlassEligible).toBe(true);
      expect(v.response.regulatoryCitation).toContain("SOX");
      expect(v.auditEntry.action).toBe("agent.policy_gate.deny");
      expect(v.auditEntry.resource).toBe("agent:finance-writer");
    }
  });

  it("blocks with hitl_required when prod-writes-require-hitl fires", () => {
    const v = evaluatePolicyGate({
      agentName: "db-migrator",
      policies: [PROD_WRITES_REQUIRE_HITL],
      userId: "u_devops",
      agentTier: 2,
      resourceTags: { env: "prod" },
    });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      expect(v.reason).toBe("hitl_required");
      expect(v.response.regulatoryCitation).toContain("SOC 2");
    }
  });

  it("blocks with acat_required when commerce-requires-acat fires", () => {
    const v = evaluatePolicyGate({
      agentName: "shopping-agent",
      policies: [COMMERCE_REQUIRES_ACAT],
      userId: "u_buyer",
      agentTier: 3,
      cart: {
        amountCents: 7342,
        currency: "USD",
        merchantId: "acme-shop",
        category: "marketplace_b2c",
      },
    });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      expect(v.reason).toBe("acat_required");
      expect(v.response.breakGlassEligible).toBe(false);
    }
  });

  it("default-deny when no policy matches (safe-by-default)", () => {
    // Policy that doesn't match the input
    const wrongDeptPolicy: PolicyRule = {
      name: "marketing-only",
      effect: "deny",
      predicates: [
        { kind: "resource-tag-eq", tag: "department", value: "marketing" },
      ],
    };
    const v = evaluatePolicyGate({
      agentName: "x",
      policies: [wrongDeptPolicy],
      userId: "u",
      agentTier: 2,
      resourceTags: { department: "engineering" }, // doesn't match
    });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      expect(v.reason).toBe("policy_denied");
      // Default-deny: policyName contains "no matching policy"
      expect(v.response.policyName).toContain("no matching");
      expect(v.response.breakGlassEligible).toBe(false);
    }
  });
});

describe("evaluatePolicyGate — audit entry shape", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "true";
  });

  it("audit entry includes all procurement-relevant fields", () => {
    const v = evaluatePolicyGate({
      agentName: "finance-writer",
      policies: [FINANCE_TIER2_DENY_POLICY],
      userId: "u_finance_alice",
      tenantId: "tenant_acme",
      orgId: "org_finance_team",
      agentTier: 2,
      resourceTags: { department: "finance" },
    });
    expect(v.proceed).toBe(false);
    if (!v.proceed) {
      const d = v.auditEntry.details;
      expect(d.userId).toBe("u_finance_alice");
      expect(d.tenantId).toBe("tenant_acme");
      expect(d.orgId).toBe("org_finance_team");
      expect(d.agentTier).toBe(2);
      expect(d.breakGlassEligible).toBe(true);
      expect(d.regulatoryCitation).toContain("SOX");
      expect(d.verdict).toBe("deny");
    }
  });
});

describe("evaluatePolicyGate — composability with R100 primitives", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "true";
  });

  it("composes with reputation predicate", () => {
    const requireA: PolicyRule = {
      name: "require-A-grade",
      effect: "allow",
      predicates: [{ kind: "reputation-grade-min", grade: "A" }],
    };
    const v1 = evaluatePolicyGate({
      agentName: "a",
      policies: [requireA],
      userId: "u",
      agentTier: 1,
      reputationGrade: "A+",
    });
    expect(v1.proceed).toBe(true);

    const v2 = evaluatePolicyGate({
      agentName: "a",
      policies: [requireA],
      userId: "u",
      agentTier: 1,
      reputationGrade: "B",
    });
    expect(v2.proceed).toBe(false); // doesn't match → default-deny
  });

  it("composes with credit-headroom predicate", () => {
    const minCredit: PolicyRule = {
      name: "min-credit-headroom",
      effect: "allow",
      predicates: [{ kind: "credit-headroom-min-cents", cents: 10000 }],
    };
    const v1 = evaluatePolicyGate({
      agentName: "a",
      policies: [minCredit],
      userId: "u",
      agentTier: 1,
      creditHeadroomCents: 50000,
    });
    expect(v1.proceed).toBe(true);

    const v2 = evaluatePolicyGate({
      agentName: "a",
      policies: [minCredit],
      userId: "u",
      agentTier: 1,
      creditHeadroomCents: 5000,
    });
    expect(v2.proceed).toBe(false);
  });

  it("composes with ACT presence + ACAT scope predicates", () => {
    const eliteCommercePolicy: PolicyRule = {
      name: "elite-commerce",
      effect: "allow",
      predicates: [
        { kind: "act-present" },
        { kind: "acat-present" },
        { kind: "acat-amount-leq-cents", cents: 50000 },
      ],
    };
    const v1 = evaluatePolicyGate({
      agentName: "shopping-agent",
      policies: [eliteCommercePolicy],
      userId: "u",
      agentTier: 3,
      actPresent: true,
      acat: {
        present: true,
        maxCents: 25000,
        currency: "USD",
        allowedMerchantIds: ["acme"],
        allowedCategories: ["marketplace_b2c"],
      },
    });
    expect(v1.proceed).toBe(true);

    // Same context but missing ACAT → deny
    const v2 = evaluatePolicyGate({
      agentName: "shopping-agent",
      policies: [eliteCommercePolicy],
      userId: "u",
      agentTier: 3,
      actPresent: true,
      // no acat
    });
    expect(v2.proceed).toBe(false);
  });
});

describe("evaluatePolicyGate — proceeding includes matched policy name (audit trace)", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_POLICY_GATE_ENABLED = "true";
  });

  it("proceed-with-allow returns the matched policy name for audit trace", () => {
    const allowPolicy: PolicyRule = {
      name: "specific-allow-rule",
      effect: "allow",
      predicates: [{ kind: "agent-tier-eq", tier: 1 }],
    };
    const v = evaluatePolicyGate({
      agentName: "x",
      policies: [allowPolicy],
      userId: "u",
      agentTier: 1,
    });
    expect(v.proceed).toBe(true);
    if (v.proceed) {
      expect(v.matchedPolicyName).toBe("specific-allow-rule");
    }
  });
});
