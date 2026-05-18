/**
 * Wave 66 Guardian pack tests — Industrial Foundation Model +
 * Ambient Clinical Scribe.
 *
 * Closes the Gemini "Agentic Transition" research §Manufacturing +
 * §Healthcare gaps with cryptographically-verifiable rule packs.
 *
 * 6 new rules · ~20 tests · brings ALL_PACKS to 34.
 */
import { describe, it, expect } from "vitest";
import {
  industrialFoundationRules,
  industrialFoundationPack,
  ambientScribeRules,
  ambientScribePack,
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

describe("Industrial Foundation Model pack — ISA-95 + IEC 62443", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === industrialFoundationPack.id)).toBe(
      true,
    );
    expect(industrialFoundationPack.rules.length).toBe(3);
    expect(industrialFoundationPack.citation).toMatch(/ISA-95|IEC 62443/);
  });

  it("WARNS on IFM output without ISA-95 level attribution", async () => {
    const rule = findRule(
      industrialFoundationRules,
      "ifm-isa95-level-attribution",
    );
    const v = await evalAt(
      rule,
      "Industrial foundation model output: line throughput trending down.",
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/ISA-95/);
  });

  it("PASSES IFM output WITH ISA-95 L2 level reference", async () => {
    const rule = findRule(
      industrialFoundationRules,
      "ifm-isa95-level-attribution",
    );
    const v = await evalAt(
      rule,
      "Industrial foundation model output: line throughput trending down. ISA-95 L2 operational scope.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on IFM output without IEC 62443 security zone tag", async () => {
    const rule = findRule(
      industrialFoundationRules,
      "ifm-iec62443-zone-classification",
    );
    const v = await evalAt(rule, "OEE drop detected on packaging line A.");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES IFM output WITH IEC 62443 zone classification", async () => {
    const rule = findRule(
      industrialFoundationRules,
      "ifm-iec62443-zone-classification",
    );
    const v = await evalAt(
      rule,
      "OEE drop detected on packaging line A. IEC 62443 zone tag: SL-2.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS shop-floor line-stop recommendation without numeric justification", async () => {
    const rule = findRule(
      industrialFoundationRules,
      "ifm-oee-corrective-action-magnitude",
    );
    const v = await evalAt(
      rule,
      "Shop floor agent: stop the line immediately. OEE looks degraded.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/Operator-safety|justification/);
  });

  it("PASSES shop-floor line-stop WITH OEE numeric justification", async () => {
    const rule = findRule(
      industrialFoundationRules,
      "ifm-oee-corrective-action-magnitude",
    );
    const v = await evalAt(
      rule,
      "Industrial foundation model: stop the line. OEE dropped 23% in last 90s; quality index < 0.80.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Ambient Clinical Scribe pack — HIPAA + 21st Century Cures Act", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === ambientScribePack.id)).toBe(true);
    expect(ambientScribePack.rules.length).toBe(3);
    expect(ambientScribePack.citation).toMatch(/HIPAA|Cures Act|AMA/);
  });

  it("WARNS on ambient clinical note without minimum-necessary attestation", async () => {
    const rule = findRule(
      ambientScribeRules,
      "ambient-scribe-minimum-necessary",
    );
    const v = await evalAt(
      rule,
      "Ambient AI scribe note: patient presented with chest pain, vital signs stable.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES ambient clinical note WITH minimum-necessary attestation", async () => {
    const rule = findRule(
      ambientScribeRules,
      "ambient-scribe-minimum-necessary",
    );
    const v = await evalAt(
      rule,
      "Ambient AI scribe note: patient presented with chest pain. Minimum necessary applied (PHI scope limited per 164.502(b)).",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on ambient clinical note without patient-export pathway", async () => {
    const rule = findRule(
      ambientScribeRules,
      "ambient-scribe-info-blocking-exportable",
    );
    const v = await evalAt(
      rule,
      "Clinical note generated by ambient AI; final SOAP note attached.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES ambient clinical note WITH FHIR / USCDI export pathway", async () => {
    const rule = findRule(
      ambientScribeRules,
      "ambient-scribe-info-blocking-exportable",
    );
    const v = await evalAt(
      rule,
      "Ambient AI clinical note; USCDI v3 export pathway available via FHIR endpoint, Information Blocking Rule compliant.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS ambient note finalized to EHR without clinician attestation", async () => {
    const rule = findRule(
      ambientScribeRules,
      "ambient-scribe-clinician-attestation",
    );
    const v = await evalAt(
      rule,
      "Ambient AI clinical note finalized and signed off; committed to EHR for billing.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/clinician|attestation/i);
  });

  it("PASSES ambient note finalized WITH clinician attestation", async () => {
    const rule = findRule(
      ambientScribeRules,
      "ambient-scribe-clinician-attestation",
    );
    const v = await evalAt(
      rule,
      "Ambient AI clinical note finalized; physician attestation by signing provider id NPI-1234567890; committed to EHR.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — Wave 66 brings total to 34 packs", () => {
  it("ALL_PACKS includes both new Wave-66 packs", () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(ids).toContain(industrialFoundationPack.id);
    expect(ids).toContain(ambientScribePack.id);
  });

  it("ALL_PACKS has ≥ 34 packs (compounding moat)", () => {
    expect(ALL_PACKS.length).toBeGreaterThanOrEqual(34);
  });

  it("every Wave-66 rule has a unique id across the whole registry", () => {
    const ids = new Set<string>();
    for (const pack of ALL_PACKS) {
      for (const r of pack.rules) {
        expect(ids.has(r.id)).toBe(false);
        ids.add(r.id);
      }
    }
  });
});
