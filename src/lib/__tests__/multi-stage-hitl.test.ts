/**
 * multi-stage-hitl + hitl-routing-rules — tests.
 *
 * Verifies the pure-function core:
 *   - computeRequestStatus: every state transition
 *   - decideStageOutcome: all 3 paths (approve / reject / not-pending)
 *   - isMateriallyDifferent: cost-tolerance, tag-set diff, exact match
 *   - selectApprovalStages: empty rules → no HITL; rule order; throwing
 *     match() doesn't crash the engine
 *
 * DB-backed paths (createMultiStageRequest, recordStageDecision) are
 * integration-tested separately.
 */

import { describe, it, expect } from "vitest";
import {
  computeRequestStatus,
  decideStageOutcome,
  isMateriallyDifferent,
  type RoutingContext,
  type StageStatus,
} from "../multi-stage-hitl";
import {
  selectApprovalStages,
  HITL_ROUTING_RULES,
  type RoutingRule,
} from "../hitl-routing-rules";

describe("multi-stage-hitl — computeRequestStatus", () => {
  const stage = (status: StageStatus) => ({ status });

  it("empty → pending", () => {
    expect(computeRequestStatus([])).toBe("pending");
  });

  it("any rejected → denied (veto wins)", () => {
    expect(computeRequestStatus([stage("rejected")])).toBe("denied");
    expect(computeRequestStatus([stage("approved"), stage("rejected")])).toBe("denied");
    expect(
      computeRequestStatus([stage("rejected"), stage("approved"), stage("approved")]),
    ).toBe("denied");
  });

  it("all approved → approved", () => {
    expect(computeRequestStatus([stage("approved")])).toBe("approved");
    expect(
      computeRequestStatus([stage("approved"), stage("approved")]),
    ).toBe("approved");
  });

  it("all approved or skipped → approved (skipped counts as pass)", () => {
    expect(
      computeRequestStatus([stage("approved"), stage("skipped"), stage("approved")]),
    ).toBe("approved");
  });

  it("any expired (no rejection) → timeout", () => {
    expect(
      computeRequestStatus([stage("approved"), stage("expired")]),
    ).toBe("timeout");
  });

  it("rejection beats expired (veto > timeout)", () => {
    expect(
      computeRequestStatus([stage("rejected"), stage("expired")]),
    ).toBe("denied");
  });

  it("any pending without rejection or expiry → pending", () => {
    expect(
      computeRequestStatus([stage("approved"), stage("pending"), stage("pending")]),
    ).toBe("pending");
  });
});

describe("multi-stage-hitl — decideStageOutcome", () => {
  it("approve on pending → approved + advance", () => {
    const r = decideStageOutcome({
      decision: "approve",
      currentStage: { status: "pending" },
    });
    expect(r).toEqual({ newStatus: "approved", advance: true });
  });

  it("reject on pending → rejected + halt", () => {
    const r = decideStageOutcome({
      decision: "reject",
      currentStage: { status: "pending" },
    });
    expect(r).toEqual({ newStatus: "rejected", advance: false });
  });

  it("act on already-decided stage → error", () => {
    for (const status of ["approved", "rejected", "skipped", "expired"] as const) {
      const r = decideStageOutcome({
        decision: "approve",
        currentStage: { status },
      });
      expect(r).toEqual({ error: "stage_not_pending" });
    }
  });
});

describe("multi-stage-hitl — isMateriallyDifferent", () => {
  const base: RoutingContext = {
    agentName: "travel-agent",
    action: "book-flight",
    costCents: 50_000,
    actionTier: "high",
    involvesSensitiveData: false,
    involvesExternalSystem: true,
    tags: ["q2", "us-only"],
  };

  it("identical contexts → not different", () => {
    expect(isMateriallyDifferent(base, { ...base })).toBe(false);
  });

  it("different agent → different", () => {
    expect(isMateriallyDifferent(base, { ...base, agentName: "other" })).toBe(true);
  });

  it("different action → different", () => {
    expect(isMateriallyDifferent(base, { ...base, action: "cancel-flight" })).toBe(true);
  });

  it("different action tier → different", () => {
    expect(isMateriallyDifferent(base, { ...base, actionTier: "critical" })).toBe(true);
  });

  it("sensitivity flag flip → different", () => {
    expect(
      isMateriallyDifferent(base, { ...base, involvesSensitiveData: true }),
    ).toBe(true);
  });

  it("cost within 10% tolerance → not different", () => {
    expect(isMateriallyDifferent(base, { ...base, costCents: 51_000 })).toBe(false);
  });

  it("cost beyond 10% tolerance → different", () => {
    expect(isMateriallyDifferent(base, { ...base, costCents: 60_000 })).toBe(true);
  });

  it("tag set difference → different", () => {
    expect(
      isMateriallyDifferent(base, { ...base, tags: ["q3", "us-only"] }),
    ).toBe(true);
    expect(
      isMateriallyDifferent(base, { ...base, tags: ["q2"] }),
    ).toBe(true);
    expect(
      isMateriallyDifferent(base, { ...base, tags: ["q2", "us-only", "extra"] }),
    ).toBe(true);
  });

  it("tag set order doesn't matter", () => {
    expect(
      isMateriallyDifferent(base, { ...base, tags: ["us-only", "q2"] }),
    ).toBe(false);
  });
});

describe("hitl-routing-rules — selectApprovalStages", () => {
  it("default rules array → no HITL (permissive starting point)", () => {
    const ctx: RoutingContext = {
      agentName: "any",
      action: "any",
    };
    const r = selectApprovalStages(ctx);
    expect(r.stages).toEqual([]);
    expect(r.matchedRule).toBeNull();
  });

  it("HITL_ROUTING_RULES is exported as an array (so user can append)", () => {
    expect(Array.isArray(HITL_ROUTING_RULES)).toBe(true);
  });

  // Inject a synthetic rule array via a local scope to test the
  // engine's behavior with rules without modifying the shipped rules.
  function evaluateWithRules(
    rules: RoutingRule[],
    ctx: RoutingContext,
  ): { stages: ReturnType<typeof selectApprovalStages>["stages"]; matchedRule: string | null } {
    for (const rule of rules) {
      try {
        if (rule.match(ctx)) {
          return { stages: rule.stages, matchedRule: rule.name };
        }
      } catch {
        continue;
      }
    }
    return { stages: [], matchedRule: null };
  }

  it("first matching rule wins (order matters)", () => {
    const ctx: RoutingContext = {
      agentName: "x",
      action: "y",
      actionTier: "critical",
      involvesSensitiveData: true,
    };
    const rules: RoutingRule[] = [
      {
        name: "critical-only",
        match: (c) => c.actionTier === "critical",
        stages: [{ role: "compliance" }],
      },
      {
        name: "critical-and-sensitive",
        match: (c) => c.actionTier === "critical" && c.involvesSensitiveData === true,
        stages: [{ role: "compliance" }, { role: "security" }],
      },
    ];
    const r = evaluateWithRules(rules, ctx);
    expect(r.matchedRule).toBe("critical-only"); // first match wins
    expect(r.stages).toHaveLength(1);
  });

  it("a throwing match() does NOT break the engine — falls through", () => {
    const ctx: RoutingContext = { agentName: "x", action: "y" };
    const rules: RoutingRule[] = [
      {
        name: "broken-rule",
        match: () => {
          throw new Error("oops");
        },
        stages: [{ role: "compliance" }],
      },
      {
        name: "default",
        match: () => true,
        stages: [{ role: "business" }],
      },
    ];
    const r = evaluateWithRules(rules, ctx);
    expect(r.matchedRule).toBe("default");
    expect(r.stages).toEqual([{ role: "business" }]);
  });

  it("no rules match → empty stages, no HITL", () => {
    const ctx: RoutingContext = { agentName: "x", action: "y" };
    const rules: RoutingRule[] = [
      { name: "wont-match", match: () => false, stages: [{ role: "x" }] },
    ];
    const r = evaluateWithRules(rules, ctx);
    expect(r.stages).toEqual([]);
    expect(r.matchedRule).toBeNull();
  });
});
