/**
 * Guardian rule packs — Wave 62 (5 underserved-vertical packs that
 * complete the May 2026 market-gap roadmap from MARKET-GAPS-2026.md):
 *   - Colorado SB 24-205 (AI Consumer Protection Act, eff. Feb 1 2026)
 *   - California AB 2013 (GenAI training-data transparency, eff. Jan 1 2026)
 *   - Australia APRA CPS 230 + Privacy Act ADM (active Jul 2025)
 *   - FDA PCCP Dec 2024 final guidance (continuous-learning AI medical)
 *   - Illinois AI Video Interview Act + HB 3773 (eff. Jan 1 2026)
 *
 * Total: 15 new rules, 30 tests (positive + negative for each rule).
 * Brings ALL_PACKS to 20. Tests double as documentation of the
 * regulatory clauses cited inline.
 */
import { describe, it, expect } from "vitest";
import {
  coloradoAiRules,
  coloradoAiPack,
  californiaAb2013Rules,
  californiaAb2013Pack,
  apraCps230Rules,
  apraCps230Pack,
  fdaPccpRules,
  fdaPccpPack,
  illinoisAiRules,
  illinoisAiPack,
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

describe("Colorado AI pack — SB 24-205", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === coloradoAiPack.id)).toBe(true);
    expect(coloradoAiPack.rules.length).toBe(3);
    expect(coloradoAiPack.citation).toMatch(/SB 24-205|6-1-1701/);
  });

  it("WARNS on consequential decision without impact-assessment ref", async () => {
    const rule = findRule(
      coloradoAiRules,
      "colorado-sb24-205-impact-assessment",
    );
    const v = await evalAt(rule, "Loan denied for applicant 12345.");
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/impact[-\s]?assessment/i);
  });

  it("PASSES consequential decision WITH impact-assessment reference", async () => {
    const rule = findRule(
      coloradoAiRules,
      "colorado-sb24-205-impact-assessment",
    );
    const v = await evalAt(
      rule,
      "Loan denied for applicant 12345. Impact assessment IA-2026-04 on file.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS CO-resident consequential decision without disclosure", async () => {
    const rule = findRule(
      coloradoAiRules,
      "colorado-sb24-205-discrimination-disclosure",
    );
    const v = await evalAt(
      rule,
      "Consequential decision: housing application denied for Colorado resident.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/discrimination|appeal/i);
  });

  it("PASSES CO-resident decision WITH appeal-right disclosure", async () => {
    const rule = findRule(
      coloradoAiRules,
      "colorado-sb24-205-discrimination-disclosure",
    );
    const v = await evalAt(
      rule,
      "Consequential decision: housing application denied for Colorado resident. Algorithmic discrimination notice provided; human review available on request.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on high-risk AI notice without public statement link", async () => {
    const rule = findRule(
      coloradoAiRules,
      "colorado-sb24-205-public-statement-link",
    );
    const v = await evalAt(rule, "High-risk AI deployment notice issued.");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES high-risk AI notice WITH public statement link", async () => {
    const rule = findRule(
      coloradoAiRules,
      "colorado-sb24-205-public-statement-link",
    );
    const v = await evalAt(
      rule,
      "High-risk AI deployment notice. Public statement: https://example.com/ai-policy.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("California AB 2013 pack — GenAI training data transparency", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === californiaAb2013Pack.id)).toBe(true);
    expect(californiaAb2013Pack.rules.length).toBe(3);
    expect(californiaAb2013Pack.citation).toMatch(/AB 2013|22757\.1/);
  });

  it("WARNS on GenAI output without training-data manifest", async () => {
    const rule = findRule(
      californiaAb2013Rules,
      "ca-ab2013-training-data-manifest",
    );
    const v = await evalAt(
      rule,
      "LLM response: Yes, here is the generated summary you requested.",
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/manifest/i);
  });

  it("PASSES GenAI output WITH training-data manifest hash", async () => {
    const rule = findRule(
      californiaAb2013Rules,
      "ca-ab2013-training-data-manifest",
    );
    const v = await evalAt(
      rule,
      "LLM response: generated summary. Training-data manifest hash: sha256:abc123.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on GenAI output without synthetic-data percentage", async () => {
    const rule = findRule(
      californiaAb2013Rules,
      "ca-ab2013-synthetic-data-percentage",
    );
    const v = await evalAt(
      rule,
      "Model output: foundation model inference complete.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES GenAI output WITH synthetic data composition", async () => {
    const rule = findRule(
      californiaAb2013Rules,
      "ca-ab2013-synthetic-data-percentage",
    );
    const v = await evalAt(
      rule,
      "Model output: inference complete. Data composition: synthetic 18%, real 82%.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on GenAI output without copyright-clearance flag", async () => {
    const rule = findRule(
      californiaAb2013Rules,
      "ca-ab2013-copyright-clearance-flag",
    );
    const v = await evalAt(rule, "LLM response: here is the model output.");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES GenAI output WITH copyright-cleared flag", async () => {
    const rule = findRule(
      californiaAb2013Rules,
      "ca-ab2013-copyright-clearance-flag",
    );
    const v = await evalAt(
      rule,
      "LLM response: here is the output. Sources: licensed data + public domain corpus, copyright cleared.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("APRA CPS 230 pack — Australia operational resilience", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === apraCps230Pack.id)).toBe(true);
    expect(apraCps230Pack.rules.length).toBe(3);
    expect(apraCps230Pack.citation).toMatch(/CPS 230|Privacy Act/);
  });

  it("WARNS on material-service output without tolerance level", async () => {
    const rule = findRule(apraCps230Rules, "apra-cps230-tolerance-level");
    const v = await evalAt(
      rule,
      "Material service: core banking transaction processed.",
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/tolerance/i);
  });

  it("PASSES material-service output WITH RTO/RPO metric", async () => {
    const rule = findRule(apraCps230Rules, "apra-cps230-tolerance-level");
    const v = await evalAt(
      rule,
      "Material service: core banking transaction. Tolerance: RTO 4h, RPO 15min, availability 99.95%.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on third-party decision without fourth-party chain", async () => {
    const rule = findRule(apraCps230Rules, "apra-cps230-fourth-party-chain");
    const v = await evalAt(
      rule,
      "Third-party risk: outsourced service from vendor X assessed.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES third-party decision WITH fourth-party dependency map", async () => {
    const rule = findRule(apraCps230Rules, "apra-cps230-fourth-party-chain");
    const v = await evalAt(
      rule,
      "Third-party risk: vendor X. Sub-contractor chain: vendor Y (cloud), vendor Z (KMS). Dependency chain documented.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on automated decision without consumer explanation", async () => {
    const rule = findRule(apraCps230Rules, "apra-cps230-consumer-explanation");
    const v = await evalAt(
      rule,
      "Automated decision: loan application approved by model.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES automated decision WITH consumer-explanation token", async () => {
    const rule = findRule(apraCps230Rules, "apra-cps230-consumer-explanation");
    const v = await evalAt(
      rule,
      "Automated decision: loan approved. Plain-language reason: applicant meets income and credit-history thresholds. Right to explanation: contact support.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("FDA PCCP pack — continuous-learning medical AI", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === fdaPccpPack.id)).toBe(true);
    expect(fdaPccpPack.rules.length).toBe(3);
    expect(fdaPccpPack.citation).toMatch(/PCCP|AI\/ML/);
  });

  it("WARNS on continuous-learning inference without PCCP version", async () => {
    const rule = findRule(fdaPccpRules, "fda-pccp-version-reference");
    const v = await evalAt(
      rule,
      "Adaptive model inference: sepsis risk score 0.78.",
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/PCCP/i);
  });

  it("PASSES inference WITH PCCP version reference", async () => {
    const rule = findRule(fdaPccpRules, "fda-pccp-version-reference");
    const v = await evalAt(
      rule,
      "Adaptive model inference: sepsis risk 0.78. PCCP v2.1, Modification Protocol active.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on adaptive inference without model-weights hash", async () => {
    const rule = findRule(fdaPccpRules, "fda-pccp-weights-hash");
    const v = await evalAt(
      rule,
      "Continuous learning model retrained for radiology triage.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES inference WITH model-weights hash", async () => {
    const rule = findRule(fdaPccpRules, "fda-pccp-weights-hash");
    const v = await evalAt(
      rule,
      "Continuous learning model retrained for radiology triage. Weights hash sha256:0123456789abcdef.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS adaptive model output reporting drift out of bounds", async () => {
    const rule = findRule(fdaPccpRules, "fda-pccp-drift-bounds");
    const v = await evalAt(
      rule,
      "Adaptive model update: AUC drop > 0.05 detected, drift exceeded bounds.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/drift|bounds/i);
  });

  it("PASSES adaptive model output with drift within bounds", async () => {
    const rule = findRule(fdaPccpRules, "fda-pccp-drift-bounds");
    const v = await evalAt(
      rule,
      "Adaptive model inference: drift within Modification Protocol bounds. AUC stable at 0.91.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Illinois AI pack — Video Interview Act + HB 3773", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === illinoisAiPack.id)).toBe(true);
    expect(illinoisAiPack.rules.length).toBe(3);
    expect(illinoisAiPack.citation).toMatch(/Illinois|820 ILCS|HB 3773/);
  });

  it("BLOCKS AI video-interview analysis without candidate consent", async () => {
    const rule = findRule(illinoisAiRules, "illinois-ai-video-consent");
    const v = await evalAt(
      rule,
      "AI video interview analysis: candidate communication score 8/10.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/consent/i);
  });

  it("PASSES AI video-interview analysis WITH explicit consent", async () => {
    const rule = findRule(illinoisAiRules, "illinois-ai-video-consent");
    const v = await evalAt(
      rule,
      "AI video interview analysis: candidate consent obtained and signed release on file.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on video-interview output without 30-day destruction policy", async () => {
    const rule = findRule(illinoisAiRules, "illinois-ai-retention-policy");
    const v = await evalAt(
      rule,
      "AI video interview analysis complete. Candidate consent verified.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES video-interview output WITH 30-day destruction policy", async () => {
    const rule = findRule(illinoisAiRules, "illinois-ai-retention-policy");
    const v = await evalAt(
      rule,
      "AI video interview analysis complete. Recording destroyed within 30 days per retention policy.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on employment-AI decision without bias-audit reference", async () => {
    const rule = findRule(illinoisAiRules, "illinois-hb3773-bias-audit");
    const v = await evalAt(
      rule,
      "Candidate ranked top 3 by employment screen model.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES employment-AI decision WITH annual bias-audit reference", async () => {
    const rule = findRule(illinoisAiRules, "illinois-hb3773-bias-audit");
    const v = await evalAt(
      rule,
      "Candidate ranked top 3 by employment screen model. Annual bias audit completed 2026-03-15 per HB 3773.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — Wave 62 brings total to 20 packs", () => {
  it("ALL_PACKS includes all 5 new Wave-62 packs", () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(ids).toContain(coloradoAiPack.id);
    expect(ids).toContain(californiaAb2013Pack.id);
    expect(ids).toContain(apraCps230Pack.id);
    expect(ids).toContain(fdaPccpPack.id);
    expect(ids).toContain(illinoisAiPack.id);
  });

  it("ALL_PACKS has ≥ 20 packs (compounding compliance moat)", () => {
    expect(ALL_PACKS.length).toBeGreaterThanOrEqual(20);
  });

  it("every Wave-62 rule has a unique id", () => {
    const ids = new Set<string>();
    const wave62 = [
      ...coloradoAiRules,
      ...californiaAb2013Rules,
      ...apraCps230Rules,
      ...fdaPccpRules,
      ...illinoisAiRules,
    ];
    for (const r of wave62) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
    expect(wave62.length).toBe(15);
  });
});
