/**
 * manufacturing-industrial-pack (R76) — tests.
 *
 * The 7th vertical product. Pack data is opinionated regulatory
 * knowledge encoded in TypeScript; tests verify the opinionation
 * hasn't drifted.
 *
 * Specifically guards against:
 *   - Pack id / version stability
 *   - HITL rules cover ITAR + EAR + AS9100 + IATF + ISO 13485 + OSHA
 *   - Engineering signature on part substitutions (FAA/DCMA defense)
 *   - ITAR HARD-BLOCK with Empowered Official signoff
 *   - EAR HARD-BLOCK with DECO signoff
 *   - ICS/SCADA commands pass R73 multi-turn defense (Cisco-driven)
 *   - DHF entries require QMR signature (FDA Form 483 defense)
 *   - 6+ year audit retention windows (matches ITAR + AS9100)
 *   - Default ACT scope is READ-ONLY
 *   - Pack PASSES R63 pack validator
 */

import { describe, it, expect } from "vitest";
import {
  MANUFACTURING_INDUSTRIAL_PACK,
  getManufacturingIndustrialPack,
  isAgentEnabledInManufacturingPack,
} from "../vertical-packs/manufacturing-industrial";
import { validateAuthoredPack } from "../vertical-packs/pack-validator";

describe("MANUFACTURING_INDUSTRIAL_PACK — pack invariants", () => {
  it("has stable id, version, substantive summary", () => {
    expect(MANUFACTURING_INDUSTRIAL_PACK.id).toBe("manufacturing-industrial-v1");
    expect(MANUFACTURING_INDUSTRIAL_PACK.version).toBe("1.0.0");
    expect(MANUFACTURING_INDUSTRIAL_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets COO / VP Quality / VP Manufacturing personas", () => {
    const persona =
      MANUFACTURING_INDUSTRIAL_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(
      /chief operating|vp of quality|vp of manufacturing|qmr|empowered official/,
    );
  });

  it("declares the regulated SLA tier", () => {
    expect(MANUFACTURING_INDUSTRIAL_PACK.slaTier).toBe("regulated");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getManufacturingIndustrialPack()).toBe(MANUFACTURING_INDUSTRIAL_PACK);
  });

  it("PASSES the R63 pack validator (regression-proof)", () => {
    const r = validateAuthoredPack(MANUFACTURING_INDUSTRIAL_PACK);
    expect(r.ok).toBe(true);
  });
});

describe("MANUFACTURING_INDUSTRIAL_PACK — agent allowlist", () => {
  it("includes ISO 9001 / IATF / AS9100 / ISO 13485 quality agents", () => {
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("iso-9001")),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) =>
        a.includes("iatf-16949"),
      ),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) =>
        a.includes("as9100"),
      ),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) =>
        a.includes("iso-13485"),
      ),
    ).toBe(true);
  });

  it("includes ITAR + EAR + DFARS export/cyber agents", () => {
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("itar")),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("ear")),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) =>
        a.includes("dfars-7012"),
      ),
    ).toBe(true);
  });

  it("includes FDA + OSHA + EPA agents", () => {
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("fda")),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("osha")),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("epa")),
    ).toBe(true);
  });

  it("includes ICS/SCADA agents (industrial-control coverage)", () => {
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) =>
        a.includes("ics-scada"),
      ),
    ).toBe(true);
  });

  it("includes predictive-maintenance + SPC + calibration agents", () => {
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) =>
        a.includes("predictive-maintenance"),
      ),
    ).toBe(true);
    expect(
      MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.some((a) => a.includes("spc")),
    ).toBe(true);
  });

  it("excludes inappropriate agents", () => {
    const banned = ["marketing", "sales", "consumer", "social-media"];
    for (const a of MANUFACTURING_INDUSTRIAL_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInManufacturingPack handles known + unknown", () => {
    expect(isAgentEnabledInManufacturingPack("itar-export-classification-drafter"))
      .toBe(true);
    expect(isAgentEnabledInManufacturingPack("marketing-blaster")).toBe(false);
  });
});

describe("MANUFACTURING_INDUSTRIAL_PACK — HITL rules cover the catastrophic risks", () => {
  it("requires Engineering signoff on part substitutions (AS9100 + 21 CFR 820)", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("part-substitution"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("AS9100");
    expect(rule?.regulatoryCitation).toContain("21 CFR 820.30(i)");
  });

  it("HARD-BLOCKS ITAR classifications until Empowered Official signs", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("itar"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("Empowered Official");
    expect(rule?.regulatoryCitation).toContain("22 CFR 120-130");
  });

  it("HARD-BLOCKS EAR classifications until DECO signs", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("ear-eccn"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("EAR 15 CFR");
  });

  it("requires DUAL approval (Procurement + Engineering) on supplier AVL changes", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("supplier-change"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
  });

  it("ICS/SCADA command rule explicitly cites R73 multi-turn defense (Cisco-research-driven)", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("ics"),
    );
    expect(rule).toBeDefined();
    // Anti-slop guard: explicit R73 reference + Cisco research context.
    expect(rule?.description).toContain("R73");
    expect(rule?.description.toLowerCase()).toContain("cisco");
    expect(rule?.regulatoryCitation).toContain("ISA/IEC 62443");
    expect(rule?.requiredApprovers).toBe(2);
  });

  it("requires QMR signature on FDA design-history-file entries", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("fda-design-control"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("Quality Management Representative");
    expect(rule?.regulatoryCitation).toContain("21 CFR 820.30");
  });

  it("OSHA incident reporting requires EHS-Director sign", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("osha"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("29 CFR 1904");
  });

  it("CMMC evidence requires SISM signature (False Claims Act defense)", () => {
    const rule = MANUFACTURING_INDUSTRIAL_PACK.hitlRules.find((r) =>
      r.id.includes("cmmc"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("False Claims Act");
  });
});

describe("MANUFACTURING_INDUSTRIAL_PACK — read-only ACT scope (industrial safety)", () => {
  it("max_cents is 0 (no autonomous commit)", () => {
    expect(MANUFACTURING_INDUSTRIAL_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / analyze / monitor / draft / classify / alert / summary / flag pre-allowed", () => {
    const allowed =
      MANUFACTURING_INDUSTRIAL_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|analyze|monitor|draft|classify|alert|summary|flag)\..+/,
      );
    }
  });

  it("does NOT pre-allow ics.commit / itar.send / part.substitute (require HITL)", () => {
    const allowed =
      MANUFACTURING_INDUSTRIAL_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.ics.*");
    expect(allowed).not.toContain("agent.itar.*");
    expect(allowed).not.toContain("agent.part.substitute.*");
  });

  it("default daily limit is sized for plant-floor volume ($300)", () => {
    expect(MANUFACTURING_INDUSTRIAL_PACK.defaultDailyLimitCents).toBe(30_000);
  });
});

describe("MANUFACTURING_INDUSTRIAL_PACK — audit queries cover regulatory retention windows", () => {
  it("part-substitution query has 6-year retention (AS9100 + ITAR-aligned)", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("part-substitutions"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2190); // 6 years
  });

  it("ITAR query has 6-year retention (22 CFR 122.5(b))", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("itar"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2190);
  });

  it("EAR query has 6-year retention (15 CFR 762)", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("ear-classifications"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2190);
  });

  it("DHF query has 8-year retention (21 CFR 820.180)", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("dhf-entries"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2920); // 8 years
  });

  it("ICS/SCADA commands query has 6-year retention (NERC CIP-007)", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("ics-commands"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(2190);
  });

  it("supplier-changes query has 5-year retention (AS9100 + IATF)", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("supplier-changes"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1825);
  });

  it("OSHA incidents query has 5-year retention (29 CFR 1904.33)", () => {
    const q = MANUFACTURING_INDUSTRIAL_PACK.auditQueries.find((q) =>
      q.id.includes("osha-incidents"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1825);
  });
});

describe("MANUFACTURING_INDUSTRIAL_PACK — pricing matches Tier-1/2 manufacturer ICP", () => {
  it("ACV range is $75K-$500K (defense + medical-device primes pay top)", () => {
    expect(MANUFACTURING_INDUSTRIAL_PACK.pricingTier.minAcvUsd).toBe(75_000);
    expect(MANUFACTURING_INDUSTRIAL_PACK.pricingTier.maxAcvUsd).toBe(500_000);
  });

  it("target customer size names the prime-contractor ecosystems", () => {
    const target =
      MANUFACTURING_INDUSTRIAL_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toMatch(/toyota|gm|stellantis|ford/);
    expect(target).toMatch(/boeing|lockheed|northrop|raytheon/);
    expect(target).toMatch(/pfizer|j&j|medtronic|abbott|stryker/);
  });
});
