/**
 * workforce-transformation-pack (R72) — tests.
 *
 * Same invariant pattern as banking/healthcare/legal/HR/FedRAMP packs.
 * R72 covers the AI-driven RESTRUCTURING use case (vs R62 which
 * covers AI-driven HIRING).
 *
 * Specifically guards against:
 *   - Pack id / version stability
 *   - 3-signature requirement on elimination decisions
 *   - WARN Act trigger rule present
 *   - ADEA disparate-impact rule with case citations
 *     (Smith v. Jackson, Meacham v. Knolls)
 *   - Title VII disparate-impact rule
 *   - Union NLRA §8(a)(5) bargaining rule
 *   - Augmentation-must-be-considered rule (Forrester anti-AI-washing
 *     defense; explicit reference required)
 *   - Default ACT scope is READ-ONLY
 *   - Pre-built queries cover EEOC + DOL + NLRB + SEC investigations
 */

import { describe, it, expect } from "vitest";
import {
  WORKFORCE_TRANSFORMATION_PACK,
  getWorkforceTransformationPack,
  isAgentEnabledInWorkforcePack,
} from "../vertical-packs/workforce-transformation";
import { validateAuthoredPack } from "../vertical-packs/pack-validator";

describe("WORKFORCE_TRANSFORMATION_PACK — pack invariants", () => {
  it("has stable id, version, substantive summary", () => {
    expect(WORKFORCE_TRANSFORMATION_PACK.id).toBe("workforce-transformation-v1");
    expect(WORKFORCE_TRANSFORMATION_PACK.version).toBe("1.0.0");
    expect(WORKFORCE_TRANSFORMATION_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets CHRO / Chief Strategy / COO / GC personas", () => {
    const persona =
      WORKFORCE_TRANSFORMATION_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(
      /chief people|chief strategy|coo|chief ai|general counsel/,
    );
  });

  it("declares the regulated SLA tier (matches restructuring stakes)", () => {
    expect(WORKFORCE_TRANSFORMATION_PACK.slaTier).toBe("regulated");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getWorkforceTransformationPack()).toBe(
      WORKFORCE_TRANSFORMATION_PACK,
    );
  });

  it("PASSES the R63 pack validator (regression-proof)", () => {
    const r = validateAuthoredPack(WORKFORCE_TRANSFORMATION_PACK);
    expect(r.ok).toBe(true);
  });
});

describe("WORKFORCE_TRANSFORMATION_PACK — agent allowlist", () => {
  it("includes core analysis agents (decomposer, feasibility scorer, augmenter)", () => {
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("task-decomposer"),
      ),
    ).toBe(true);
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("automation-feasibility"),
      ),
    ).toBe(true);
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("augmentation-vs-replacement"),
      ),
    ).toBe(true);
  });

  it("includes legal-defense agents (WARN-Act, ADEA, disparate-impact)", () => {
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("warn-act-trigger"),
      ),
    ).toBe(true);
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("adea-disparate-impact"),
      ),
    ).toBe(true);
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("disparate-impact"),
      ),
    ).toBe(true);
  });

  it("includes redeployment agents (skill-gap, pathway, retraining)", () => {
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("skill-gap"),
      ),
    ).toBe(true);
    expect(
      WORKFORCE_TRANSFORMATION_PACK.enabledAgents.some((a) =>
        a.includes("redeployment"),
      ),
    ).toBe(true);
  });

  it("excludes inappropriate agents", () => {
    const banned = ["marketing", "sales", "consumer", "social-media"];
    for (const a of WORKFORCE_TRANSFORMATION_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInWorkforcePack handles known + unknown", () => {
    expect(isAgentEnabledInWorkforcePack("warn-act-trigger-analyzer")).toBe(
      true,
    );
    expect(isAgentEnabledInWorkforcePack("marketing-blaster")).toBe(false);
  });
});

describe("WORKFORCE_TRANSFORMATION_PACK — HITL rules cover catastrophic risks", () => {
  it("requires THREE signatures on elimination decisions (CHRO + GC + BU exec)", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("restructuring-decisions-need-signed-analysis"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(3);
    expect(rule?.regulatoryCitation).toContain("Title VII");
    expect(rule?.regulatoryCitation).toContain("ADEA");
    expect(rule?.regulatoryCitation).toContain("WARN");
  });

  it("WARN Act 60-day-notice rule cites federal + state mini-WARN laws", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("warn-act"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("WARN Act 29 USC 2101");
    expect(rule?.regulatoryCitation).toContain("CA Labor Code");
    expect(rule?.regulatoryCitation).toContain("NY Labor Law");
  });

  it("ADEA disparate-impact rule cites Smith v. Jackson + Meacham v. Knolls", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("adea"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("Smith v. City of Jackson");
    expect(rule?.regulatoryCitation).toContain("Meacham v. Knolls");
  });

  it("Title VII disparate-impact rule cites Wards Cove + 1991 Civil Rights Act", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find(
      (r) => r.id.includes("title-vii"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("Wards Cove");
    expect(rule?.regulatoryCitation).toContain("1991 Civil Rights Act");
  });

  it("Union NLRA rule cites §8(a)(5) + First National Maintenance + Fibreboard", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("union"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("NLRA §8(a)(5)");
    expect(rule?.regulatoryCitation).toContain("First National Maintenance");
    expect(rule?.regulatoryCitation).toContain("Fibreboard");
  });

  it("AUGMENTATION-MUST-BE-CONSIDERED rule explicitly cites Forrester (anti-slop)", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("augmentation-must-be-considered"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("Forrester");
    expect(rule?.description.toLowerCase()).toMatch(/reverse|reversal/);
  });

  it("shareholder-disclosure rule cites Item 2.05 + Reg S-K MD&A", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("shareholder"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("Item 2.05");
    expect(rule?.regulatoryCitation).toContain("Reg S-K");
  });

  it("severance ERISA rule cites COBRA + state mini-COBRA", () => {
    const rule = WORKFORCE_TRANSFORMATION_PACK.hitlRules.find((r) =>
      r.id.includes("severance"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("ERISA");
    expect(rule?.regulatoryCitation).toContain("COBRA");
  });
});

describe("WORKFORCE_TRANSFORMATION_PACK — default ACT scope is read-only (analysis-only)", () => {
  it("max_cents is 0 (no autonomous commit; restructuring is human-decided)", () => {
    expect(WORKFORCE_TRANSFORMATION_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / analyze / score / draft / summary / alert / compute pre-allowed", () => {
    const allowed =
      WORKFORCE_TRANSFORMATION_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|analyze|score|draft|summary|alert|compute)\..+/,
      );
    }
  });

  it("does NOT pre-allow elimination.commit / restructure.execute / layoff.send", () => {
    const allowed =
      WORKFORCE_TRANSFORMATION_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.elimination.*");
    expect(allowed).not.toContain("agent.restructure.*");
    expect(allowed).not.toContain("agent.layoff.*");
  });

  it("default daily limit is conservative ($250 - reflects analysis volume)", () => {
    expect(WORKFORCE_TRANSFORMATION_PACK.defaultDailyLimitCents).toBe(25_000);
  });
});

describe("WORKFORCE_TRANSFORMATION_PACK — audit queries cover EEOC + DOL + NLRB + SEC", () => {
  it("has restructuring-decisions query (3-year EEOC charge window)", () => {
    const q = WORKFORCE_TRANSFORMATION_PACK.auditQueries.find((q) =>
      q.id.includes("restructuring-decisions"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1095);
    expect(q?.audienceContext).toContain("EEOC");
  });

  it("has WARN-Act-triggers query (DOL + private class action defense)", () => {
    const q = WORKFORCE_TRANSFORMATION_PACK.auditQueries.find((q) =>
      q.id.includes("warn-act"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("DOL");
  });

  it("has disparate-impact statistics query (3-year ADEA window)", () => {
    const q = WORKFORCE_TRANSFORMATION_PACK.auditQueries.find((q) =>
      q.id.includes("disparate-impact"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1095);
  });

  it("has augmentation-considered query (anti-AI-washing defense)", () => {
    const q = WORKFORCE_TRANSFORMATION_PACK.auditQueries.find((q) =>
      q.id.includes("augmentation"),
    );
    expect(q).toBeDefined();
    expect(q?.description.toLowerCase()).toMatch(/forrester|ai-washing/);
  });

  it("has union-affected query (NLRB charge defense)", () => {
    const q = WORKFORCE_TRANSFORMATION_PACK.auditQueries.find((q) =>
      q.id.includes("union"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("NLRB");
  });

  it("has shareholder-disclosures query (SEC investigation defense)", () => {
    const q = WORKFORCE_TRANSFORMATION_PACK.auditQueries.find((q) =>
      q.id.includes("shareholder"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("SEC");
  });
});

describe("WORKFORCE_TRANSFORMATION_PACK — pricing matches enterprise transformation ICP", () => {
  it("ACV range is $50K-$300K (Fortune 1000 + Big-4 consulting firms)", () => {
    expect(WORKFORCE_TRANSFORMATION_PACK.pricingTier.minAcvUsd).toBe(50_000);
    expect(WORKFORCE_TRANSFORMATION_PACK.pricingTier.maxAcvUsd).toBe(300_000);
  });

  it("target customer size names Fortune 1000 + BCG/McKinsey/Bain consulting", () => {
    const target =
      WORKFORCE_TRANSFORMATION_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("fortune 1000");
    expect(target).toMatch(/bcg|mckinsey|bain|accenture|deloitte/);
  });
});
