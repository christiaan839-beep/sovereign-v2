/**
 * Inspector — R155 HITL Routing cross-implementation agreement.
 */
import { describe, it, expect } from "vitest";
import { routeToHITL, verifyHITLRouting } from "../src/hitl-routing.mjs";

const cleanInputs = {
  agentName: "x",
  actionClass: "internal_read",
  policyDecision: { verdict: "allow", matchedPolicyName: "p", reason: "ok" },
  viabilityScore: { vi: 1, recommendation: "proceed", rationale: "ok", penalties: { kl: 0, z: 0, novelty: 0 } },
  odtaResult: { ok: true, passes: { observability: true, decidability: true, timeliness: true, attestability: true }, timelinessBudgetMs: 50 },
};

describe("inspector HITL routing", () => {
  it("auto_proceeds when all signals clean", () => {
    const r = routeToHITL(cleanInputs);
    expect(r.kind).toBe("auto_proceed");
    expect(r.reason).toBe("all_signals_clean");
  });

  it("hard_deny on policy=deny short-circuits", () => {
    const r = routeToHITL({
      ...cleanInputs,
      policyDecision: { verdict: "deny", matchedPolicyName: "p", reason: "blocked", breakGlassEligible: false, regulatoryCitation: "SOX 404" },
    });
    expect(r.kind).toBe("hard_deny");
    expect(r.regulatoryCitation).toBe("SOX 404");
  });

  it("hitl_required on ODTA failure", () => {
    const r = routeToHITL({
      ...cleanInputs,
      odtaResult: { ok: false, failed: ["timeliness"], details: "x", timelinessBudgetMs: 50, auditEntry: { action: "x", resource: "x", details: {} } },
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("odta_failed");
  });

  it("hitl_required on viability=block", () => {
    const r = routeToHITL({
      ...cleanInputs,
      viabilityScore: { vi: -0.5, recommendation: "block", rationale: "drift", penalties: { kl: 1.0, z: 0, novelty: 0.4 } },
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("viability_below_block_threshold");
  });

  it("silent_approval on viability=proceed-with-warn", () => {
    const r = routeToHITL({
      ...cleanInputs,
      viabilityScore: { vi: 0.7, recommendation: "proceed", rationale: "warn", penalties: { kl: 0.3, z: 0, novelty: 0 } },
    });
    expect(r.kind).toBe("silent_approval");
    expect(r.reason).toBe("viability_warn");
  });

  it("always-HITL action class wins over allow policy", () => {
    const r = routeToHITL({
      ...cleanInputs,
      actionClass: "external_write",
      alwaysHITLClasses: ["external_write"],
    });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("always_hitl_action_class");
  });

  it("gate explicitly disabled returns hitl_required (conservative)", () => {
    const r = routeToHITL(cleanInputs, { gateEnabled: false });
    expect(r.kind).toBe("hitl_required");
    expect(r.reason).toBe("gate_disabled");
  });
});

describe("verifyHITLRouting — replay and confirm", () => {
  it("ok when claimed kind+reason match the replay", () => {
    const claimed = { kind: "auto_proceed", reason: "all_signals_clean" };
    const v = verifyHITLRouting({ input: cleanInputs, claimed });
    expect(v.ok).toBe(true);
  });

  it("errors named when claim mismatches", () => {
    const claimed = { kind: "hitl_required", reason: "policy_requires_hitl" };
    const v = verifyHITLRouting({ input: cleanInputs, claimed });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("kind mismatch"))).toBe(true);
  });
});
