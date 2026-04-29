/**
 * hr-hiring-compliance-pack (R62) — tests.
 *
 * The "don't get sued for algorithmic discrimination" pack. Tests
 * verify each anti-discrimination invariant explicitly.
 *
 * Specifically guards against:
 *   - Pack id / version stability (so customer audits remain reproducible)
 *   - Agents NEVER autonomously reject candidates (Title VII defense)
 *   - iTutorGroup-case citation present (anti-slop guard)
 *   - NYC LL144 bias-audit data collection rule present
 *   - FCRA pre-adverse-action notice rule present
 *   - Protected-class feature-block rule present
 *   - ADA accommodation tracking rule present
 *   - Colorado SB 24-205 impact-assessment rule present
 *   - Default ACT scope is READ-ONLY
 *   - Pre-built queries cover EEOC + LL144 + FCRA + Colorado + ADA
 *   - Pricing tier matches Fortune 1000 / ATS vendor ICP
 */

import { describe, it, expect } from "vitest";
import {
  HR_HIRING_COMPLIANCE_PACK,
  getHrHiringCompliancePack,
  isAgentEnabledInHrPack,
} from "../vertical-packs/hr-hiring-compliance";

describe("HR_HIRING_COMPLIANCE_PACK — pack invariants", () => {
  it("has stable id, version, and substantive summary", () => {
    expect(HR_HIRING_COMPLIANCE_PACK.id).toBe("hr-hiring-compliance-v1");
    expect(HR_HIRING_COMPLIANCE_PACK.version).toBe("1.0.0");
    expect(HR_HIRING_COMPLIANCE_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets HR / talent acquisition / diversity buyer personas", () => {
    const persona =
      HR_HIRING_COMPLIANCE_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(
      /chief people|talent acquisition|chief diversity|hr operations/,
    );
  });

  it("declares the regulated SLA tier (matches NYC LL144 + CO SB 24-205 stakes)", () => {
    expect(HR_HIRING_COMPLIANCE_PACK.slaTier).toBe("regulated");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getHrHiringCompliancePack()).toBe(HR_HIRING_COMPLIANCE_PACK);
  });
});

describe("HR_HIRING_COMPLIANCE_PACK — agent allowlist", () => {
  it("includes core HR agents (resume parser, skills extractor, candidate matcher)", () => {
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) => a.includes("resume")),
    ).toBe(true);
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) => a.includes("skills")),
    ).toBe(true);
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) => a.includes("candidate-match")),
    ).toBe(true);
  });

  it("includes bias-audit + FCRA + ADA agents (the compliance core)", () => {
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) => a.includes("bias-audit")),
    ).toBe(true);
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) =>
        a.includes("adverse-action"),
      ),
    ).toBe(true);
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) =>
        a.includes("ada-accommodation"),
      ),
    ).toBe(true);
  });

  it("uses redaction-aware resume parser (protected-class defense)", () => {
    expect(
      HR_HIRING_COMPLIANCE_PACK.enabledAgents.some((a) =>
        a.includes("redacted"),
      ),
    ).toBe(true);
  });

  it("excludes inappropriate agents (no marketing, no consumer-facing)", () => {
    const banned = ["marketing", "sales", "consumer", "social-media", "ads"];
    for (const a of HR_HIRING_COMPLIANCE_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInHrPack handles known + unknown agents", () => {
    expect(isAgentEnabledInHrPack("resume-parser-redacted")).toBe(true);
    expect(isAgentEnabledInHrPack("marketing-blaster")).toBe(false);
  });
});

describe("HR_HIRING_COMPLIANCE_PACK — HITL rules cover the catastrophic risks", () => {
  it("FORBIDS autonomous candidate rejection (iTutorGroup-style defense)", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("autonomous-rejection"),
    );
    expect(rule).toBeDefined();
    // Anti-slop guard: must explicitly cite the iTutorGroup case.
    expect(rule?.description).toContain("iTutorGroup");
    expect(rule?.regulatoryCitation).toContain("Title VII");
    expect(rule?.regulatoryCitation).toContain("EEOC");
  });

  it("requires FCRA pre-adverse-action notice", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("fcra"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FCRA");
    expect(rule?.regulatoryCitation).toContain("1681");
  });

  it("captures NYC LL144 bias-audit data automatically", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("bias-audit"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("NYC Local Law 144");
    expect(rule?.regulatoryCitation).toContain("Colorado");
  });

  it("HARD-BLOCKS protected-class feature use (Title VII + ADEA + ADA + GINA)", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("protected-class"),
    );
    expect(rule).toBeDefined();
    // Must cite the specific anti-discrimination statutes.
    expect(rule?.regulatoryCitation).toContain("Title VII");
    expect(rule?.regulatoryCitation).toContain("ADEA");
    expect(rule?.regulatoryCitation).toContain("ADA");
    expect(rule?.regulatoryCitation).toContain("GINA");
  });

  it("requires ADA accommodation tracking + HR Director sign-off", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("accommodation"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("ADA");
  });

  it("enforces NYC LL144 candidate notice (10 business days before AEDT)", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("aedt-candidate-notice"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("NYC Local Law 144");
    expect(rule?.description.toLowerCase()).toMatch(/10 (business )?days/);
  });

  it("enforces Colorado SB 24-205 impact-assessment requirement", () => {
    const rule = HR_HIRING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("colorado-impact-assessment"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("Colorado SB 24-205");
  });
});

describe("HR_HIRING_COMPLIANCE_PACK — default ACT scope is read-only (anti-discrimination defense)", () => {
  it("max_cents is 0 (no autonomous spend; HR agents don't transact)", () => {
    expect(HR_HIRING_COMPLIANCE_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / parse / score / draft / alert / summary / analyze actions pre-allowed", () => {
    const allowed = HR_HIRING_COMPLIANCE_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|parse|score|draft|alert|summary|analyze)\..+/,
      );
    }
  });

  it("does NOT pre-allow candidate.reject.* or candidate.terminate.* (require HITL)", () => {
    const allowed = HR_HIRING_COMPLIANCE_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.candidate.reject.*");
    expect(allowed).not.toContain("agent.candidate.terminate.*");
    expect(allowed).not.toContain("agent.adverse_action.*");
  });

  it("default daily limit is conservative ($150)", () => {
    expect(HR_HIRING_COMPLIANCE_PACK.defaultDailyLimitCents).toBe(15_000);
  });
});

describe("HR_HIRING_COMPLIANCE_PACK — audit queries cover EEOC + LL144 + FCRA + ADA", () => {
  it("has an NYC LL144 bias-audit data query", () => {
    const q = HR_HIRING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("eedt-bias-audit"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("LL144");
  });

  it("has an FCRA adverse-action workflow query", () => {
    const q = HR_HIRING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("fcra"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext.toLowerCase()).toMatch(/cfpb|fcra/);
  });

  it("has an EEOC charge-response query (candidate journey)", () => {
    const q = HR_HIRING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("eeoc-charge"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("EEOC");
  });

  it("has a protected-class-block query (disparate-impact defense)", () => {
    const q = HR_HIRING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("protected-class"),
    );
    expect(q).toBeDefined();
  });

  it("has an ADA accommodation tracking query", () => {
    const q = HR_HIRING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("ada"),
    );
    expect(q).toBeDefined();
  });

  it("has a Colorado SB 24-205 impact-assessment query", () => {
    const q = HR_HIRING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("colorado"),
    );
    expect(q).toBeDefined();
  });
});

describe("HR_HIRING_COMPLIANCE_PACK — pricing matches HR-tech ICP", () => {
  it("ACV range is $30K-$150K (Fortune 1000 enterprise HR / ATS vendors)", () => {
    expect(HR_HIRING_COMPLIANCE_PACK.pricingTier.minAcvUsd).toBe(30_000);
    expect(HR_HIRING_COMPLIANCE_PACK.pricingTier.maxAcvUsd).toBe(150_000);
  });

  it("target customer size names Fortune 1000 + ATS + recruiting platforms + relevant jurisdictions", () => {
    const target =
      HR_HIRING_COMPLIANCE_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("fortune 1000");
    expect(target).toContain("applicant-tracking");
    expect(target).toContain("nyc");
    expect(target).toContain("colorado");
  });
});
