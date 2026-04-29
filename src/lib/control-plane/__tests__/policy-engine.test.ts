/**
 * R100 — Sovereign Policy Engine unit tests.
 *
 * Coverage:
 *   - Every predicate kind matches when context satisfies it
 *   - Every predicate kind FAILS with a procurement-readable reason
 *   - AND short-circuits on first-failed predicate
 *   - Priority + alphabetical ordering is deterministic
 *   - Default-deny on no-match
 *   - Break-glass: requires eligible policy, requires reason ≥ 10 chars,
 *     refuses default-deny + already-allow paths, produces audit entry
 *   - Composition with shipped primitives (R37/R40/R42/R91)
 *   - All 6 effects: allow / deny / require-hitl / require-acat /
 *     require-attestation / require-break-glass
 */

import { describe, it, expect } from "vitest";
import {
  evaluatePolicies,
  evaluatePredicate,
  applyBreakGlass,
  FINANCE_READ_ONLY_POLICY,
  PROD_WRITES_REQUIRE_HITL,
  type PolicyContext,
  type PolicyRule,
  type PolicyDecision,
} from "@/lib/control-plane/policy-engine";

const baseContext: PolicyContext = {
  userId: "user_alice",
  agentId: "1099-reader",
  agentTier: 1,
  reputationGrade: "A",
  creditHeadroomCents: 50000,
  resourceTags: { env: "prod", department: "finance" },
  now: new Date("2026-04-29T12:00:00.000Z"), // 12:00 UTC
};

describe("evaluatePredicate — every predicate kind", () => {
  it("agent-tier-leq matches when within bound", () => {
    expect(
      evaluatePredicate({ kind: "agent-tier-leq", tier: 2 }, baseContext)
        .matched,
    ).toBe(true);
  });

  it("agent-tier-leq fails with reason when over bound", () => {
    const r = evaluatePredicate(
      { kind: "agent-tier-leq", tier: 1 },
      { ...baseContext, agentTier: 3 },
    );
    expect(r.matched).toBe(false);
    expect(r.why).toContain("agent tier 3");
  });

  it("agent-tier-eq is exact", () => {
    expect(
      evaluatePredicate({ kind: "agent-tier-eq", tier: 1 }, baseContext)
        .matched,
    ).toBe(true);
    expect(
      evaluatePredicate({ kind: "agent-tier-eq", tier: 2 }, baseContext)
        .matched,
    ).toBe(false);
  });

  it("reputation-grade-min uses canonical letter ordering", () => {
    expect(
      evaluatePredicate(
        { kind: "reputation-grade-min", grade: "B+" },
        baseContext,
      ).matched,
    ).toBe(true); // A >= B+
    expect(
      evaluatePredicate(
        { kind: "reputation-grade-min", grade: "A+" },
        baseContext,
      ).matched,
    ).toBe(false); // A < A+
  });

  it("reputation-grade-min fails when no reputation", () => {
    const r = evaluatePredicate(
      { kind: "reputation-grade-min", grade: "B" },
      { ...baseContext, reputationGrade: undefined },
    );
    expect(r.matched).toBe(false);
    expect(r.why).toContain("no reputation");
  });

  it("credit-headroom-min-cents respects exact threshold", () => {
    expect(
      evaluatePredicate(
        { kind: "credit-headroom-min-cents", cents: 50000 },
        baseContext,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "credit-headroom-min-cents", cents: 50001 },
        baseContext,
      ).matched,
    ).toBe(false);
  });

  it("act-present matches when actPresent=true", () => {
    expect(
      evaluatePredicate({ kind: "act-present" }, {
        ...baseContext,
        actPresent: true,
      }).matched,
    ).toBe(true);
    expect(
      evaluatePredicate({ kind: "act-present" }, baseContext).matched,
    ).toBe(false);
  });

  it("acat-present + acat-amount-leq-cents work together", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      acat: {
        present: true,
        maxCents: 50000,
        currency: "USD",
        allowedMerchantIds: ["acme"],
        allowedCategories: ["marketplace_b2c"],
      },
    };
    expect(evaluatePredicate({ kind: "acat-present" }, ctx).matched).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "acat-amount-leq-cents", cents: 50000 },
        ctx,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "acat-amount-leq-cents", cents: 49999 },
        ctx,
      ).matched,
    ).toBe(false);
  });

  it("acat-merchant-in / acat-category-in respect allowlists", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      acat: {
        present: true,
        maxCents: 50000,
        currency: "USD",
        allowedMerchantIds: ["acme"],
        allowedCategories: ["groceries"],
      },
    };
    expect(
      evaluatePredicate(
        { kind: "acat-merchant-in", merchantIds: ["acme", "other"] },
        ctx,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "acat-merchant-in", merchantIds: ["only-other"] },
        ctx,
      ).matched,
    ).toBe(false);
    expect(
      evaluatePredicate(
        { kind: "acat-category-in", categories: ["groceries"] },
        ctx,
      ).matched,
    ).toBe(true);
  });

  it("agent-id-in / agent-id-not-in work as set membership", () => {
    expect(
      evaluatePredicate(
        { kind: "agent-id-in", agentIds: ["1099-reader", "other"] },
        baseContext,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "agent-id-not-in", agentIds: ["only-other"] },
        baseContext,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "agent-id-not-in", agentIds: ["1099-reader"] },
        baseContext,
      ).matched,
    ).toBe(false);
  });

  it("resource-tag-eq fires only on exact match", () => {
    expect(
      evaluatePredicate(
        { kind: "resource-tag-eq", tag: "env", value: "prod" },
        baseContext,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "resource-tag-eq", tag: "env", value: "staging" },
        baseContext,
      ).matched,
    ).toBe(false);
    expect(
      evaluatePredicate(
        { kind: "resource-tag-eq", tag: "missing", value: "x" },
        baseContext,
      ).matched,
    ).toBe(false);
  });

  it("time-window matches inside [start, end) — non-wrapping", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      now: new Date("2026-04-29T14:30:00.000Z"),
    };
    expect(
      evaluatePredicate(
        { kind: "time-window", startHourUtc: 9, endHourUtc: 17 },
        ctx,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "time-window", startHourUtc: 9, endHourUtc: 14 },
        ctx,
      ).matched,
    ).toBe(false); // 14 is the EXCLUSIVE end
  });

  it("time-window handles wrapping (22 → 6)", () => {
    expect(
      evaluatePredicate(
        { kind: "time-window", startHourUtc: 22, endHourUtc: 6 },
        { ...baseContext, now: new Date("2026-04-29T03:00:00.000Z") },
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "time-window", startHourUtc: 22, endHourUtc: 6 },
        { ...baseContext, now: new Date("2026-04-29T12:00:00.000Z") },
      ).matched,
    ).toBe(false);
  });

  it("max-amount-cents / currency-in / merchant-id-in require cart", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      cart: {
        amountCents: 10000,
        currency: "USD",
        merchantId: "acme",
        category: "marketplace_b2c",
      },
    };
    expect(
      evaluatePredicate(
        { kind: "max-amount-cents", cents: 20000 },
        ctx,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "max-amount-cents", cents: 5000 },
        ctx,
      ).matched,
    ).toBe(false);
    expect(
      evaluatePredicate(
        { kind: "currency-in", currencies: ["USD", "EUR"] },
        ctx,
      ).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(
        { kind: "merchant-id-in", merchantIds: ["acme"] },
        ctx,
      ).matched,
    ).toBe(true);
  });

  it("cart-dependent predicates fail without cart", () => {
    const r = evaluatePredicate(
      { kind: "max-amount-cents", cents: 100 },
      baseContext,
    );
    expect(r.matched).toBe(false);
    expect(r.why).toContain("no cart");
  });
});

describe("evaluatePolicies — ordering, AND short-circuit, default-deny", () => {
  it("returns default deny / no_matching_policy when policy list is empty", () => {
    const d = evaluatePolicies([], baseContext);
    expect(d.verdict).toBe("deny");
    expect(d.matchedPolicyName).toBe("default");
    if (d.matchedPolicyName === "default") {
      expect(d.reason).toBe("no_matching_policy");
    }
  });

  it("matches the LOWEST-priority policy first (priority asc)", () => {
    const earlyDeny: PolicyRule = {
      name: "early_deny",
      priority: 1,
      effect: "deny",
      predicates: [],
    };
    const lateAllow: PolicyRule = {
      name: "late_allow",
      priority: 100,
      effect: "allow",
      predicates: [],
    };
    const d = evaluatePolicies([lateAllow, earlyDeny], baseContext);
    expect(d.verdict).toBe("deny");
    expect(d.matchedPolicyName).toBe("early_deny");
  });

  it("ties broken alphabetically by name (deterministic)", () => {
    const beta: PolicyRule = {
      name: "beta",
      priority: 50,
      effect: "deny",
      predicates: [],
    };
    const alpha: PolicyRule = {
      name: "alpha",
      priority: 50,
      effect: "allow",
      predicates: [],
    };
    const d = evaluatePolicies([beta, alpha], baseContext);
    expect(d.matchedPolicyName).toBe("alpha");
  });

  it("AND short-circuits on first-failed predicate", () => {
    const policy: PolicyRule = {
      name: "compound",
      effect: "allow",
      predicates: [
        { kind: "agent-tier-leq", tier: 1 },
        { kind: "reputation-grade-min", grade: "A+" }, // fails for "A"
        { kind: "credit-headroom-min-cents", cents: 999999999 }, // would also fail
      ],
    };
    const d = evaluatePolicies([policy], baseContext);
    expect(d.verdict).toBe("deny");
    expect(d.matchedPolicyName).toBe("default");
  });

  it("empty predicates array matches everything", () => {
    const wildcard: PolicyRule = {
      name: "wildcard_allow",
      effect: "allow",
      predicates: [],
    };
    const d = evaluatePolicies([wildcard], baseContext);
    expect(d.verdict).toBe("allow");
  });

  it("decision reason is procurement-readable", () => {
    const policy: PolicyRule = {
      name: "high_trust_allow",
      effect: "allow",
      predicates: [{ kind: "reputation-grade-min", grade: "B+" }],
    };
    const d = evaluatePolicies([policy], baseContext);
    expect(d.reason).toContain("high_trust_allow");
    expect(d.reason).toContain("matched");
  });
});

describe("evaluatePolicies — all 6 effects render correctly", () => {
  const truthy: PolicyRule = {
    name: "truthy",
    effect: "allow",
    predicates: [],
  };

  it("allow", () => {
    const d = evaluatePolicies([truthy], baseContext);
    expect(d.verdict).toBe("allow");
  });
  it("deny", () => {
    const d = evaluatePolicies(
      [{ ...truthy, effect: "deny" }],
      baseContext,
    );
    expect(d.verdict).toBe("deny");
  });
  it("require-hitl", () => {
    const d = evaluatePolicies(
      [{ ...truthy, effect: "require-hitl" }],
      baseContext,
    );
    expect(d.verdict).toBe("require-hitl");
  });
  it("require-acat", () => {
    const d = evaluatePolicies(
      [{ ...truthy, effect: "require-acat" }],
      baseContext,
    );
    expect(d.verdict).toBe("require-acat");
  });
  it("require-attestation", () => {
    const d = evaluatePolicies(
      [{ ...truthy, effect: "require-attestation" }],
      baseContext,
    );
    expect(d.verdict).toBe("require-attestation");
  });
  it("require-break-glass renders as deny", () => {
    const d = evaluatePolicies(
      [{ ...truthy, effect: "require-break-glass" }],
      baseContext,
    );
    expect(d.verdict).toBe("deny");
  });
});

describe("Composition with shipped primitives", () => {
  it("composes R37 ACT + R40 reputation + R42 credit + R91 ACAT", () => {
    const composed: PolicyRule = {
      name: "elite_commerce_path",
      description:
        "Allow agentic commerce up to $1000 only with A+ rep + ACT + ACAT + cart",
      effect: "allow",
      predicates: [
        { kind: "act-present" },
        { kind: "acat-present" },
        { kind: "reputation-grade-min", grade: "A+" },
        { kind: "credit-headroom-min-cents", cents: 100000 },
        { kind: "max-amount-cents", cents: 100000 },
      ],
    };
    const ctx: PolicyContext = {
      ...baseContext,
      reputationGrade: "A+",
      creditHeadroomCents: 250000,
      actPresent: true,
      acat: {
        present: true,
        maxCents: 50000,
        currency: "USD",
        allowedMerchantIds: ["acme"],
        allowedCategories: ["marketplace_b2c"],
      },
      cart: {
        amountCents: 50000,
        currency: "USD",
        merchantId: "acme",
        category: "marketplace_b2c",
      },
    };
    const d = evaluatePolicies([composed], ctx);
    expect(d.verdict).toBe("allow");
  });
});

describe("Pre-built policy templates", () => {
  it("FINANCE_READ_ONLY_POLICY denies tier-2 finance writes", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      agentTier: 2,
      resourceTags: { department: "finance" },
    };
    const d = evaluatePolicies([FINANCE_READ_ONLY_POLICY], ctx);
    expect(d.verdict).toBe("deny");
    // The matched-policy deny variant carries regulatoryCitation; the
    // default-deny variant doesn't. Narrow via membership in the
    // wider variant (presence of breakGlassEligible field).
    if ("regulatoryCitation" in d) {
      expect(d.regulatoryCitation).toContain("SOX");
    }
  });

  it("FINANCE_READ_ONLY_POLICY does NOT match non-finance department", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      agentTier: 2,
      resourceTags: { department: "marketing" },
    };
    const d = evaluatePolicies([FINANCE_READ_ONLY_POLICY], ctx);
    // Falls through to default-deny.
    expect(d.matchedPolicyName).toBe("default");
  });

  it("PROD_WRITES_REQUIRE_HITL gates tier-2 prod writes", () => {
    const ctx: PolicyContext = {
      ...baseContext,
      agentTier: 2,
      resourceTags: { env: "prod" },
    };
    const d = evaluatePolicies([PROD_WRITES_REQUIRE_HITL], ctx);
    expect(d.verdict).toBe("require-hitl");
    if (d.verdict === "require-hitl") {
      expect(d.regulatoryCitation).toContain("SOC 2");
    }
  });
});

describe("applyBreakGlass — admin override invariants", () => {
  const eligibleDeny: PolicyDecision = {
    verdict: "deny",
    matchedPolicyName: "finance_agent_can_read_customers_but_not_write",
    reason: "policy fired",
    breakGlassEligible: true,
    regulatoryCitation: "SOX",
  };

  it("succeeds with admin reason ≥ 10 chars on eligible policy", () => {
    const r = applyBreakGlass({
      decision: eligibleDeny,
      reason: "audit cycle requires read access for compliance team",
      adminUserId: "admin_bob",
      invokedAt: "2026-04-29T15:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.overridden).toBe(true);
    expect(r.auditEntry?.action).toBe("policy.break_glass");
    expect(r.auditEntry?.details.adminUserId).toBe("admin_bob");
  });

  it("rejects reason shorter than 10 chars", () => {
    const r = applyBreakGlass({
      decision: eligibleDeny,
      reason: "short",
      adminUserId: "admin_bob",
      invokedAt: "2026-04-29T15:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("reason_too_short");
  });

  it("rejects override on default-deny (no policy to override)", () => {
    const defaultDeny: PolicyDecision = {
      verdict: "deny",
      matchedPolicyName: "default",
      reason: "no_matching_policy",
      breakGlassEligible: false,
    };
    const r = applyBreakGlass({
      decision: defaultDeny,
      reason: "this should not be allowed to override the default-deny",
      adminUserId: "admin_bob",
      invokedAt: "2026-04-29T15:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("default_deny_not_eligible");
  });

  it("rejects override on policy not flagged break-glass-eligible", () => {
    const ineligibleDeny: PolicyDecision = {
      verdict: "deny",
      matchedPolicyName: "agentic_commerce_requires_acat",
      reason: "policy fired",
      breakGlassEligible: false,
    };
    const r = applyBreakGlass({
      decision: ineligibleDeny,
      reason: "tried to override an ineligible policy",
      adminUserId: "admin_bob",
      invokedAt: "2026-04-29T15:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("policy_not_break_glass_eligible");
  });

  it("rejects override when decision already allows", () => {
    const allowDecision: PolicyDecision = {
      verdict: "allow",
      matchedPolicyName: "anything",
      reason: "matched",
    };
    const r = applyBreakGlass({
      decision: allowDecision,
      reason: "trying to break-glass an allow makes no sense",
      adminUserId: "admin_bob",
      invokedAt: "2026-04-29T15:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("decision_already_allows");
  });
});
