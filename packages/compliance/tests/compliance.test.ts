/**
 * Compliance engine tests.
 *
 * Covers:
 *   - tallyEvidence: prefix matching, case-insensitivity, distinct-day
 *     counting, earliest/latest, and receipts with no pack
 *   - buildControlMatrix: category scoping, alwaysInScope, gap
 *     detection at the coverage threshold, controlOwners validation,
 *     unmapped-receipt accounting, and duration arithmetic
 *   - the registry: unknown slug throws and names the alternatives,
 *     every pack has unique ids and non-empty prefixes
 *   - rendering: required sections present, pipes in regulation text
 *     escaped, meta columns rendered when the pack declares them
 *   - risk register: the 5x5 matrix, capped attenuation, duplicate ids
 *   - defensive: an empty receipt set and malformed fields don't throw
 */
import { describe, it, expect } from "vitest";
import {
  REGULATIONS,
  buildComplianceReport,
  buildControlMatrix,
  getRegulation,
  isRegulationId,
  listRegulations,
  renderMarkdown,
  scoreRisk,
  scoreRiskRegister,
  attenuate,
  summariseRegister,
  tallyEvidence,
  type ReceiptLike,
  type RegulationPack,
  type ReportScope,
  type RiskScenario,
} from "../src/index.js";
import { toMarkdown } from "../src/engine.js";

/** A receipt carrying only what the engine reads. */
function rec(pack: string, day: string): ReceiptLike {
  return { pack, issuedAt: `${day}T12:00:00.000Z`, verdictId: `${pack}-${day}` };
}

/** n receipts on n consecutive days from 2026-03-01. */
function daily(pack: string, n: number): ReceiptLike[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 2, 1 + i));
    return rec(pack, d.toISOString().slice(0, 10));
  });
}

const SCOPE: ReportScope = {
  organizationName: "Acme Financial AI Ltd",
  systemName: "acme-loan-2026",
  periodStart: "2026-01-01T00:00:00Z",
  periodEnd: "2026-04-01T00:00:00Z",
};

describe("tallyEvidence", () => {
  it("matches on pack prefix, case-insensitively", () => {
    const receipts = [
      rec("SOC2-CC6.1", "2026-03-01"),
      rec("soc2-cc6.2", "2026-03-02"),
      rec("hipaa-164.312", "2026-03-03"),
    ];
    expect(tallyEvidence(receipts, ["soc2"]).count).toBe(2);
    expect(tallyEvidence(receipts, ["SOC2"]).count).toBe(2);
    expect(tallyEvidence(receipts, ["hipaa"]).count).toBe(1);
    expect(tallyEvidence(receipts, ["nope"]).count).toBe(0);
  });

  it("counts distinct UTC days, not receipts", () => {
    const receipts = [
      rec("soc2", "2026-03-01"),
      { pack: "soc2", issuedAt: "2026-03-01T23:59:59.000Z" },
      rec("soc2", "2026-03-02"),
    ];
    const t = tallyEvidence(receipts, ["soc2"]);
    expect(t.count).toBe(3);
    expect(t.daysOfCoverage).toBe(2);
    expect(t.earliest).toBe("2026-03-01T12:00:00.000Z");
    expect(t.latest).toBe("2026-03-02T12:00:00.000Z");
  });

  it("returns a null window when nothing matches", () => {
    const t = tallyEvidence([rec("other", "2026-03-01")], ["soc2"]);
    expect(t).toEqual({
      count: 0,
      earliest: null,
      latest: null,
      daysOfCoverage: 0,
    });
  });

  it("ignores receipts with no pack, and malformed fields", () => {
    const receipts = [
      { verdictId: "no-pack" },
      { pack: 42, issuedAt: 7 } as unknown as ReceiptLike,
      { pack: "soc2" },
      rec("soc2", "2026-03-01"),
    ];
    const t = tallyEvidence(receipts, ["soc2"]);
    expect(t.count).toBe(2);
    // The pack-carrying receipt with no timestamp contributes no day.
    expect(t.daysOfCoverage).toBe(1);
  });
});

describe("buildControlMatrix", () => {
  it("counts evidence per control and computes coverage", () => {
    const report = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: daily("soc2-cc1", 40),
    });
    const cc11 = report.controls.find((c) => c.id === "CC1.1");
    expect(cc11?.evidence.count).toBe(40);
    expect(cc11?.evidence.daysOfCoverage).toBe(40);
    expect(report.summary.controlsWithEvidence).toBeGreaterThan(0);
    expect(report.summary.coverageRate).toBeGreaterThan(0);
    expect(report.reportingWindow.durationDays).toBe(90);
  });

  it("keeps alwaysInScope categories and drops unselected ones", () => {
    const all = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: [],
    });
    const scoped = buildComplianceReport({
      regulation: "soc2",
      scope: { ...SCOPE, inScope: ["confidentiality"] },
      receipts: [],
    });
    expect(scoped.controls.length).toBeLessThan(all.controls.length);
    const cats = new Set(scoped.controls.map((c) => c.category));
    // Security is alwaysInScope for SOC 2 and survives without being asked for.
    expect(cats.has("security")).toBe(true);
    expect(cats.has("confidentiality")).toBe(true);
    expect(cats.has("availability")).toBe(false);
  });

  it("treats thin coverage as a gap, not as pass", () => {
    // 5 receipts on 5 days — evidence exists but is far under the
    // 30-day default threshold.
    const report = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: daily("soc2-cc1", 5),
    });
    const cc11 = report.controls.find((c) => c.id === "CC1.1")!;
    expect(cc11.evidence.count).toBe(5);
    expect(report.gaps.map((g) => g.id)).toContain("CC1.1");

    // Same receipts, threshold lowered — no longer a gap.
    const lenient = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: daily("soc2-cc1", 5),
      coverageThresholdDays: 3,
    });
    expect(lenient.gaps.map((g) => g.id)).not.toContain("CC1.1");
  });

  it("throws on an unknown controlOwners id rather than dropping it", () => {
    expect(() =>
      buildComplianceReport({
        regulation: "soc2",
        scope: SCOPE,
        receipts: [],
        controlOwners: { "CC1.1": "Head of Security", "CC99.9": "Nobody" },
      }),
    ).toThrow(/CC99\.9/);
  });

  it("attaches a known control owner", () => {
    const report = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: [],
      controlOwners: { "CC1.1": "Head of Security" },
    });
    expect(report.controls.find((c) => c.id === "CC1.1")?.controlOwner).toBe(
      "Head of Security",
    );
  });

  it("accounts for receipts that map to no control", () => {
    const report = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: [
        ...daily("soc2-cc1", 3),
        rec("something-unmapped", "2026-03-01"),
        rec("something-unmapped", "2026-03-02"),
        { verdictId: "packless" },
      ],
    });
    expect(report.summary.unmappedReceipts).toBe(3);
  });

  it("takes an annotated control out of the gap list", () => {
    const plain = buildComplianceReport({
      regulation: "hipaa-security",
      scope: SCOPE,
      receipts: [],
    });
    const annotated = buildComplianceReport({
      regulation: "hipaa-security",
      scope: SCOPE,
      receipts: [],
      annotations: {
        "164.314(b)(1)": {
          status: "not-applicable",
          note: "Not a group health plan.",
        },
      },
    });
    expect(annotated.summary.controlsAnnotated).toBe(1);
    expect(annotated.gaps.length).toBe(plain.gaps.length - 1);
    expect(annotated.gaps.map((g) => g.id)).not.toContain("164.314(b)(1)");
    const control = annotated.controls.find((c) => c.id === "164.314(b)(1)");
    expect(control?.annotation?.status).toBe("not-applicable");
  });

  it("throws on an unknown annotation id", () => {
    expect(() =>
      buildComplianceReport({
        regulation: "hipaa-security",
        scope: SCOPE,
        receipts: [],
        annotations: { "164.999": { note: "nope" } },
      }),
    ).toThrow(/annotations referenced unknown/);
  });

  it("renders the operator note beside the control", () => {
    const md = renderMarkdown(
      buildComplianceReport({
        regulation: "hipaa-security",
        scope: SCOPE,
        receipts: [],
        annotations: {
          "164.314(b)(1)": {
            status: "not-applicable",
            note: "Not a group health plan.",
          },
        },
      }),
    );
    expect(md).toContain("not-applicable — Not a group health plan.");
  });

  it("survives an empty receipt set", () => {
    const report = buildComplianceReport({
      regulation: "hipaa-security",
      scope: SCOPE,
      receipts: [],
    });
    expect(report.summary.controlsWithEvidence).toBe(0);
    expect(report.summary.coverageRate).toBe(0);
    expect(report.gaps.length).toBe(report.controls.length);
  });

  it("falls back to a 1-day window on unparseable dates", () => {
    const report = buildComplianceReport({
      regulation: "eu-cra",
      scope: { ...SCOPE, periodStart: "not-a-date", periodEnd: "nope" },
      receipts: [],
    });
    expect(report.reportingWindow.durationDays).toBe(1);
  });
});

describe("registry", () => {
  it("lists every regulation with a non-empty catalogue", () => {
    const list = listRegulations();
    expect(list.length).toBe(Object.keys(REGULATIONS).length);
    for (const r of list) {
      expect(r.controlCount).toBeGreaterThan(0);
      expect(r.categories.length).toBeGreaterThan(0);
    }
  });

  // These counts are what the five separate exporter packages carried
  // before they were folded into one engine. A drop here means the
  // collapse lost regulation text, which is the failure that would be
  // hardest to notice by eye.
  it.each([
    ["soc2", 51],
    ["iso-42001", 38],
    ["nist-ai-rmf", 50],
    ["hipaa-security", 52],
    ["eu-cra", 29],
  ])("%s carries all %i controls", (id, count) => {
    expect(getRegulation(id as string).controls.length).toBe(count);
  });

  it("names the alternatives when a slug is unknown", () => {
    expect(() => getRegulation("iso-9001")).toThrow(/Available: /);
    expect(isRegulationId("soc2")).toBe(true);
    expect(isRegulationId("iso-9001")).toBe(false);
  });

  it("does not treat inherited Object properties as regulations", () => {
    expect(isRegulationId("constructor")).toBe(false);
    expect(isRegulationId("__proto__")).toBe(false);
    expect(() => getRegulation("toString")).toThrow();
  });

  it.each(Object.entries(REGULATIONS))(
    "%s has unique ids, mapped prefixes and declared categories",
    (_id, pack: RegulationPack) => {
      const ids = new Set<string>();
      for (const c of pack.controls) {
        expect(ids.has(c.id), `duplicate id ${c.id}`).toBe(false);
        ids.add(c.id);
        expect(c.evidencePackPrefixes.length).toBeGreaterThan(0);
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.objective.length).toBeGreaterThan(0);
        expect(
          pack.categories.includes(c.category),
          `${c.id} category "${c.category}" missing from pack.categories`,
        ).toBe(true);
      }
    },
  );
});

describe("renderMarkdown", () => {
  it("renders the sections an auditor looks for", () => {
    const md = renderMarkdown(
      buildComplianceReport({
        regulation: "soc2",
        scope: SCOPE,
        receipts: daily("soc2-cc1", 40),
      }),
    );
    expect(md).toContain("# SOC 2 Evidence Binder");
    expect(md).toContain("## Scope");
    expect(md).toContain("## Summary");
    expect(md).toContain("### Coverage by category");
    expect(md).toContain("## Gaps");
    expect(md).toContain("## Provenance");
    expect(md).toContain("`CC1.1`");
  });

  it("renders the meta columns a pack declares", () => {
    const md = renderMarkdown(
      buildComplianceReport({
        regulation: "hipaa-security",
        scope: SCOPE,
        receipts: [],
      }),
    );
    expect(md).toContain("R/A |");
    expect(md).toContain("required");
  });

  it("escapes pipes so regulation text cannot break a table row", () => {
    const pack: RegulationPack = {
      id: "test",
      standard: "Test Standard",
      reportTitle: "Test Report",
      schema: "test-v1",
      preamble: "Test.",
      controlNoun: { singular: "control", plural: "controls" },
      categories: ["only"],
      controls: [
        {
          id: "T.1",
          category: "only",
          title: "Confidentiality | integrity | availability",
          objective: "Pipes | everywhere",
          evidencePackPrefixes: ["test"],
        },
      ],
    };
    const report = buildControlMatrix({ pack, scope: SCOPE, receipts: [] });
    const md = toMarkdown(report, pack);
    const row = md.split("\n").find((l) => l.includes("`T.1`"))!;
    expect(row).toContain("\\|");
    // The row has 8 unescaped cells: id, title, evidence, days, first,
    // last, owner, note — plus the leading and trailing pipe.
    expect(row.replace(/\\\|/g, "").split("|").length).toBe(10);
  });

  it("refuses to render a report whose pack it does not know", () => {
    const report = buildComplianceReport({
      regulation: "soc2",
      scope: SCOPE,
      receipts: [],
    });
    expect(() => renderMarkdown({ ...report, schema: "unknown-v1" })).toThrow(
      /no registered regulation/,
    );
  });
});

describe("risk register", () => {
  it("bands the 5x5 matrix at its corners", () => {
    expect(scoreRisk("rare", "negligible")).toBe("very-low");
    expect(scoreRisk("almost-certain", "catastrophic")).toBe("extreme");
    expect(scoreRisk("possible", "moderate")).toBe("medium");
    expect(scoreRisk("likely", "major")).toBe("high");
  });

  it("attenuates by evidence volume, capped at two bands", () => {
    expect(attenuate("extreme", 0)).toBe("extreme");
    expect(attenuate("extreme", 10)).toBe("high");
    expect(attenuate("extreme", 100)).toBe("medium");
    expect(attenuate("extreme", 1_000_000)).toBe("medium");
    expect(attenuate("very-low", 1_000_000)).toBe("very-low");
  });

  it("scores a register against receipts", () => {
    const scenarios: RiskScenario[] = [
      {
        id: "R1",
        description: "Prompt injection exfiltrates customer data",
        source: "prompt injection",
        likelihood: "likely",
        impact: "major",
        treatment: "reduce",
        treatmentDescription: "Guardian jailbreak pack on every inbound turn",
        evidencePackPrefixes: ["jailbreak"],
      },
      {
        id: "R2",
        description: "Model drift degrades decision quality",
        source: "model drift",
        likelihood: "possible",
        impact: "moderate",
        treatment: "accept",
        treatmentDescription: "Quarterly review",
        evidencePackPrefixes: ["drift"],
      },
    ];
    const scored = scoreRiskRegister(scenarios, daily("jailbreak", 120));
    expect(scored[0]!.inherentRisk).toBe("high");
    expect(scored[0]!.evidenceCount).toBe(120);
    expect(scored[0]!.residualRisk).toBe("low");
    expect(scored[1]!.evidenceCount).toBe(0);
    expect(scored[1]!.residualRisk).toBe(scored[1]!.inherentRisk);

    const summary = summariseRegister(scored);
    expect(summary.scenariosTotal).toBe(2);
    expect(summary.untreated).toBe(1);
    expect(summary.highOrWorseInherent).toBe(1);
    expect(summary.highOrWorseResidual).toBe(0);
  });

  it("throws on a duplicate scenario id", () => {
    const s: RiskScenario = {
      id: "R1",
      description: "d",
      source: "s",
      likelihood: "rare",
      impact: "minor",
      treatment: "accept",
      treatmentDescription: "t",
      evidencePackPrefixes: ["x"],
    };
    expect(() => scoreRiskRegister([s, { ...s }], [])).toThrow(/duplicate/);
  });
});
