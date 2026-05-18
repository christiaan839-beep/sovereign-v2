/**
 * Guardian rule packs — Wave 63 (six packs that complete the next-
 * horizon roadmap from MARKET-GAPS-2026.md Wave 63 candidates list):
 *   - Canada AIDA (Bill C-27 Part 3, eff. late 2026)
 *   - UK ICO AI Auditing Framework + Art. 22 UK GDPR
 *   - ISO/IEC 42001 AI Management System runtime hooks
 *   - Texas Capture/Use of Biometric Identifier Act + HB 4 + TX-RAMP
 *   - Brazil LGPD AI Regulation (PL 2338/2023, Apr 2025 draft)
 *   - India DPDP Act + MeitY AI Advisory (Mar 2024)
 *
 * Total: 18 new rules, ~40 tests (positive + negative for each).
 * Brings ALL_PACKS to 26. Tests double as documentation of the
 * regulatory clauses cited inline.
 */
import { describe, it, expect } from "vitest";
import {
  canadaAidaRules,
  canadaAidaPack,
  ukIcoRules,
  ukIcoPack,
  iso42001Rules,
  iso42001Pack,
  texasAiRules,
  texasAiPack,
  brazilLgpdAiRules,
  brazilLgpdAiPack,
  indiaDpdpAiRules,
  indiaDpdpAiPack,
  ALL_PACKS,
} from "../src/packs.js";
import type { GuardianRule } from "../src/guardian.js";

function findRule(rules: GuardianRule[], id: string): GuardianRule {
  const r = rules.find((rule) => rule.id === id);
  if (!r) throw new Error(`rule not found: ${id}`);
  return r;
}

async function evalAt(
  rule: GuardianRule,
  output: unknown,
  input: unknown = {},
  extra: Record<string, unknown> = {},
) {
  return rule.evaluate({
    runId: "test-run",
    agentSlug: "test-agent",
    tokenId: "test-tok",
    input,
    output,
    ...extra,
  });
}

describe("Canada AIDA pack — Bill C-27 Part 3", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === canadaAidaPack.id)).toBe(true);
    expect(canadaAidaPack.rules.length).toBe(3);
    expect(canadaAidaPack.citation).toMatch(/AIDA|C-27/);
  });

  it("WARNS on high-impact AI output without bias-mitigation reference", async () => {
    const rule = findRule(canadaAidaRules, "canada-aida-bias-mitigation");
    const v = await evalAt(
      rule,
      "High-impact AI: candidate scored 7/10 by employment filter.",
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/bias[-\s]?mitigation|AIDA/i);
  });

  it("PASSES high-impact output WITH bias-mitigation reference", async () => {
    const rule = findRule(canadaAidaRules, "canada-aida-bias-mitigation");
    const v = await evalAt(
      rule,
      "High-impact AI: candidate scored 7/10. Bias mitigation: disparate-impact analysis run 2026-04-15.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on high-impact decision without human-oversight attestation", async () => {
    const rule = findRule(canadaAidaRules, "canada-aida-human-oversight");
    const v = await evalAt(
      rule,
      "Automated decision: essential service eligibility evaluated.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES high-impact decision WITH human-oversight attestation", async () => {
    const rule = findRule(canadaAidaRules, "canada-aida-human-oversight");
    const v = await evalAt(
      rule,
      "Automated decision: essential service eligibility evaluated. Human reviewer signed off (HITL operator id 4421).",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS material-harm event from high-impact AI without ministerial notification", async () => {
    const rule = findRule(
      canadaAidaRules,
      "canada-aida-material-harm-notification",
    );
    const v = await evalAt(
      rule,
      "High-impact AI: material harm detected — systemic bias detected in cohort B.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/AIDA|notification/i);
  });

  it("PASSES material-harm event WITH ministerial notification", async () => {
    const rule = findRule(
      canadaAidaRules,
      "canada-aida-material-harm-notification",
    );
    const v = await evalAt(
      rule,
      "High-impact AI: material harm detected. AIDA incident report filed; Minister of Innovation notification submitted.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("UK ICO pack — AI Auditing Framework + Art. 22 UK GDPR", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === ukIcoPack.id)).toBe(true);
    expect(ukIcoPack.rules.length).toBe(3);
    expect(ukIcoPack.citation).toMatch(/ICO|UK GDPR/);
  });

  it("WARNS on high-stakes AI output without DPIA reference", async () => {
    const rule = findRule(ukIcoRules, "uk-ico-dpia-reference");
    const v = await evalAt(
      rule,
      "Solely automated decision: housing application processed.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES high-stakes AI output WITH DPIA reference", async () => {
    const rule = findRule(ukIcoRules, "uk-ico-dpia-reference");
    const v = await evalAt(
      rule,
      "Solely automated decision: housing application processed. DPIA DPIA-2026-Q1-housing on file.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on solely-automated decision without explainability artefact", async () => {
    const rule = findRule(ukIcoRules, "uk-ico-explainability-artefact");
    const v = await evalAt(
      rule,
      "High-stakes AI: credit limit reduction applied.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES solely-automated decision WITH SHAP explanation", async () => {
    const rule = findRule(ukIcoRules, "uk-ico-explainability-artefact");
    const v = await evalAt(
      rule,
      "High-stakes AI: credit limit reduction. SHAP explanation artefact attached, decision rationale documented.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on UK automated decision without human-review pathway", async () => {
    const rule = findRule(ukIcoRules, "uk-ico-human-review-pathway");
    const v = await evalAt(
      rule,
      "Public sector AI: benefits eligibility automated decision.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES UK automated decision WITH human-review pathway", async () => {
    const rule = findRule(ukIcoRules, "uk-ico-human-review-pathway");
    const v = await evalAt(
      rule,
      "Public sector AI: benefits eligibility automated decision. Right to contest + human review process available within 28 days.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("ISO/IEC 42001 pack — AIMS runtime hooks", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === iso42001Pack.id)).toBe(true);
    expect(iso42001Pack.rules.length).toBe(3);
    expect(iso42001Pack.citation).toMatch(/42001/);
  });

  it("WARNS on AI inference output without AIMS document reference", async () => {
    const rule = findRule(iso42001Rules, "iso42001-aims-doc-reference");
    const v = await evalAt(
      rule,
      "AI inference: customer churn score 0.62 produced.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES AI inference output WITH AIMS document reference", async () => {
    const rule = findRule(iso42001Rules, "iso42001-aims-doc-reference");
    const v = await evalAt(
      rule,
      "AI inference: customer churn score 0.62. AIMS doc v3.1 (ISO 42001 certified Q1 2026).",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on AI output without risk-treatment record id", async () => {
    const rule = findRule(iso42001Rules, "iso42001-risk-treatment-record");
    const v = await evalAt(
      rule,
      "Model output: prediction generated within AIMS scope.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES AI output WITH risk-treatment record id", async () => {
    const rule = findRule(iso42001Rules, "iso42001-risk-treatment-record");
    const v = await evalAt(
      rule,
      "Model output: prediction generated within AIMS scope. Risk treatment record RTR-2026-04 applied.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on AI output without Annex A applicability tag", async () => {
    const rule = findRule(iso42001Rules, "iso42001-annex-a-applicability");
    const v = await evalAt(
      rule,
      "Automated recommendation: produced inside AIMS scope by model v4.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES AI output WITH Annex A applicability tag", async () => {
    const rule = findRule(iso42001Rules, "iso42001-annex-a-applicability");
    const v = await evalAt(
      rule,
      "Automated recommendation: AIMS scope; Annex A controls A.6.2 + A.8.4 applied per SoA ref SOA-2026-Q2.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Texas AI pack — Biometric Identifier Act + TX-RAMP", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === texasAiPack.id)).toBe(true);
    expect(texasAiPack.rules.length).toBe(3);
    expect(texasAiPack.citation).toMatch(/Texas|503\.001|TX-RAMP/);
  });

  it("BLOCKS biometric AI output without prior written consent", async () => {
    const rule = findRule(texasAiRules, "tx-biometric-consent");
    const v = await evalAt(
      rule,
      "Face recognition match: subject id confirmed against template database.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/consent|503\.001/i);
  });

  it("PASSES biometric AI output WITH prior written consent", async () => {
    const rule = findRule(texasAiRules, "tx-biometric-consent");
    const v = await evalAt(
      rule,
      "Face recognition match: subject confirmed. Prior written consent on file (signed release 2026-03-01).",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on biometric AI output without retention/destruction schedule", async () => {
    const rule = findRule(texasAiRules, "tx-biometric-retention-schedule");
    const v = await evalAt(
      rule,
      "Iris scan template stored after authentication, consent obtained.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES biometric AI output WITH retention schedule", async () => {
    const rule = findRule(texasAiRules, "tx-biometric-retention-schedule");
    const v = await evalAt(
      rule,
      "Iris scan template stored after authentication, consent obtained. Auto-purge after 12 months per retention schedule.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on TX-RAMP-scope output without certification reference", async () => {
    const rule = findRule(texasAiRules, "tx-ramp-certification-ref");
    const v = await evalAt(
      rule,
      "DIR contract delivery: Texas state agency AI deployment.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES TX-RAMP-scope output WITH certification reference", async () => {
    const rule = findRule(texasAiRules, "tx-ramp-certification-ref");
    const v = await evalAt(
      rule,
      "DIR contract delivery: Texas state agency AI deployment. TX-RAMP Level 2 certified, ATO date 2026-01-15, data residency attested.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Brazil LGPD AI pack — PL 2338/2023", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === brazilLgpdAiPack.id)).toBe(true);
    expect(brazilLgpdAiPack.rules.length).toBe(3);
    expect(brazilLgpdAiPack.citation).toMatch(/LGPD|2338/);
  });

  it("WARNS on Brazilian AI decision without RIA reference", async () => {
    const rule = findRule(brazilLgpdAiRules, "br-lgpd-ai-ria-reference");
    const v = await evalAt(
      rule,
      "LGPD: automated decision applied to Brazilian data subject.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Brazilian AI decision WITH RIA reference", async () => {
    const rule = findRule(brazilLgpdAiRules, "br-lgpd-ai-ria-reference");
    const v = await evalAt(
      rule,
      "LGPD: automated decision for Brazilian data subject. RIA v2.1 (Relatório de Impacto Algorítmico) referenced.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on Brazilian automated decision without Portuguese review notice", async () => {
    const rule = findRule(
      brazilLgpdAiRules,
      "br-lgpd-ai-portuguese-review-notice",
    );
    const v = await evalAt(
      rule,
      "LGPD compliance: automated decision processed for Brazilian resident.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Brazilian automated decision WITH Portuguese review notice", async () => {
    const rule = findRule(
      brazilLgpdAiRules,
      "br-lgpd-ai-portuguese-review-notice",
    );
    const v = await evalAt(
      rule,
      "LGPD: automated decision for Brazilian resident. Direito à revisão humana notified (Portuguese-language notice attached).",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on Brazilian AI output without algorithmic-impact category", async () => {
    const rule = findRule(brazilLgpdAiRules, "br-lgpd-ai-impact-category");
    const v = await evalAt(
      rule,
      "LGPD: automated decision regarding titular de dados produced.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Brazilian AI output WITH algorithmic-impact category", async () => {
    const rule = findRule(brazilLgpdAiRules, "br-lgpd-ai-impact-category");
    const v = await evalAt(
      rule,
      "LGPD: automated decision regarding titular de dados. Categorized as alto risco per PL 2338 art. 13.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("India DPDP pack — DPDP Act + MeitY AI Advisory", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === indiaDpdpAiPack.id)).toBe(true);
    expect(indiaDpdpAiPack.rules.length).toBe(3);
    expect(indiaDpdpAiPack.citation).toMatch(/DPDP|MeitY/);
  });

  it("WARNS on Indian data-principal processing without consent artefact", async () => {
    const rule = findRule(indiaDpdpAiRules, "in-dpdp-consent-artefact");
    const v = await evalAt(
      rule,
      "DPDP processing: Indian data principal record accessed for inference.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Indian data-principal processing WITH consent artefact", async () => {
    const rule = findRule(indiaDpdpAiRules, "in-dpdp-consent-artefact");
    const v = await evalAt(
      rule,
      "DPDP processing: Indian data principal record. Consent manager artefact id CM-2026-04-1182.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on high-risk LLM output without reliability disclaimer", async () => {
    const rule = findRule(indiaDpdpAiRules, "in-meity-unreliable-disclaimer");
    const v = await evalAt(
      rule,
      "Generative AI output: here is the generated summary for the user.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES high-risk LLM output WITH MeitY reliability disclaimer", async () => {
    const rule = findRule(indiaDpdpAiRules, "in-meity-unreliable-disclaimer");
    const v = await evalAt(
      rule,
      "Generative AI output: here is the generated summary. Note per MeitY advisory: output may be unreliable and subject to errors.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on Significant-Data-Fiduciary output without SDF obligations tag", async () => {
    const rule = findRule(indiaDpdpAiRules, "in-sdf-significant-fiduciary-tag");
    const v = await evalAt(
      rule,
      "Large scale processing: significant data fiduciary AI pipeline executed.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Significant-Data-Fiduciary output WITH SDF obligations tag", async () => {
    const rule = findRule(indiaDpdpAiRules, "in-sdf-significant-fiduciary-tag");
    const v = await evalAt(
      rule,
      "SDF AI pipeline executed. DPO appointed, DPIA-2026-04 completed, independent audit annual ref AUDIT-2026-Q1.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — Wave 63 brings total to 26 packs", () => {
  it("ALL_PACKS includes all 6 new Wave-63 packs", () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(ids).toContain(canadaAidaPack.id);
    expect(ids).toContain(ukIcoPack.id);
    expect(ids).toContain(iso42001Pack.id);
    expect(ids).toContain(texasAiPack.id);
    expect(ids).toContain(brazilLgpdAiPack.id);
    expect(ids).toContain(indiaDpdpAiPack.id);
  });

  it("ALL_PACKS has ≥ 26 packs (compounding compliance moat)", () => {
    expect(ALL_PACKS.length).toBeGreaterThanOrEqual(26);
  });

  it("every Wave-63 rule has a unique id", () => {
    const ids = new Set<string>();
    const wave63 = [
      ...canadaAidaRules,
      ...ukIcoRules,
      ...iso42001Rules,
      ...texasAiRules,
      ...brazilLgpdAiRules,
      ...indiaDpdpAiRules,
    ];
    for (const r of wave63) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
    expect(wave63.length).toBe(18);
  });
});
