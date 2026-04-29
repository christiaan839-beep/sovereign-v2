/**
 * healthcare-claims-pack (R49) — tests.
 *
 * Same invariant pattern as the banking-compliance pack tests:
 * pack data is opinionated knowledge encoded in TypeScript; tests
 * verify the opinionation hasn't drifted.
 *
 * Specifically guards against:
 *   - Pack id / version stability (changing breaks customer audit trails)
 *   - HIPAA-mandatory frameworks present
 *   - Curated agent allowlist excludes inappropriate agents
 *   - HITL rules cover the UHC-class-action vector + breach notification
 *   - Default ACT scope is READ-ONLY (defense in depth — PHI never
 *     auto-exports)
 *   - FDA 21 CFR Part 11 satisfied via the R34 CADC signature primitive
 *   - Pricing tier matches the wedge ICP (hospital systems / large plans)
 */

import { describe, it, expect } from "vitest";
import {
  HEALTHCARE_CLAIMS_PACK,
  getHealthcareClaimsPack,
  isAgentEnabledInHealthcarePack,
} from "../vertical-packs/healthcare-claims";

describe("HEALTHCARE_CLAIMS_PACK — pack invariants", () => {
  it("has stable id, version, summary length", () => {
    expect(HEALTHCARE_CLAIMS_PACK.id).toBe("healthcare-claims-v1");
    expect(HEALTHCARE_CLAIMS_PACK.version).toBe("1.0.0");
    expect(HEALTHCARE_CLAIMS_PACK.summary.length).toBeGreaterThan(100);
  });

  it("targets healthcare compliance / privacy buyer personas", () => {
    expect(HEALTHCARE_CLAIMS_PACK.targetBuyerPersona.toLowerCase()).toMatch(
      /chief compliance|privacy officer|revenue cycle|clinical operations/,
    );
  });

  it("declares the regulated SLA tier", () => {
    expect(HEALTHCARE_CLAIMS_PACK.slaTier).toBe("regulated");
  });

  it("maps to HIPAA + HITRUST + GDPR (the actually-required frameworks)", () => {
    expect(HEALTHCARE_CLAIMS_PACK.complianceFrameworks).toContain("hipaa");
    expect(HEALTHCARE_CLAIMS_PACK.complianceFrameworks).toContain("hitrust");
    expect(HEALTHCARE_CLAIMS_PACK.complianceFrameworks).toContain("gdpr");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getHealthcareClaimsPack()).toBe(HEALTHCARE_CLAIMS_PACK);
  });
});

describe("HEALTHCARE_CLAIMS_PACK — agent allowlist", () => {
  it("includes claims pipeline agents (eligibility + prior-auth + denial appeal)", () => {
    expect(
      HEALTHCARE_CLAIMS_PACK.enabledAgents.some((a) =>
        a.includes("eligibility"),
      ),
    ).toBe(true);
    expect(
      HEALTHCARE_CLAIMS_PACK.enabledAgents.some((a) =>
        a.includes("prior-authorization"),
      ),
    ).toBe(true);
    expect(
      HEALTHCARE_CLAIMS_PACK.enabledAgents.some((a) => a.includes("denial")),
    ).toBe(true);
  });

  it("includes HIPAA + OCR audit agents", () => {
    expect(
      HEALTHCARE_CLAIMS_PACK.enabledAgents.some((a) => a.includes("hipaa")),
    ).toBe(true);
    expect(
      HEALTHCARE_CLAIMS_PACK.enabledAgents.some((a) => a.includes("ocr")),
    ).toBe(true);
  });

  it("includes FDA 21 CFR Part 11 validator (clinical trials)", () => {
    expect(
      HEALTHCARE_CLAIMS_PACK.enabledAgents.some((a) => a.includes("fda")),
    ).toBe(true);
  });

  it("excludes inappropriate agents (no marketing, no sales, no consumer-facing)", () => {
    const banned = ["marketing", "sales", "consumer", "social-media", "ads"];
    for (const a of HEALTHCARE_CLAIMS_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInHealthcarePack handles known + unknown agents", () => {
    expect(isAgentEnabledInHealthcarePack("hipaa-breach-detector")).toBe(true);
    expect(isAgentEnabledInHealthcarePack("marketing-blaster")).toBe(false);
  });
});

describe("HEALTHCARE_CLAIMS_PACK — HITL rules cover the right risks", () => {
  it("forces DUAL approval on PHI exports (HIPAA §164.312)", () => {
    const exportRule = HEALTHCARE_CLAIMS_PACK.hitlRules.find((r) =>
      r.id.includes("phi-export"),
    );
    expect(exportRule).toBeDefined();
    expect(exportRule?.requiredApprovers).toBe(2);
    expect(exportRule?.regulatoryCitation).toContain("164.312");
  });

  it("requires PHYSICIAN signoff on prior-auth denials (UHC-class-action defense)", () => {
    const denialRule = HEALTHCARE_CLAIMS_PACK.hitlRules.find((r) =>
      r.id.includes("prior-auth-denial"),
    );
    expect(denialRule).toBeDefined();
    expect(denialRule?.requiredApprovers).toBe(1);
    // The description must explicitly reference UHC — this is the
    // anti-slop guard that ensures the rule exists for the right reason.
    expect(denialRule?.description.toLowerCase()).toContain("unitedhealthcare");
  });

  it("requires DUAL approval on breach notifications (HITECH 60-day window)", () => {
    const breachRule = HEALTHCARE_CLAIMS_PACK.hitlRules.find((r) =>
      r.id.includes("breach-notification"),
    );
    expect(breachRule).toBeDefined();
    expect(breachRule?.requiredApprovers).toBe(2);
    expect(breachRule?.regulatoryCitation).toContain("HITECH");
  });

  it("requires QA signoff on FDA submissions (21 CFR Part 11)", () => {
    const fdaRule = HEALTHCARE_CLAIMS_PACK.hitlRules.find((r) =>
      r.id.includes("fda"),
    );
    expect(fdaRule).toBeDefined();
    expect(fdaRule?.regulatoryCitation).toContain("21 CFR Part 11");
  });

  it("blocks vendor data-sharing without an executed BAA (HIPAA §164.308(b))", () => {
    const baaRule = HEALTHCARE_CLAIMS_PACK.hitlRules.find((r) =>
      r.id.includes("vendor-baa"),
    );
    expect(baaRule).toBeDefined();
    expect(baaRule?.regulatoryCitation).toContain("164.308(b)");
  });
});

describe("HEALTHCARE_CLAIMS_PACK — default ACT scope is read-only (PHI defense)", () => {
  it("max_cents is 0 (no autonomous spend; PHI agents don't transact)", () => {
    expect(HEALTHCARE_CLAIMS_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / draft / alert / summary / analyze / eligibility / code-audit actions are pre-allowed", () => {
    const allowed = HEALTHCARE_CLAIMS_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|draft|alert|summary|analyze|eligibility|code)\..+/,
      );
    }
  });

  it("default daily limit is conservative ($200; reflects volume, not aggression)", () => {
    expect(HEALTHCARE_CLAIMS_PACK.defaultDailyLimitCents).toBe(20_000);
  });
});

describe("HEALTHCARE_CLAIMS_PACK — audit queries cover OCR / FDA / OIG asks", () => {
  it("has a PHI-access query (HIPAA §164.308(a)(1)(ii)(D))", () => {
    const q = HEALTHCARE_CLAIMS_PACK.auditQueries.find((q) =>
      q.id.includes("phi-access"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toMatch(/OCR|HIPAA/);
  });

  it("has a breach-detection query (HITECH 60-day window evidence)", () => {
    const q = HEALTHCARE_CLAIMS_PACK.auditQueries.find((q) =>
      q.id.includes("breach"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("HITECH");
  });

  it("has a denials-with-physician-signoff query (UHC defense)", () => {
    const q = HEALTHCARE_CLAIMS_PACK.auditQueries.find((q) =>
      q.id.includes("denials"),
    );
    expect(q).toBeDefined();
  });

  it("has an FDA-submission artifact query (21 CFR Part 11)", () => {
    const q = HEALTHCARE_CLAIMS_PACK.auditQueries.find((q) =>
      q.id.includes("fda"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("21 CFR Part 11");
  });

  it("has a vendor-BAA-status query (HIPAA §164.308(b))", () => {
    const q = HEALTHCARE_CLAIMS_PACK.auditQueries.find((q) =>
      q.id.includes("vendor-baa"),
    );
    expect(q).toBeDefined();
  });
});

describe("HEALTHCARE_CLAIMS_PACK — pricing matches healthcare ICP", () => {
  it("ACV range is $50K-$300K (hospital systems / large health plans)", () => {
    expect(HEALTHCARE_CLAIMS_PACK.pricingTier.minAcvUsd).toBe(50_000);
    expect(HEALTHCARE_CLAIMS_PACK.pricingTier.maxAcvUsd).toBe(300_000);
  });

  it("target customer size names hospital systems + ACOs + health plans + pharma", () => {
    const target =
      HEALTHCARE_CLAIMS_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("hospital");
    expect(target).toContain("aco");
    expect(target).toContain("pharma");
  });
});
