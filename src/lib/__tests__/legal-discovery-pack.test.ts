/**
 * legal-discovery-pack (R52) — tests.
 *
 * Same invariant pattern as banking + healthcare packs. Pack data is
 * opinionated regulatory knowledge encoded in TypeScript; tests
 * verify the opinionation hasn't drifted.
 *
 * Specifically guards against:
 *   - Pack id / version stability (audit-trail reproducibility)
 *   - HITL rules cover the catastrophic legal-tech risks (Zubulake,
 *     FRCP 37(e), FRCP 11, ABA 1.7)
 *   - Default ACT scope is READ-ONLY (no autonomous privilege calls)
 *   - Pre-built queries produce the artifacts opposing counsel
 *     actually demands
 *   - Pricing tier matches the wedge ICP (AmLaw 200 / Fortune 1000)
 */

import { describe, it, expect } from "vitest";
import {
  LEGAL_DISCOVERY_PACK,
  getLegalDiscoveryPack,
  isAgentEnabledInLegalPack,
} from "../vertical-packs/legal-discovery";

describe("LEGAL_DISCOVERY_PACK — pack invariants", () => {
  it("has stable id, version, and substantive summary", () => {
    expect(LEGAL_DISCOVERY_PACK.id).toBe("legal-discovery-v1");
    expect(LEGAL_DISCOVERY_PACK.version).toBe("1.0.0");
    expect(LEGAL_DISCOVERY_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets legal buyer personas explicitly", () => {
    const persona = LEGAL_DISCOVERY_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(/general counsel|chief legal officer|litigation/);
    expect(persona).toContain("amlaw");
  });

  it("declares the regulated SLA tier (matches FRE evidence-admissibility expectations)", () => {
    expect(LEGAL_DISCOVERY_PACK.slaTier).toBe("regulated");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getLegalDiscoveryPack()).toBe(LEGAL_DISCOVERY_PACK);
  });
});

describe("LEGAL_DISCOVERY_PACK — agent allowlist", () => {
  it("includes core e-discovery agents (privilege classifier, redaction suggester, Bates validator)", () => {
    expect(
      LEGAL_DISCOVERY_PACK.enabledAgents.some((a) => a.includes("privileged")),
    ).toBe(true);
    expect(
      LEGAL_DISCOVERY_PACK.enabledAgents.some((a) => a.includes("redaction")),
    ).toBe(true);
    expect(
      LEGAL_DISCOVERY_PACK.enabledAgents.some((a) => a.includes("bates")),
    ).toBe(true);
  });

  it("includes contract-ops agents (clause analyzer, deviation detector)", () => {
    expect(
      LEGAL_DISCOVERY_PACK.enabledAgents.some((a) =>
        a.includes("contract-clause"),
      ),
    ).toBe(true);
  });

  it("excludes consumer-facing / marketing agents", () => {
    const banned = ["marketing", "sales", "consumer", "social-media", "ads"];
    for (const a of LEGAL_DISCOVERY_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInLegalPack handles known + unknown agents", () => {
    expect(isAgentEnabledInLegalPack("privilege-log-generator")).toBe(true);
    expect(isAgentEnabledInLegalPack("marketing-blaster")).toBe(false);
  });
});

describe("LEGAL_DISCOVERY_PACK — HITL rules cover the catastrophic risks", () => {
  it("requires attorney sign-off on privilege calls (Zubulake-defense)", () => {
    const rule = LEGAL_DISCOVERY_PACK.hitlRules.find((r) =>
      r.id.includes("privilege-call"),
    );
    expect(rule).toBeDefined();
    // Anti-slop guard: rule must explicitly reference the Zubulake case.
    expect(rule?.description).toContain("Zubulake");
    expect(rule?.regulatoryCitation).toContain("FRE");
  });

  it("requires attorney signature on production-set finalization (FRCP 26(g))", () => {
    const rule = LEGAL_DISCOVERY_PACK.hitlRules.find((r) =>
      r.id.includes("production-set"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FRCP 26(g)");
  });

  it("requires DUAL approval on heavy redactions (over-redaction sanctions defense)", () => {
    const rule = LEGAL_DISCOVERY_PACK.hitlRules.find((r) =>
      r.id.includes("redaction"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
  });

  it("hard-blocks on conflict-of-interest detection (ABA Model Rule 1.7)", () => {
    const rule = LEGAL_DISCOVERY_PACK.hitlRules.find((r) =>
      r.id.includes("conflict"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("ABA Model Rule 1.7");
  });

  it("blocks autonomous litigation-hold release (FRCP 37(e) spoliation defense)", () => {
    const rule = LEGAL_DISCOVERY_PACK.hitlRules.find((r) =>
      r.id.includes("spoliation"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FRCP 37(e)");
  });

  it("requires attorney-of-record signature on court filings (FRCP 11)", () => {
    const rule = LEGAL_DISCOVERY_PACK.hitlRules.find((r) =>
      r.id.includes("court-filing"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FRCP 11");
  });
});

describe("LEGAL_DISCOVERY_PACK — default ACT scope is read-only (privilege defense)", () => {
  it("max_cents is 0 (no autonomous spend; legal agents NEVER transact)", () => {
    expect(LEGAL_DISCOVERY_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / draft / classify / analyze / summary / search / alert actions pre-allowed", () => {
    const allowed = LEGAL_DISCOVERY_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|draft|classify|analyze|summary|search|alert)\..+/,
      );
    }
  });

  it("does NOT pre-allow privilege.commit / production.commit / filing.commit (require HITL)", () => {
    const allowed = LEGAL_DISCOVERY_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.privilege.*");
    expect(allowed).not.toContain("agent.production.*");
    expect(allowed).not.toContain("agent.court.*");
  });

  it("default daily limit is conservative ($150)", () => {
    expect(LEGAL_DISCOVERY_PACK.defaultDailyLimitCents).toBe(15_000);
  });
});

describe("LEGAL_DISCOVERY_PACK — audit queries produce litigation-defense artifacts", () => {
  it("has a privilege-log query (the most-litigated artifact)", () => {
    const q = LEGAL_DISCOVERY_PACK.auditQueries.find((q) =>
      q.id.includes("privilege-log"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toMatch(/privilege|FRCP 26\(b\)\(5\)/);
  });

  it("has a production-history query (FRE 901/902 admissibility record)", () => {
    const q = LEGAL_DISCOVERY_PACK.auditQueries.find((q) =>
      q.id.includes("production-history"),
    );
    expect(q).toBeDefined();
  });

  it("has a litigation-hold events query (spoliation defense)", () => {
    const q = LEGAL_DISCOVERY_PACK.auditQueries.find((q) =>
      q.id.includes("litigation-hold"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toMatch(/spoliation|FRCP 37\(e\)/i);
  });

  it("has a court-filings query (FRCP 11 sanctions defense)", () => {
    const q = LEGAL_DISCOVERY_PACK.auditQueries.find((q) =>
      q.id.includes("court-filings"),
    );
    expect(q).toBeDefined();
  });
});

describe("LEGAL_DISCOVERY_PACK — pricing matches legal-tech ICP", () => {
  it("ACV range is $30K-$200K (AmLaw 200 / Fortune 1000 in-house)", () => {
    expect(LEGAL_DISCOVERY_PACK.pricingTier.minAcvUsd).toBe(30_000);
    expect(LEGAL_DISCOVERY_PACK.pricingTier.maxAcvUsd).toBe(200_000);
  });

  it("target customer size names AmLaw firms + Fortune 1000 in-house + e-discovery vendors", () => {
    const target =
      LEGAL_DISCOVERY_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toContain("amlaw");
    expect(target).toContain("fortune 1000");
    expect(target).toContain("e-discovery");
  });
});
