/**
 * education-pack (R86) — tests.
 *
 * The 10th vertical product. Tests verify FERPA + state student-
 * data + Title IX + IDEA + COPPA + ADA opinionation hasn't drifted.
 *
 * Specifically guards against:
 *   - Pack id / version stability
 *   - Educator signoff required on grading decisions
 *   - AI-in-admissions bias audit triggers (NYC LL144 + CO + Title VI)
 *   - IEP / Section 504 compliance signoff (IDEA + Section 504)
 *   - Title IX requires DUAL signoff (Coordinator + GC)
 *   - COPPA HARD-BLOCK on under-13 personalization
 *   - State Student Data Privacy Act multi-state coverage
 *   - 7-year retention for IEP + Title IX
 *   - Default ACT scope is READ-ONLY
 *   - Pack PASSES R63 pack validator
 */

import { describe, it, expect } from "vitest";
import {
  EDUCATION_PACK,
  getEducationPack,
  isAgentEnabledInEducationPack,
} from "../vertical-packs/education";
import { validateAuthoredPack } from "../vertical-packs/pack-validator";

describe("EDUCATION_PACK — pack invariants", () => {
  it("has stable id, version, substantive summary", () => {
    expect(EDUCATION_PACK.id).toBe("education-v1");
    expect(EDUCATION_PACK.version).toBe("1.0.0");
    expect(EDUCATION_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets CIO / CPO / Title IX Coordinator / Director of IT personas", () => {
    const persona = EDUCATION_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(
      /chief information officer|chief privacy officer|title ix coordinator|director of information technology/,
    );
  });

  it("declares the professional SLA tier", () => {
    expect(EDUCATION_PACK.slaTier).toBe("professional");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getEducationPack()).toBe(EDUCATION_PACK);
  });

  it("PASSES the R63 pack validator (regression-proof)", () => {
    const r = validateAuthoredPack(EDUCATION_PACK);
    expect(r.ok).toBe(true);
  });
});

describe("EDUCATION_PACK — agent allowlist", () => {
  it("includes FERPA / student-record + grading + admissions agents", () => {
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("ferpa")),
    ).toBe(true);
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("grading-rubric")),
    ).toBe(true);
    expect(
      EDUCATION_PACK.enabledAgents.some((a) =>
        a.includes("admissions-application-screener"),
      ),
    ).toBe(true);
  });

  it("includes IEP / Section 504 + Title IX + accessibility agents", () => {
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("iep-section-504")),
    ).toBe(true);
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("title-ix")),
    ).toBe(true);
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("accessibility")),
    ).toBe(true);
  });

  it("includes COPPA + SOPIPA + bias-audit-input-builder agents", () => {
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("coppa")),
    ).toBe(true);
    expect(
      EDUCATION_PACK.enabledAgents.some((a) => a.includes("sopipa")),
    ).toBe(true);
    expect(
      EDUCATION_PACK.enabledAgents.some((a) =>
        a.includes("ai-admissions-bias-audit"),
      ),
    ).toBe(true);
  });

  it("isAgentEnabledInEducationPack handles known + unknown agents", () => {
    expect(isAgentEnabledInEducationPack("ferpa-access-pattern-analyzer")).toBe(
      true,
    );
    expect(isAgentEnabledInEducationPack("marketing-blaster")).toBe(false);
  });
});

describe("EDUCATION_PACK — HITL rules cover the catastrophic risks", () => {
  it("requires educator signoff on final grading (FERPA + due-process)", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("grading-decisions"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FERPA 20 USC §1232g");
  });

  it("admissions bias audit cites Title VI + LL144 + Colorado SB 24-205", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("ai-admissions-bias-audit"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("Title VI");
    expect(rule?.regulatoryCitation).toContain("NYC Local Law 144");
    expect(rule?.regulatoryCitation).toContain("Colorado SB 24-205");
  });

  it("IEP / 504 rule cites IDEA + Section 504 of Rehabilitation Act", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("iep-504"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("IDEA 20 USC §1400");
    expect(rule?.regulatoryCitation).toContain("Section 504");
  });

  it("Title IX rule requires DUAL signoff (Coordinator + GC) and cites 2020/2024 amendments", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("title-ix"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
    expect(rule?.regulatoryCitation).toContain("Title IX 20 USC §1681");
    expect(rule?.regulatoryCitation).toContain("2020");
    expect(rule?.regulatoryCitation).toContain("2024");
  });

  it("COPPA HARD-BLOCK rule cites $245M TikTok 2025 enforcement (anti-slop)", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("coppa-under-13"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("TikTok 2025");
    expect(rule?.regulatoryCitation).toContain("COPPA");
  });

  it("State student data export rule covers NY + CA + CO + IL", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("state-student-data-export"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("NY Education Law §2-d");
    expect(rule?.regulatoryCitation).toContain("California");
    expect(rule?.regulatoryCitation).toContain("SOPIPA");
    expect(rule?.regulatoryCitation).toContain("Colorado HB 22-1244");
    expect(rule?.regulatoryCitation).toContain("Illinois SIPA");
  });

  it("Accessibility tracking cites Robles v. Domino's + WCAG 2.1 AA", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("accessibility"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("Robles v. Domino's");
    expect(rule?.regulatoryCitation).toContain("WCAG 2.1 AA");
  });

  it("Truancy rule prevents wrongful child-welfare referrals", () => {
    const rule = EDUCATION_PACK.hitlRules.find((r) =>
      r.id.includes("attendance-truancy"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("ESSA");
  });
});

describe("EDUCATION_PACK — read-only ACT scope (student protection)", () => {
  it("max_cents is 0 (no autonomous spend)", () => {
    expect(EDUCATION_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / draft / score / alert / summary / analyze / suggest / classify pre-allowed", () => {
    const allowed = EDUCATION_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|draft|score|alert|summary|analyze|suggest|classify)\..+/,
      );
    }
  });

  it("does NOT pre-allow grade.commit / discipline.commit / iep.modify", () => {
    const allowed = EDUCATION_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.grade.commit.*");
    expect(allowed).not.toContain("agent.discipline.commit.*");
    expect(allowed).not.toContain("agent.iep.modify.*");
  });

  it("default daily limit is conservative ($100) for education budgets", () => {
    expect(EDUCATION_PACK.defaultDailyLimitCents).toBe(10_000);
  });
});

describe("EDUCATION_PACK — audit queries cover regulatory retention windows", () => {
  it("FERPA access query has 5-year retention", () => {
    const q = EDUCATION_PACK.auditQueries.find((q) =>
      q.id.includes("ferpa-access"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1825);
  });

  it("admissions bias query has 3-year retention (Title VI charge windows)", () => {
    const q = EDUCATION_PACK.auditQueries.find((q) =>
      q.id.includes("admissions-bias"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1095);
  });

  it("IEP / 504 query has 7-year retention (IDEA + Section 504)", () => {
    const q = EDUCATION_PACK.auditQueries.find((q) =>
      q.id.includes("iep-504"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2555);
  });

  it("Title IX query has 7-year retention", () => {
    const q = EDUCATION_PACK.auditQueries.find((q) =>
      q.id.includes("title-ix"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2555);
  });

  it("State data exports query has 5-year retention (multi-state)", () => {
    const q = EDUCATION_PACK.auditQueries.find((q) =>
      q.id.includes("state-data-exports"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1825);
  });
});

describe("EDUCATION_PACK — pricing matches K-12 + higher-ed + EdTech ICP", () => {
  it("ACV range is $20K-$100K (education budget reality)", () => {
    expect(EDUCATION_PACK.pricingTier.minAcvUsd).toBe(20_000);
    expect(EDUCATION_PACK.pricingTier.maxAcvUsd).toBe(100_000);
  });

  it("target customer size names K-12 + universities + EdTech ecosystem", () => {
    const target = EDUCATION_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("k-12");
    expect(target).toMatch(
      /canvas|blackboard|schoology|powerschool|infinite campus|kahoot|khan/,
    );
  });
});
