/**
 * fedramp-government-pack (R53) — tests.
 *
 * Same invariant pattern as the other vertical packs. Federal /
 * defense compliance is the highest-bar use case; tests verify the
 * specific defenses against False Claims Act + ATO violation +
 * cross-domain CUI leakage.
 */

import { describe, it, expect } from "vitest";
import {
  FEDRAMP_GOVERNMENT_PACK,
  getFedrampGovernmentPack,
  isAgentEnabledInFedrampPack,
} from "../vertical-packs/fedramp-government";

describe("FEDRAMP_GOVERNMENT_PACK — pack invariants", () => {
  it("has stable id, version, and substantive summary", () => {
    expect(FEDRAMP_GOVERNMENT_PACK.id).toBe("fedramp-government-v1");
    expect(FEDRAMP_GOVERNMENT_PACK.version).toBe("1.0.0");
    expect(FEDRAMP_GOVERNMENT_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets federal CISO / AO / ISSO buyer personas", () => {
    const persona = FEDRAMP_GOVERNMENT_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(/ciso|authorizing official|isso|cybersecurity/);
  });

  it("declares the regulated SLA tier", () => {
    expect(FEDRAMP_GOVERNMENT_PACK.slaTier).toBe("regulated");
  });

  it("declares FedRAMP Moderate + High + CMMC L2 + L3 frameworks", () => {
    expect(FEDRAMP_GOVERNMENT_PACK.complianceFrameworks).toContain(
      "fedramp-moderate",
    );
    expect(FEDRAMP_GOVERNMENT_PACK.complianceFrameworks).toContain(
      "fedramp-high",
    );
    expect(FEDRAMP_GOVERNMENT_PACK.complianceFrameworks).toContain(
      "cmmc-level-2",
    );
    expect(FEDRAMP_GOVERNMENT_PACK.complianceFrameworks).toContain(
      "cmmc-level-3",
    );
  });

  it("returns the canonical pack via the helper", () => {
    expect(getFedrampGovernmentPack()).toBe(FEDRAMP_GOVERNMENT_PACK);
  });
});

describe("FEDRAMP_GOVERNMENT_PACK — agent allowlist", () => {
  it("includes core gov agents (CUI classifier, ATO/SSP drafter, POA&M tracker)", () => {
    expect(
      FEDRAMP_GOVERNMENT_PACK.enabledAgents.some((a) => a.includes("cui")),
    ).toBe(true);
    expect(
      FEDRAMP_GOVERNMENT_PACK.enabledAgents.some((a) => a.includes("ssp")),
    ).toBe(true);
    expect(
      FEDRAMP_GOVERNMENT_PACK.enabledAgents.some((a) => a.includes("poam")),
    ).toBe(true);
  });

  it("includes FOIA + supply-chain + incident-response agents", () => {
    expect(
      FEDRAMP_GOVERNMENT_PACK.enabledAgents.some((a) => a.includes("foia")),
    ).toBe(true);
    expect(
      FEDRAMP_GOVERNMENT_PACK.enabledAgents.some((a) =>
        a.includes("supply-chain"),
      ),
    ).toBe(true);
    expect(
      FEDRAMP_GOVERNMENT_PACK.enabledAgents.some((a) => a.includes("incident")),
    ).toBe(true);
  });

  it("excludes inappropriate agents (no marketing, no consumer)", () => {
    const banned = ["marketing", "sales", "consumer", "social-media"];
    for (const a of FEDRAMP_GOVERNMENT_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInFedrampPack handles known + unknown agents", () => {
    expect(isAgentEnabledInFedrampPack("cui-classifier")).toBe(true);
    expect(isAgentEnabledInFedrampPack("marketing-blaster")).toBe(false);
  });
});

describe("FEDRAMP_GOVERNMENT_PACK — HITL rules cover federal-grade risks", () => {
  it("HARD-BLOCKS classified data (Confidential / Secret / Top Secret)", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find((r) =>
      r.id.includes("classified-data"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("13526"); // EO 13526
    expect(rule?.requiredApprovers).toBe(0); // hard block, no override
  });

  it("blocks CUI cross-domain export until AO approval", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find((r) =>
      r.id.includes("cui-export"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("CUI");
    expect(rule?.regulatoryCitation).toContain("AC-4");
  });

  it("requires ISSO signature on ATO package sections", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find((r) =>
      r.id.includes("ato-package"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("NIST SP 800-37");
  });

  it("requires DUAL approval on supply-chain risk decisions (FAR 4.21 + Section 889)", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find((r) =>
      r.id.includes("supply-chain"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
    expect(rule?.regulatoryCitation).toContain("Section 889");
  });

  it("requires SISM attestation on CMMC evidence (False Claims Act defense)", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find((r) =>
      r.id.includes("cmmc-evidence"),
    );
    expect(rule).toBeDefined();
    // Anti-slop guard: must explicitly cite FCA exposure.
    expect(rule?.description).toContain("False Claims Act");
    expect(rule?.regulatoryCitation).toContain("31 USC 3729");
  });

  it("escalates security incidents within 1 hour (FISMA + DFARS 7012)", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find(
      (r) => r.id.includes("incident") && r.id.includes("reporting"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FISMA");
    expect(rule?.regulatoryCitation).toContain("DFARS");
  });

  it("requires Counsel signoff on FOIA responses", () => {
    const rule = FEDRAMP_GOVERNMENT_PACK.hitlRules.find((r) =>
      r.id.includes("foia"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FOIA");
  });
});

describe("FEDRAMP_GOVERNMENT_PACK — default ACT scope is read-only (FCA defense)", () => {
  it("max_cents is 0 (no autonomous spend; gov agents don't transact)", () => {
    expect(FEDRAMP_GOVERNMENT_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("does NOT pre-allow ato.commit / cmmc.attest / foia.send (require HITL)", () => {
    const allowed = FEDRAMP_GOVERNMENT_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.ato.commit.*");
    expect(allowed).not.toContain("agent.cmmc.attest.*");
    expect(allowed).not.toContain("agent.foia.send.*");
  });

  it("default daily limit is sized for ConMon + ATO workloads ($300)", () => {
    expect(FEDRAMP_GOVERNMENT_PACK.defaultDailyLimitCents).toBe(30_000);
  });
});

describe("FEDRAMP_GOVERNMENT_PACK — audit queries cover federal investigations", () => {
  it("has CUI-touches query (FedRAMP ConMon + DFARS 7012)", () => {
    const q = FEDRAMP_GOVERNMENT_PACK.auditQueries.find((q) =>
      q.id.includes("cui"),
    );
    expect(q).toBeDefined();
  });

  it("has ATO package history query", () => {
    const q = FEDRAMP_GOVERNMENT_PACK.auditQueries.find((q) =>
      q.id.includes("ato-package"),
    );
    expect(q).toBeDefined();
  });

  it("has security incident pipeline query (US-CERT + DCCC)", () => {
    const q = FEDRAMP_GOVERNMENT_PACK.auditQueries.find((q) =>
      q.id.includes("incidents"),
    );
    expect(q).toBeDefined();
  });

  it("has FOIA pipeline query", () => {
    const q = FEDRAMP_GOVERNMENT_PACK.auditQueries.find((q) =>
      q.id.includes("foia"),
    );
    expect(q).toBeDefined();
  });

  it("has CMMC evidence provenance query (FCA defense)", () => {
    const q = FEDRAMP_GOVERNMENT_PACK.auditQueries.find((q) =>
      q.id.includes("cmmc-evidence"),
    );
    expect(q).toBeDefined();
  });

  it("has supply-chain risk decisions query (Section 889 + FOCI)", () => {
    const q = FEDRAMP_GOVERNMENT_PACK.auditQueries.find((q) =>
      q.id.includes("supply-chain"),
    );
    expect(q).toBeDefined();
  });
});

describe("FEDRAMP_GOVERNMENT_PACK — pricing matches government ICP", () => {
  it("ACV range is $100K-$10M (federal + DoD scale)", () => {
    expect(FEDRAMP_GOVERNMENT_PACK.pricingTier.minAcvUsd).toBe(100_000);
    expect(FEDRAMP_GOVERNMENT_PACK.pricingTier.maxAcvUsd).toBe(10_000_000);
  });

  it("target customer size names federal + DoD + FSI + defense contractors", () => {
    const target =
      FEDRAMP_GOVERNMENT_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("federal");
    expect(target).toContain("dod");
    expect(target).toContain("cmmc");
    expect(target).toMatch(/booz allen|leidos|saic|northrop/);
  });
});
