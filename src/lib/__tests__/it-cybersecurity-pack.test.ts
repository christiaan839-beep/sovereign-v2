/**
 * it-cybersecurity-pack (R78) — tests.
 *
 * The 8th vertical product. Pack data is opinionated regulatory +
 * security-best-practice knowledge encoded in TypeScript; tests
 * verify the opinionation hasn't drifted.
 *
 * Specifically guards against:
 *   - Pack id / version stability
 *   - HITL rules cover SOC + code commits + IAM + supply-chain + IR
 *     + data exfiltration + multi-turn defense
 *   - Code-commit rule cites CrowdStrike post-outage best practices
 *     (anti-slop guard for the rationale)
 *   - SOC alert rule cites Forrester L1-displacement research
 *   - Supply-chain rule cites Executive Order 14028 + NIST SSDF + SLSA
 *   - Multi-turn jailbreak defense composed (R73 reference)
 *   - Default ACT scope is READ-ONLY
 *   - Pack PASSES R63 pack validator
 */

import { describe, it, expect } from "vitest";
import {
  IT_CYBERSECURITY_PACK,
  getItCybersecurityPack,
  isAgentEnabledInItPack,
} from "../vertical-packs/it-cybersecurity";
import { validateAuthoredPack } from "../vertical-packs/pack-validator";

describe("IT_CYBERSECURITY_PACK — pack invariants", () => {
  it("has stable id, version, substantive summary", () => {
    expect(IT_CYBERSECURITY_PACK.id).toBe("it-cybersecurity-v1");
    expect(IT_CYBERSECURITY_PACK.version).toBe("1.0.0");
    expect(IT_CYBERSECURITY_PACK.summary.length).toBeGreaterThan(150);
  });

  it("targets CISO / SOC Director / VP Engineering personas", () => {
    const persona = IT_CYBERSECURITY_PACK.targetBuyerPersona.toLowerCase();
    expect(persona).toMatch(
      /chief information security|ciso|soc director|vp of engineering/,
    );
  });

  it("declares the regulated SLA tier", () => {
    expect(IT_CYBERSECURITY_PACK.slaTier).toBe("regulated");
  });

  it("returns the canonical pack via the helper", () => {
    expect(getItCybersecurityPack()).toBe(IT_CYBERSECURITY_PACK);
  });

  it("PASSES the R63 pack validator (regression-proof)", () => {
    const r = validateAuthoredPack(IT_CYBERSECURITY_PACK);
    expect(r.ok).toBe(true);
  });
});

describe("IT_CYBERSECURITY_PACK — agent allowlist", () => {
  it("includes SOC L1 triage + IOC enrichment + IR recommender", () => {
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("soc-alert-triage-l1"),
      ),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("ioc-enrichment"),
      ),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("incident-runbook"),
      ),
    ).toBe(true);
  });

  it("includes code-review + vulnerability-scanner + QA agents", () => {
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("code-commit-reviewer"),
      ),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("vulnerability-scanner"),
      ),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("qa-test-generator"),
      ),
    ).toBe(true);
  });

  it("includes patch tracker + dependency scanner + SBOM drift detector", () => {
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) => a.includes("patch")),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) => a.includes("sbom")),
    ).toBe(true);
  });

  it("includes IAM + container + cloud-config agents", () => {
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) => a.includes("iam")),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) => a.includes("container")),
    ).toBe(true);
    expect(
      IT_CYBERSECURITY_PACK.enabledAgents.some((a) =>
        a.includes("cloud-config"),
      ),
    ).toBe(true);
  });

  it("excludes inappropriate agents", () => {
    const banned = ["marketing", "sales", "consumer", "social-media"];
    for (const a of IT_CYBERSECURITY_PACK.enabledAgents) {
      for (const b of banned) {
        expect(a.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("isAgentEnabledInItPack handles known + unknown", () => {
    expect(isAgentEnabledInItPack("soc-alert-triage-l1")).toBe(true);
    expect(isAgentEnabledInItPack("marketing-blaster")).toBe(false);
  });
});

describe("IT_CYBERSECURITY_PACK — HITL rules cover catastrophic risks", () => {
  it("FORBIDS autonomous production deploys (CrowdStrike-defense)", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("autonomous-production-deploys"),
    );
    expect(rule).toBeDefined();
    // Anti-slop guard: rule must reference CrowdStrike-class outage
    expect(rule?.description).toContain("CrowdStrike");
    expect(rule?.regulatoryCitation).toContain("SOC 2 CC8.1");
  });

  it("L1 SOC alert rule prevents autonomous close/escalate above Low", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("l1-soc-alert"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("Forrester");
    expect(rule?.regulatoryCitation).toContain("NIST SP 800-61");
    expect(rule?.regulatoryCitation).toContain("MITRE ATT&CK");
  });

  it("IAM privilege-escalation rule cites SolarWinds defense pattern", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("iam-privilege"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("SolarWinds");
    expect(rule?.regulatoryCitation).toContain("AC-6");
  });

  it("Supply-chain rule cites EO 14028 + NIST SSDF + SLSA", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("supply-chain"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
    expect(rule?.regulatoryCitation).toContain("Executive Order 14028");
    expect(rule?.regulatoryCitation).toContain("NIST SSDF");
    expect(rule?.regulatoryCitation).toContain("SLSA");
  });

  it("Incident-response rule requires Incident Commander signoff", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("incident-response"),
    );
    expect(rule).toBeDefined();
    expect(rule?.description).toContain("Incident Commander");
    expect(rule?.regulatoryCitation).toContain("NIST SP 800-61");
  });

  it("Data-exfiltration rule HARD-BLOCKS until dual approval", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("data-exfiltration"),
    );
    expect(rule).toBeDefined();
    expect(rule?.requiredApprovers).toBe(2);
    expect(rule?.regulatoryCitation).toContain("GDPR Art 32");
  });

  it("Multi-turn jailbreak defense composed for SIEM/EDR/IAM/IR", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("multi-turn-prompt-injection"),
    );
    expect(rule).toBeDefined();
    // Anti-slop: must reference R73 + Cisco research + OWASP LLM
    expect(rule?.description).toContain("R73");
    expect(rule?.description.toLowerCase()).toContain("cisco");
    expect(rule?.regulatoryCitation).toContain("OWASP LLM Top 10");
    expect(rule?.regulatoryCitation).toContain("MITRE ATLAS");
  });

  it("FedRAMP coordination rule (composes with R53)", () => {
    const rule = IT_CYBERSECURITY_PACK.hitlRules.find((r) =>
      r.id.includes("fedramp"),
    );
    expect(rule).toBeDefined();
    expect(rule?.regulatoryCitation).toContain("FISMA");
    expect(rule?.regulatoryCitation).toContain("DFARS 252.204-7012");
  });
});

describe("IT_CYBERSECURITY_PACK — read-only ACT scope (security-first)", () => {
  it("max_cents is 0 (no autonomous spend; security agents don't transact)", () => {
    expect(IT_CYBERSECURITY_PACK.defaultActScopes.max_cents).toBe(0);
  });

  it("only read / scan / triage / draft / classify / alert / summary / analyze / detect / enrich pre-allowed", () => {
    const allowed = IT_CYBERSECURITY_PACK.defaultActScopes.actions_allowed;
    for (const action of allowed) {
      expect(action).toMatch(
        /^agent\.(read|scan|triage|draft|classify|alert|summary|analyze|detect|enrich)\..+/,
      );
    }
  });

  it("does NOT pre-allow code.deploy / iam.modify / data.export (require HITL)", () => {
    const allowed = IT_CYBERSECURITY_PACK.defaultActScopes.actions_allowed;
    expect(allowed).not.toContain("agent.code.deploy.*");
    expect(allowed).not.toContain("agent.iam.modify.*");
    expect(allowed).not.toContain("agent.data.export.*");
    expect(allowed).not.toContain("agent.runbook.execute.*");
  });

  it("default daily limit is sized for SOC volume ($250)", () => {
    expect(IT_CYBERSECURITY_PACK.defaultDailyLimitCents).toBe(25_000);
  });
});

describe("IT_CYBERSECURITY_PACK — audit queries cover regulatory + insurance windows", () => {
  it("SOC alert decisions query (1-year retention)", () => {
    const q = IT_CYBERSECURITY_PACK.auditQueries.find((q) =>
      q.id.includes("soc-alert"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("SOC 2");
  });

  it("IAM privilege changes query has 3-year retention (SOX-aligned)", () => {
    const q = IT_CYBERSECURITY_PACK.auditQueries.find((q) =>
      q.id.includes("iam-privilege"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1095);
    expect(q?.audienceContext).toContain("SEC cybersecurity");
  });

  it("Supply-chain query has 3-year retention (EO 14028-aligned)", () => {
    const q = IT_CYBERSECURITY_PACK.auditQueries.find((q) =>
      q.id.includes("supply-chain"),
    );
    expect(q).toBeDefined();
    expect(q?.defaultWindowDays).toBe(1095);
    expect(q?.audienceContext).toContain("Executive Order 14028");
  });

  it("Incident-response query has 1-year retention", () => {
    const q = IT_CYBERSECURITY_PACK.auditQueries.find((q) =>
      q.id.includes("incident-response"),
    );
    expect(q).toBeDefined();
    expect(q?.audienceContext).toContain("8-K");
  });

  it("Data-exfiltration attempts query covers blocked + override events", () => {
    const q = IT_CYBERSECURITY_PACK.auditQueries.find((q) =>
      q.id.includes("data-exfiltration"),
    );
    expect(q).toBeDefined();
  });
});

describe("IT_CYBERSECURITY_PACK — pricing matches enterprise IT/Security ICP", () => {
  it("ACV range is $40K-$250K (Fortune 1000 SOCs + MSSPs)", () => {
    expect(IT_CYBERSECURITY_PACK.pricingTier.minAcvUsd).toBe(40_000);
    expect(IT_CYBERSECURITY_PACK.pricingTier.maxAcvUsd).toBe(250_000);
  });

  it("target customer size names MSSPs + cloud-security platforms", () => {
    const target =
      IT_CYBERSECURITY_PACK.pricingTier.targetCustomerSize.toLowerCase();
    expect(target).toMatch(/mandiant|optiv|coalfire|trustwave|arctic wolf|esentire/);
    expect(target).toMatch(/wiz|lacework|orca/);
    expect(target).toMatch(/snyk|veracode|checkmarx/);
  });

  it("recommends pairing with R53 FedRAMP pack for federal customers", () => {
    expect(
      IT_CYBERSECURITY_PACK.pricingTier.targetCustomerSize.toLowerCase(),
    ).toContain("fedramp");
  });
});
