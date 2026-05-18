/**
 * Wave 67 Guardian pack tests — Quebec Law 25 + Saudi PDPL +
 * Vietnam Decree 13.
 *
 * Three jurisdictions previously not covered:
 *   - Quebec (Canada): strictest automated-decision + French-language
 *     regime in the Americas
 *   - Saudi Arabia: SDAIA-regulated, Vision 2030 procurement gate
 *   - Vietnam: Decree 13 + data-localization rules
 *
 * 9 new rules · 19 tests · brings ALL_PACKS to 37.
 */
import { describe, it, expect } from "vitest";
import {
  quebecLaw25Rules,
  quebecLaw25Pack,
  saudiPdplRules,
  saudiPdplPack,
  vietnamCyberRules,
  vietnamCyberPack,
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

describe("Quebec Law 25 pack — Bill 64", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === quebecLaw25Pack.id)).toBe(true);
    expect(quebecLaw25Pack.rules.length).toBe(3);
    expect(quebecLaw25Pack.citation).toMatch(/Quebec|Law 25|Bill 64/);
  });

  it("WARNS on Quebec automated decision without PIA reference", async () => {
    const rule = findRule(quebecLaw25Rules, "qc-law25-pia-reference");
    const v = await evalAt(
      rule,
      "Law 25: automated decision processed for Quebec resident.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Quebec automated decision WITH ÉFVP reference", async () => {
    const rule = findRule(quebecLaw25Rules, "qc-law25-pia-reference");
    const v = await evalAt(
      rule,
      "Law 25: automated decision for Quebec resident. ÉFVP completed 2026-04-15.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on Quebec automated decision without French-language pathway", async () => {
    const rule = findRule(quebecLaw25Rules, "qc-law25-french-explanation");
    const v = await evalAt(
      rule,
      "Bill 64: automated decision applied to Quebec data subject.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Quebec automated decision WITH French explanation", async () => {
    const rule = findRule(quebecLaw25Rules, "qc-law25-french-explanation");
    const v = await evalAt(
      rule,
      "Law 25: automated decision for Quebec resident. Explication en français provided per Charter of the French Language.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS Quebec PI cross-border transfer without adequacy attestation", async () => {
    const rule = findRule(quebecLaw25Rules, "qc-law25-cross-border-adequacy");
    const v = await evalAt(
      rule,
      "Law 25: Quebec resident PI cross-border transfer to US processing pipeline.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/s\.?\s?17|adequacy/);
  });

  it("PASSES Quebec cross-border WITH adequacy attestation", async () => {
    const rule = findRule(quebecLaw25Rules, "qc-law25-cross-border-adequacy");
    const v = await evalAt(
      rule,
      "Law 25: Quebec resident PI cross-border transfer to US. s. 17 assessment completed; equivalent protection demonstrated.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Saudi PDPL pack — SDAIA + AI Ethics Principles v2.0", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === saudiPdplPack.id)).toBe(true);
    expect(saudiPdplPack.rules.length).toBe(3);
    expect(saudiPdplPack.citation).toMatch(/Saudi|SDAIA|PDPL/);
  });

  it("WARNS on Saudi AI processing without SDAIA registration", async () => {
    const rule = findRule(saudiPdplRules, "sa-pdpl-sdaia-registration");
    const v = await evalAt(
      rule,
      "PDPL Saudi: AI inference produced for Saudi resident.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Saudi AI processing WITH SDAIA registration", async () => {
    const rule = findRule(saudiPdplRules, "sa-pdpl-sdaia-registration");
    const v = await evalAt(
      rule,
      "PDPL Saudi: AI inference for Saudi resident. SDAIA registration SD-CR-2026-0142 on file.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on Saudi AI output without ethics principles tag", async () => {
    const rule = findRule(saudiPdplRules, "sa-pdpl-ai-ethics-principle-tag");
    const v = await evalAt(
      rule,
      "KSA user automated recommendation served by foundation model.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Saudi AI output WITH SDAIA AI Ethics principle tag", async () => {
    const rule = findRule(saudiPdplRules, "sa-pdpl-ai-ethics-principle-tag");
    const v = await evalAt(
      rule,
      "KSA user automated recommendation; SDAIA AI Ethics Principles v2.0 Accountability + Transparency applied.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS Saudi cross-border transfer without Art. 29 attestation", async () => {
    const rule = findRule(saudiPdplRules, "sa-pdpl-cross-border-art29");
    const v = await evalAt(
      rule,
      "Saudi user PI cross-border export to Frankfurt processing region.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/Art\.?\s?29|adequacy/);
  });

  it("PASSES Saudi cross-border WITH Art. 29 attestation", async () => {
    const rule = findRule(saudiPdplRules, "sa-pdpl-cross-border-art29");
    const v = await evalAt(
      rule,
      "Saudi user PI cross-border export to Frankfurt. Art. 29 adequacy attestation on file (SDAIA-approved 2026-Q1).",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Vietnam Cybersecurity + Decree 13 pack", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === vietnamCyberPack.id)).toBe(true);
    expect(vietnamCyberPack.rules.length).toBe(3);
    expect(vietnamCyberPack.citation).toMatch(/Vietnam|Decree 13|2023/);
  });

  it("WARNS on Vietnamese AI processing without PDPIA reference", async () => {
    const rule = findRule(vietnamCyberRules, "vn-decree13-impact-assessment");
    const v = await evalAt(
      rule,
      "Decree 13 2023 processing: Vietnamese data subject inference complete.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES Vietnamese AI processing WITH PDPIA reference", async () => {
    const rule = findRule(vietnamCyberRules, "vn-decree13-impact-assessment");
    const v = await evalAt(
      rule,
      "Decree 13 2023 processing: Vietnamese data subject. PDPIA completed and filed with MPS per Art. 25.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on important-data processing without localization attestation", async () => {
    const rule = findRule(
      vietnamCyberRules,
      "vn-data-localization-attestation",
    );
    const v = await evalAt(
      rule,
      "Vietnam Cybersecurity Law: important data classified for processing.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES important-data processing WITH localization attestation", async () => {
    const rule = findRule(
      vietnamCyberRules,
      "vn-data-localization-attestation",
    );
    const v = await evalAt(
      rule,
      "Vietnam Cybersecurity Law: important data processed onshore. Decree 53 compliant, data localization verified.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on Vietnamese notice without Vietnamese-language version", async () => {
    const rule = findRule(vietnamCyberRules, "vn-vietnamese-notice");
    const v = await evalAt(
      rule,
      "Decree 13 2023: notice issued to Vietnamese data subject.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES notice WITH Vietnamese-language version", async () => {
    const rule = findRule(vietnamCyberRules, "vn-vietnamese-notice");
    const v = await evalAt(
      rule,
      "Decree 13 2023: notice issued to Vietnamese data subject. Bilingual notice (Vietnamese-language version attached).",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — Wave 67 brings total to 37 packs", () => {
  it("ALL_PACKS includes all 3 new Wave-67 packs", () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(ids).toContain(quebecLaw25Pack.id);
    expect(ids).toContain(saudiPdplPack.id);
    expect(ids).toContain(vietnamCyberPack.id);
  });

  it("ALL_PACKS has ≥ 37 packs (compounding compliance moat)", () => {
    expect(ALL_PACKS.length).toBeGreaterThanOrEqual(37);
  });

  it("every Wave-67 rule has a globally unique id", () => {
    const all = new Set<string>();
    for (const p of ALL_PACKS) {
      for (const r of p.rules) {
        expect(all.has(r.id)).toBe(false);
        all.add(r.id);
      }
    }
  });
});
