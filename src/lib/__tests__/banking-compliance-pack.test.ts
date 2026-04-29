/**
 * banking-compliance-pack (R47) — tests.
 *
 * Pack DEFINITIONS are pure data. Tests verify the pack invariants:
 *   - Has the required compliance frameworks
 *   - Allowlisted agents are non-empty + reasonable
 *   - HITL rules cover SAR/CTR + customer data export + examination
 *     responses
 *   - Default ACT scope is read-only (banking-compliance pack
 *     should NEVER pre-authorize agent spend)
 *   - Audit queries cover the OCC/FinCEN/SOC 2 examination surfaces
 *   - Pricing tier matches the wedge ICP
 */

import { describe, it, expect } from "vitest";
import {
  BANKING_COMPLIANCE_PACK,
  getBankingCompliancePack,
  isAgentEnabledInPack,
  findAuditQueryById,
} from "../vertical-packs/banking-compliance";

describe("BANKING_COMPLIANCE_PACK — pack invariants", () => {
  it("has stable id + version + summary", () => {
    expect(BANKING_COMPLIANCE_PACK.id).toBe("banking-compliance-v1");
    expect(BANKING_COMPLIANCE_PACK.version).toBe("1.0.0");
    expect(BANKING_COMPLIANCE_PACK.summary.length).toBeGreaterThan(50);
  });

  it("targets the right buyer persona", () => {
    expect(BANKING_COMPLIANCE_PACK.targetBuyerPersona.toLowerCase()).toMatch(
      /chief compliance|compliance officer|bsa|risk/,
    );
  });

  it("declares the regulated SLA tier", () => {
    expect(BANKING_COMPLIANCE_PACK.slaTier).toBe("regulated");
  });

  it("maps to the OCC + SEC + FFIEC frameworks (the actual exam authorities)", () => {
    expect(BANKING_COMPLIANCE_PACK.complianceFrameworks).toContain(
      "occ-handbook",
    );
    expect(BANKING_COMPLIANCE_PACK.complianceFrameworks).toContain(
      "ffiec-it-handbook",
    );
    expect(BANKING_COMPLIANCE_PACK.complianceFrameworks).toContain(
      "sec-rule-17a-4",
    );
  });
});

describe("BANKING_COMPLIANCE_PACK — agent allowlist", () => {
  it("has at least 8 enabled agents", () => {
    expect(BANKING_COMPLIANCE_PACK.enabledAgents.length).toBeGreaterThanOrEqual(
      8,
    );
  });

  it("includes BSA-pipeline agents (SAR + CTR drafts)", () => {
    expect(
      BANKING_COMPLIANCE_PACK.enabledAgents.some((a) => a.includes("sar")),
    ).toBe(true);
    expect(
      BANKING_COMPLIANCE_PACK.enabledAgents.some((a) => a.includes("ctr")),
    ).toBe(true);
  });

  it("does NOT include marketing / sales agents (out of scope for compliance)", () => {
    const banned = ["marketing", "sales", "social-media", "email-blast", "ads"];
    for (const a of BANKING_COMPLIANCE_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInPack works for known + unknown agents", () => {
    expect(
      isAgentEnabledInPack(BANKING_COMPLIANCE_PACK, "sar-draft-assistant"),
    ).toBe(true);
    expect(
      isAgentEnabledInPack(BANKING_COMPLIANCE_PACK, "marketing-blaster"),
    ).toBe(false);
  });
});

describe("BANKING_COMPLIANCE_PACK — HITL rules cover the right risks", () => {
  it("forces HITL on SAR / CTR drafts (BSA Rule 1020)", () => {
    const sarRule = BANKING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("sar-ctr"),
    );
    expect(sarRule).toBeDefined();
    expect(sarRule?.regulatoryCitation).toContain("31 CFR 1020.320");
  });

  it("forces DUAL approval on customer-data exports (GLBA Safeguards)", () => {
    const exportRule = BANKING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("customer-data-export"),
    );
    expect(exportRule).toBeDefined();
    expect(exportRule?.requiredApprovers).toBe(2);
  });

  it("requires CCO sign-off on examination responses", () => {
    const examRule = BANKING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("examination-response"),
    );
    expect(examRule).toBeDefined();
  });

  it("requires HITL review on regulatory-policy drift detection", () => {
    const driftRule = BANKING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("policy-change"),
    );
    expect(driftRule).toBeDefined();
  });

  it("requires HITL on vendor-onboarding outputs (OCC 2013-29)", () => {
    const vendorRule = BANKING_COMPLIANCE_PACK.hitlRules.find((r) =>
      r.id.includes("vendor"),
    );
    expect(vendorRule).toBeDefined();
    expect(vendorRule?.regulatoryCitation).toContain("OCC Bulletin 2013-29");
  });
});

describe("BANKING_COMPLIANCE_PACK — default ACT scopes are read-only (defense in depth)", () => {
  it("default max_cents is 0 (no autonomous spend)", () => {
    expect(BANKING_COMPLIANCE_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / draft / alert / summarize / analyze actions are pre-allowed", () => {
    const allowed = BANKING_COMPLIANCE_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|draft|alert|summary|analyze)\.\*$/,
      );
    }
  });

  it("default daily limit is conservative ($100)", () => {
    expect(BANKING_COMPLIANCE_PACK.defaultDailyLimitCents).toBe(10_000);
  });
});

describe("BANKING_COMPLIANCE_PACK — audit queries cover examiner asks", () => {
  it("has an SAR/CTR pipeline reconstruction query", () => {
    const q = BANKING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("sar-ctr"),
    );
    expect(q).toBeDefined();
    expect(q?.actionPrefix).toBe("agent.bsa.");
  });

  it("has a customer-data-touches query", () => {
    const q = BANKING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("customer-data"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toMatch(/OCC|SOC 2|examination/i);
  });

  it("has a vendor-risk-decisions query (OCC 2013-29)", () => {
    const q = BANKING_COMPLIANCE_PACK.auditQueries.find((q) =>
      q.id.includes("vendor"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("2013-29");
  });

  it("findAuditQueryById returns the right row + null for unknown", () => {
    expect(
      findAuditQueryById(
        BANKING_COMPLIANCE_PACK,
        "banking-audit-anomalies-180d",
      ),
    ).not.toBeNull();
    expect(
      findAuditQueryById(BANKING_COMPLIANCE_PACK, "does-not-exist"),
    ).toBeNull();
  });
});

describe("BANKING_COMPLIANCE_PACK — pricing tier matches wedge ICP", () => {
  it("ACV range is $25K-$150K (community bank / mid-market RIA fit)", () => {
    expect(BANKING_COMPLIANCE_PACK.pricingTier.minAcvUsd).toBe(25_000);
    expect(BANKING_COMPLIANCE_PACK.pricingTier.maxAcvUsd).toBe(150_000);
  });

  it("target customer size names community banks + RIAs explicitly", () => {
    const target =
      BANKING_COMPLIANCE_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("community bank");
    expect(target).toContain("ria");
  });
});

describe("getBankingCompliancePack helper", () => {
  it("returns the canonical pack", () => {
    expect(getBankingCompliancePack()).toBe(BANKING_COMPLIANCE_PACK);
  });
});
