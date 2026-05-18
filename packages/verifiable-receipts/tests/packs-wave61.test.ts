/**
 * Guardian rule packs — NYC AEDT / FERPA / FDA SaMD / EU DORA.
 *
 * Wave 61 — three underserved-vertical packs (hiring AI, education
 * AI, medical-device AI) + EU DORA (financial ICT resilience).
 * Each rule tested positive AND negative. Tests double as
 * documentation for the regulatory clauses cited inline.
 */
import { describe, it, expect } from "vitest";
import {
  nycAedtRules,
  nycAedtPack,
  ferpaRules,
  ferpaPack,
  fdaSaMDRules,
  fdaSaMDPack,
  doraRules,
  doraPack,
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

describe("NYC AEDT pack — Local Law 144", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === nycAedtPack.id)).toBe(true);
    expect(nycAedtPack.rules.length).toBe(3);
    expect(nycAedtPack.citation).toMatch(/Local Law 144/);
  });

  it("WARNS on hiring decision without bias-audit attestation", async () => {
    const rule = findRule(nycAedtRules, "nyc-aedt-bias-audit-attestation");
    const v = await evalAt(
      rule,
      "Candidate Jane Smith advanced to interview stage.",
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/Local Law 144/);
  });

  it("PASSES hiring decision WITH bias-audit reference", async () => {
    const rule = findRule(nycAedtRules, "nyc-aedt-bias-audit-attestation");
    const v = await evalAt(
      rule,
      "Candidate advanced to interview stage. Bias-audit completed 2026-04-15.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on hiring decision without candidate-notice attestation", async () => {
    const rule = findRule(nycAedtRules, "nyc-aedt-candidate-notice");
    const v = await evalAt(
      rule,
      "Applicant rejected based on automated screen.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES hiring decision WITH 10-business-day notice mention", async () => {
    const rule = findRule(nycAedtRules, "nyc-aedt-candidate-notice");
    const v = await evalAt(
      rule,
      "Applicant rejected. 10-business-day notice provided per Local Law 144.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS hiring decision citing a protected class", async () => {
    const rule = findRule(nycAedtRules, "nyc-aedt-protected-class-in-output");
    const v = await evalAt(
      rule,
      "Applicant rejected due to applicant's age 58 and marital status.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/protected class/i);
  });
});

describe("FERPA pack — US Student Records", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === ferpaPack.id)).toBe(true);
    expect(ferpaPack.rules.length).toBe(3);
    expect(ferpaPack.citation).toMatch(/FERPA|1232g/);
  });

  it("BLOCKS student record + SSN combo without consent", async () => {
    const rule = findRule(ferpaRules, "ferpa-no-student-pii-without-consent");
    const v = await evalAt(
      rule,
      "Student Jane Smith, SSN 123-45-6789, enrolled in Bio 101.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/FERPA/);
  });

  it("PASSES student record + PII WHEN consent attestation present", async () => {
    const rule = findRule(ferpaRules, "ferpa-no-student-pii-without-consent");
    const v = await evalAt(
      rule,
      "Student Jane Smith, SSN 123-45-6789, enrolled in Bio 101. Parental consent on file.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on directory-info disclosure without opt-out check", async () => {
    const rule = findRule(ferpaRules, "ferpa-directory-info-opt-out-check");
    const v = await evalAt(
      rule,
      "Student Jane Smith, email jane@example.edu, enrollment status active.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES when opt-out check is mentioned", async () => {
    const rule = findRule(ferpaRules, "ferpa-directory-info-opt-out-check");
    const v = await evalAt(
      rule,
      "Student Jane Smith email jane@example.edu — opt-out verified for directory disclosure.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on school-official internal-use without educational rationale", async () => {
    const rule = findRule(
      ferpaRules,
      "ferpa-school-official-exception-rationale",
    );
    const v = await evalAt(
      rule,
      "Internal use: student records reviewed by AI school official.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES school-official internal-use with legitimate educational interest", async () => {
    const rule = findRule(
      ferpaRules,
      "ferpa-school-official-exception-rationale",
    );
    const v = await evalAt(
      rule,
      "School-official internal use of student records for legitimate educational interest in supporting learning outcomes.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("FDA SaMD pack — Software as Medical Device", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === fdaSaMDPack.id)).toBe(true);
    expect(fdaSaMDPack.rules.length).toBe(3);
    expect(fdaSaMDPack.citation).toMatch(/FDA|SaMD/);
  });

  it("WARNS on clinical output without intended-use statement", async () => {
    const rule = findRule(fdaSaMDRules, "fda-samd-intended-use-statement");
    const v = await evalAt(rule, "Diagnosis: appendicitis. Recommend surgery.");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES clinical output WITH decision-support qualifier", async () => {
    const rule = findRule(fdaSaMDRules, "fda-samd-intended-use-statement");
    const v = await evalAt(
      rule,
      "AI clinical decision support: appendicitis likely. For clinician review, not direct diagnosis.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on clinical output without confidence disclosure", async () => {
    const rule = findRule(fdaSaMDRules, "fda-samd-confidence-disclosure");
    const v = await evalAt(
      rule,
      "For clinician review: probable pneumonia diagnosis from chest X-ray.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES clinical output WITH confidence interval", async () => {
    const rule = findRule(fdaSaMDRules, "fda-samd-confidence-disclosure");
    const v = await evalAt(
      rule,
      "For clinician review: probable pneumonia diagnosis from chest X-ray. Confidence interval 0.85-0.92.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS prescriptive output without human-in-the-loop qualifier", async () => {
    const rule = findRule(fdaSaMDRules, "fda-samd-no-direct-prescription");
    const v = await evalAt(rule, "Prescribe metformin 500mg twice daily.");
    expect(v.verdict).toBe("block");
  });

  it("PASSES prescriptive output WITH physician-review qualifier", async () => {
    const rule = findRule(fdaSaMDRules, "fda-samd-no-direct-prescription");
    const v = await evalAt(
      rule,
      "Suggested: prescribe metformin 500mg twice daily — for physician review and approval.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("EU DORA pack — Digital Operational Resilience", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === doraPack.id)).toBe(true);
    expect(doraPack.rules.length).toBe(3);
    expect(doraPack.citation).toMatch(/2022\/2554|DORA/);
  });

  it("WARNS on ICT-incident output without severity tier", async () => {
    const rule = findRule(doraRules, "dora-rts-art18-severity-tier");
    const v = await evalAt(
      rule,
      "ICT incident detected at 14:00 UTC. Investigating.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES ICT-incident output WITH severity tier", async () => {
    const rule = findRule(doraRules, "dora-rts-art18-severity-tier");
    const v = await evalAt(
      rule,
      "ICT incident detected at 14:00 UTC. Severity tier 2 (significant). Investigating.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on major-incident classification without 4-hour clock", async () => {
    const rule = findRule(doraRules, "dora-4h-major-incident-clock");
    const v = await evalAt(
      rule,
      "Major incident: payment-rail outage classified as notifiable.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES major incident WITH 4-hour clock", async () => {
    const rule = findRule(doraRules, "dora-4h-major-incident-clock");
    const v = await evalAt(
      rule,
      "Major incident: payment-rail outage. 4-hour reporting clock started at 14:00 UTC. Initial notification by 18:00 UTC.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on third-party decision without CTPP / LEI / RoI reference", async () => {
    const rule = findRule(doraRules, "dora-third-party-id-attestation");
    const v = await evalAt(
      rule,
      "Risk-classified critical ICT service from vendor X as high-risk.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES third-party decision WITH vendor / LEI reference", async () => {
    const rule = findRule(doraRules, "dora-third-party-id-attestation");
    const v = await evalAt(
      rule,
      "Risk-classified critical ICT service: vendor X (LEI 5493001KJTIIGC8Y1R12) — high-risk per Register of Information.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — Wave 61 brings total packs to 15", () => {
  it("ALL_PACKS includes all 4 new Wave-61 packs", () => {
    const ids = ALL_PACKS.map((p) => p.id);
    expect(ids).toContain(nycAedtPack.id);
    expect(ids).toContain(ferpaPack.id);
    expect(ids).toContain(fdaSaMDPack.id);
    expect(ids).toContain(doraPack.id);
  });

  it("ALL_PACKS has ≥ 15 packs (compounding compliance moat)", () => {
    expect(ALL_PACKS.length).toBeGreaterThanOrEqual(15);
  });

  it("every pack has unique id + non-empty rules + citation", () => {
    const ids = new Set<string>();
    for (const p of ALL_PACKS) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.rules.length).toBeGreaterThan(0);
      expect(p.citation.length).toBeGreaterThan(5);
    }
  });
});
