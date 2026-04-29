/**
 * retail-ecommerce-pack (R85) — tests.
 *
 * The 9th vertical product. Pack data is opinionated regulatory
 * + Klarna-case-defense knowledge. Tests verify the opinionation
 * hasn't drifted.
 *
 * Specifically guards against:
 *   - Pack id / version stability
 *   - Klarna-case citation present in customer-service rule (anti-slop)
 *   - CCPA + CPRA + GDPR Art 22 + COPPA + ADA Title III rules
 *   - Robles v. Domino's citation in ADA rule (anti-slop)
 *   - PCI DSS PAN-blocking rule with PII guard reference
 *   - FTC §5 + Robinson-Patman pricing rule
 *   - Default ACT scope is READ-ONLY (no autonomous pricing,
 *     marketing send, or account modification)
 *   - Pack PASSES R63 pack validator
 */

import { describe, it, expect } from "vitest";
import {
  RETAIL_ECOMMERCE_PACK,
  getRetailEcommercePack,
  isAgentEnabledInRetailPack,
} from "../vertical-packs/retail-ecommerce";
import { validateAuthoredPack } from "../vertical-packs/pack-validator";

describe("RETAIL_ECOMMERCE_PACK — pack invariants", () => {
  it("has stable id, version, substantive summary", () => {
    expect(RETAIL_ECOMMERCE_PACK.id).toBe("retail-ecommerce-v1");
    expect(RETAIL_ECOMMERCE_PACK.version).toBe("1.0.0");
    expect(RETAIL_ECOMMERCE_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets CCO / VP E-Commerce / CMO / Trust & Safety personas", () => {
    const persona = RETAIL_ECOMMERCE_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(
      /chief customer|vp of e-commerce|chief marketing|trust & safety/,
    );
  });

  it("declares the professional SLA tier (mid-market consumer)", () => {
    expect(RETAIL_ECOMMERCE_PACK.slaTier).toBe("professional");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getRetailEcommercePack()).toBe(RETAIL_ECOMMERCE_PACK);
  });

  it("PASSES the R63 pack validator (regression-proof)", () => {
    const r = validateAuthoredPack(RETAIL_ECOMMERCE_PACK);
    expect(r.ok).toBe(true);
  });
});

describe("RETAIL_ECOMMERCE_PACK — agent allowlist", () => {
  it("includes core CX agents (triage, order status, returns)", () => {
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) =>
        a.includes("customer-service"),
      ),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) => a.includes("order-status")),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) =>
        a.includes("return-policy"),
      ),
    ).toBe(true);
  });

  it("includes pricing + recommendation + promo agents", () => {
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) =>
        a.includes("dynamic-pricing"),
      ),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) =>
        a.includes("product-recommendation"),
      ),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) => a.includes("promotion")),
    ).toBe(true);
  });

  it("includes compliance agents (CCPA, GDPR, ADA, fake-review)", () => {
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) => a.includes("ccpa")),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) => a.includes("gdpr-art22")),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) => a.includes("ada")),
    ).toBe(true);
    expect(
      RETAIL_ECOMMERCE_PACK.enabledAgents.some((a) =>
        a.includes("review-authenticity"),
      ),
    ).toBe(true);
  });

  it("isAgentEnabledInRetailPack handles known + unknown agents", () => {
    expect(isAgentEnabledInRetailPack("dynamic-pricing-recommender")).toBe(true);
    expect(isAgentEnabledInRetailPack("marketing-blaster")).toBe(false);
  });
});

describe("RETAIL_ECOMMERCE_PACK — HITL rules cover catastrophic risks", () => {
  it("FORBIDS autonomous high-value customer service (Klarna defense — anti-slop)", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("customer-replacement"),
    );
    expect(rule).toBeDefined();
    // Anti-slop guard: must explicitly cite Klarna 2024 reversal.
    expect(rule?.description).toContain("Klarna");
    expect(rule?.regulatoryCitation).toContain("FTC Act §5");
  });

  it("HARD-BLOCKS unfair dynamic pricing (FTC + Robinson-Patman)", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("pricing"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
    expect(rule?.regulatoryCitation).toContain("Robinson-Patman");
    expect(rule?.regulatoryCitation).toContain("FTC Act §5");
  });

  it("requires Privacy Officer signoff on CCPA DSR responses", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("ccpa-data-subject-request"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("CCPA");
    expect(rule?.regulatoryCitation).toContain("CPRA");
  });

  it("auto-generates GDPR Art 22 explanation for EEA subjects", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("gdpr-art22"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("GDPR Art 22");
    expect(rule?.regulatoryCitation).toContain("EDPB");
  });

  it("HARD-BLOCKS COPPA-violating personalization for under-13 users", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("coppa"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("COPPA");
    expect(rule?.regulatoryCitation).toContain("16 CFR Part 312");
  });

  it("ADA Title III interaction logging cites Robles v. Domino's (anti-slop)", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("ada"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("Robles");
    expect(rule?.regulatoryCitation).toContain("Robles v. Domino's");
    expect(rule?.regulatoryCitation).toContain("WCAG 2.1 AA");
  });

  it("fake-review detection requires T&S signoff (FTC Endorsement Guides)", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("fake-review"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FTC Endorsement Guides");
  });

  it("PCI DSS PAN-blocking rule references PII guard + tokenization", () => {
    const rule = RETAIL_ECOMMERCE_PACK.hitlRules.find((r) =>
      r.id.includes("pci-dss"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("pii-guard");
    expect(rule?.regulatoryCitation).toContain("PCI DSS 4.0");
  });
});

describe("RETAIL_ECOMMERCE_PACK — read-only ACT scope (consumer protection)", () => {
  it("max_cents is 0 (no autonomous spend)", () => {
    expect(RETAIL_ECOMMERCE_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / draft / classify / recommend / alert / summary / analyze / triage / flag pre-allowed", () => {
    const allowed = RETAIL_ECOMMERCE_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|draft|classify|recommend|alert|summary|analyze|triage|flag)\..+/,
      );
    }
  });

  it("does NOT pre-allow pricing.commit / marketing.send / customer.modify", () => {
    const allowed = RETAIL_ECOMMERCE_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.pricing.commit.*");
    expect(allowed).not.toContain("agent.marketing.send.*");
    expect(allowed).not.toContain("agent.customer.modify.*");
  });

  it("default daily limit is conservative ($200) for consumer-touch volume", () => {
    expect(RETAIL_ECOMMERCE_PACK.defaultDailyLimitCents).toBe(20_000);
  });
});

describe("RETAIL_ECOMMERCE_PACK — audit queries cover FTC + state AG + EU DPA", () => {
  it("customer-service-resolutions query covers FTC + class-action defense", () => {
    const q = RETAIL_ECOMMERCE_PACK.auditQueries.find((q) =>
      q.id.includes("customer-service-resolutions"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("FTC");
  });

  it("pricing-decisions query has 3-year retention (Robinson-Patman class-action window)", () => {
    const q = RETAIL_ECOMMERCE_PACK.auditQueries.find((q) =>
      q.id.includes("pricing-decisions"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1095);
  });

  it("CCPA-DSR pipeline query covers CA AG enforcement", () => {
    const q = RETAIL_ECOMMERCE_PACK.auditQueries.find((q) =>
      q.id.includes("ccpa-dsr"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("CA AG");
  });

  it("GDPR Art 22 query covers EU DPA disputes", () => {
    const q = RETAIL_ECOMMERCE_PACK.auditQueries.find((q) =>
      q.id.includes("gdpr-art22"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("EU DPA");
  });

  it("ADA accessibility query covers Robles-class private litigation", () => {
    const q = RETAIL_ECOMMERCE_PACK.auditQueries.find((q) =>
      q.id.includes("ada-accessibility"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("ADA Title III");
  });

  it("PCI PAN incidents query covers PCI Council + Card Brand audit", () => {
    const q = RETAIL_ECOMMERCE_PACK.auditQueries.find((q) =>
      q.id.includes("pci-dss"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("PCI DSS 4.0");
  });
});

describe("RETAIL_ECOMMERCE_PACK — pricing matches mid-market e-commerce ICP", () => {
  it("ACV range is $30K-$150K (mid-market through DTC enterprise)", () => {
    expect(RETAIL_ECOMMERCE_PACK.pricingTier.minAcvUsd).toBe(30_000);
    expect(RETAIL_ECOMMERCE_PACK.pricingTier.maxAcvUsd).toBe(150_000);
  });

  it("target customer size names Shopify Plus + Klaviyo + Braze ecosystem", () => {
    const target =
      RETAIL_ECOMMERCE_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toMatch(/shopify plus|bigcommerce|salesforce commerce/);
    expect(target).toMatch(/klaviyo|braze|iterable/);
  });
});
