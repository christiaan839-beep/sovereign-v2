/**
 * @sovereign-matrix/nist-ai-rmf tests.
 *
 * Covers:
 *   - buildNistAiRmf populates all 4 functions (GOVERN/MAP/MEASURE/MANAGE)
 *   - subcategory evidence count via pack-prefix match
 *   - coverage stats (with/without evidence, by function, by characteristic)
 *   - reportingWindow first/last timestamp
 *   - maturityOverrides honored on valid ids
 *   - maturityOverrides throws on unknown ids (Wave 79 fail-loud pattern)
 *   - functionNarratives flow through to summary
 *   - empty receipt set produces a zero-coverage report without crashing
 *   - toMarkdown emits all required sections
 *   - toJSON round-trips with stable schema id
 */
import { describe, it, expect } from "vitest";
import {
  buildNistAiRmf,
  toMarkdown,
  toJSON,
  type RmfProfileScope,
} from "../src/index.js";
import {
  ALL_PACKS,
  type ReceiptRecord,
} from "@sovereign-matrix/verifiable-receipts";

/** Every pack id a receipt can actually carry. */
const ALL_REGISTRY_PACKS = ALL_PACKS.map((p) => p.id);

const SCOPE: RmfProfileScope = {
  systemName: "Acme Loan Underwriting AI",
  lifecycleStage: "operation",
  organizationalRole: "AI Operator (financial services)",
  profileType: "current",
  intendedUse:
    "Automated decisioning for consumer loan applications EUR 1k-50k.",
  riskTolerance: "medium",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: new Date().toISOString(),
    agentSlug: "loan-underwriter",
    // A pack id from packs.ts. "human-in-loop" named nothing in the registry.
    pack: "us-nist-ai-rmf-600-1",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildNistAiRmf — structure", () => {
  it("returns the four canonical functions", () => {
    const report = buildNistAiRmf({ scope: SCOPE, receipts: [] });
    expect(report.govern.function).toBe("GOVERN");
    expect(report.map.function).toBe("MAP");
    expect(report.measure.function).toBe("MEASURE");
    expect(report.manage.function).toBe("MANAGE");
  });

  it("schema id is stable", () => {
    const report = buildNistAiRmf({ scope: SCOPE, receipts: [] });
    expect(report.schema).toBe("vaos-nist-ai-rmf-v1");
    expect(report.frameworkVersion).toBe("1.0");
  });

  it("ships a non-trivial subcategory catalog", () => {
    const report = buildNistAiRmf({ scope: SCOPE, receipts: [] });
    expect(report.subcategories.length).toBeGreaterThanOrEqual(40);
    // Spot-check the canonical ids are present.
    const ids = new Set(report.subcategories.map((s) => s.id));
    expect(ids.has("GOVERN-1.1")).toBe(true);
    expect(ids.has("MAP-1.1")).toBe(true);
    expect(ids.has("MEASURE-2.1")).toBe(true);
    expect(ids.has("MANAGE-1.1")).toBe(true);
  });
});

describe("buildNistAiRmf — evidence counting", () => {
  it("counts receipt evidence per subcategory via pack-prefix match", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [
        rec({ pack: "eu-ai-act-2026" }),
        rec({ pack: "iso-42001-2023" }),
        rec({ pack: "us-nist-ai-rmf-600-1" }),
        rec({ pack: "dscsa-2024" }),
      ],
    });
    // GOVERN-1.1 ("legal and regulatory requirements involving AI are
    // understood, managed, and documented") declares eu-ai-act, iso-42001 and
    // us-nist-ai-rmf — 3 of the 4. DSCSA is a drug-supply-chain pack and
    // matches nothing here.
    const g11 = report.subcategories.find((s) => s.id === "GOVERN-1.1");
    expect(g11?.evidenceCount).toBe(3);
  });

  it("cross-pack receipts evidence multiple subcategories", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [rec({ pack: "iso-42001-2023" })],
    });
    // The iso-42001 prefix appears on GOVERN-1.1, GOVERN-1.2, GOVERN-1.3 and
    // several MAP/MEASURE/MANAGE subcategories.
    const evidenced = report.subcategories.filter((s) => s.evidenceCount > 0);
    expect(evidenced.length).toBeGreaterThan(0);
  });

  it("euAiAct prefix maps to compliance-adjacent subcategories", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [rec({ pack: "eu-ai-act-2026" })],
    });
    const g11 = report.subcategories.find((s) => s.id === "GOVERN-1.1");
    expect(g11?.evidenceCount).toBe(1);
  });
});

describe("buildNistAiRmf — coverage statistics", () => {
  it("computes coverage rate correctly", () => {
    const report = buildNistAiRmf({ scope: SCOPE, receipts: [] });
    expect(report.coverage.coverageRate).toBe(0);
    expect(report.coverage.subcategoriesWithEvidence).toBe(0);
    expect(report.coverage.subcategoriesWithoutEvidence).toBe(
      report.subcategories.length,
    );
  });

  it("by-function counts every function this evidence can reach", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      // Every pack in the registry — the exporter's ceiling.
      receipts: ALL_REGISTRY_PACKS.map((pack) => rec({ pack })),
    });
    // Unlike the SOC 2 and HIPAA binders, this framework is in the same
    // domain as the receipts, so all four functions are reachable. The counts
    // are still far short of the full subcategory catalog, and the report says
    // so rather than rounding up.
    expect(report.coverage.byFunction.GOVERN).toBeGreaterThan(0);
    expect(report.coverage.byFunction.MAP).toBeGreaterThan(0);
    expect(report.coverage.byFunction.MEASURE).toBeGreaterThan(0);
    expect(report.coverage.byFunction.MANAGE).toBeGreaterThan(0);
    expect(report.coverage.coverageRate).toBeLessThan(0.5);
  });

  it("by-characteristic tracks trustworthy-AI characteristics", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [
        rec({ pack: "hipaa-2026" }), // privacy-enhanced subcategory MEASURE-2.10
        rec({ pack: "owasp-agentic-top10-2026" }), // safety-related subcategories
      ],
    });
    expect(
      report.coverage.byCharacteristic["privacy-enhanced"],
    ).toBeGreaterThan(0);
    expect(
      report.coverage.byCharacteristic.safe +
        report.coverage.byCharacteristic["secure-and-resilient"],
    ).toBeGreaterThan(0);
  });
});

describe("buildNistAiRmf — maturity overrides", () => {
  it("honors maturity overrides on valid subcategory ids", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [],
      maturityOverrides: { "GOVERN-1.1": 3, "MEASURE-2.7": 2 },
    });
    const g11 = report.subcategories.find((s) => s.id === "GOVERN-1.1");
    const m27 = report.subcategories.find((s) => s.id === "MEASURE-2.7");
    expect(g11?.maturityLevel).toBe(3);
    expect(m27?.maturityLevel).toBe(2);
  });

  it("throws on unknown subcategory ids in maturityOverrides", () => {
    expect(() =>
      buildNistAiRmf({
        scope: SCOPE,
        receipts: [],
        maturityOverrides: { "GOVERN-99.99": 3 } as Record<string, 3>,
      }),
    ).toThrow(/GOVERN-99\.99/);
  });

  it("error lists every unknown id in the message", () => {
    expect(() =>
      buildNistAiRmf({
        scope: SCOPE,
        receipts: [],
        maturityOverrides: {
          "GOVERN-99.99": 0,
          "GOVERN-1.1": 1, // valid — should not appear in error
          "TOTALLY-FAKE": 2,
        } as Record<string, 0 | 1 | 2>,
      }),
    ).toThrow(/GOVERN-99\.99.*TOTALLY-FAKE|TOTALLY-FAKE.*GOVERN-99\.99/);
  });
});

describe("buildNistAiRmf — function narratives", () => {
  it("threads operator narrative into the function summary", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [],
      functionNarratives: {
        GOVERN:
          "AI Governance Committee meets quarterly. Chair: CISO. Charter: docs/ai-governance.md.",
      },
    });
    expect(report.govern.operatorNarrative).toContain(
      "AI Governance Committee",
    );
    expect(report.map.operatorNarrative).toBeUndefined();
  });
});

describe("buildNistAiRmf — reporting window", () => {
  it("picks earliest and latest issuedAt", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [
        rec({ issuedAt: "2026-03-01T00:00:00Z" }),
        rec({ issuedAt: "2026-01-01T00:00:00Z" }),
        rec({ issuedAt: "2026-02-01T00:00:00Z" }),
      ],
    });
    expect(report.reportingWindow.from).toBe("2026-01-01T00:00:00Z");
    expect(report.reportingWindow.to).toBe("2026-03-01T00:00:00Z");
    expect(report.reportingWindow.totalReceipts).toBe(3);
  });
});

describe("buildNistAiRmf — empty receipt set", () => {
  it("returns zero-coverage without crashing", () => {
    const report = buildNistAiRmf({ scope: SCOPE, receipts: [] });
    expect(report.coverage.subcategoriesWithEvidence).toBe(0);
    expect(report.govern.evidenced).toBe(0);
    expect(report.govern.totalReceipts).toBe(0);
  });
});

describe("buildNistAiRmf — defensive", () => {
  it("does not throw on malformed pack fields", () => {
    expect(() =>
      buildNistAiRmf({
        scope: SCOPE,
        receipts: [
          rec({ pack: undefined as unknown as string }),
          rec({ pack: "" }),
          rec({ pack: "RANDOM-PACK-NEVER-SEEN" }),
        ],
      }),
    ).not.toThrow();
  });
});

describe("toMarkdown", () => {
  it("emits every required section", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [rec({})],
      functionNarratives: { GOVERN: "Quarterly committee meetings." },
    });
    const md = toMarkdown(report);
    expect(md).toContain("NIST AI Risk Management Framework 1.0");
    expect(md).toContain("Scope");
    expect(md).toContain("Reporting window");
    expect(md).toContain("Coverage summary");
    expect(md).toContain("GOVERN function");
    expect(md).toContain("MAP function");
    expect(md).toContain("MEASURE function");
    expect(md).toContain("MANAGE function");
    expect(md).toContain("Operator narrative");
    expect(md).toContain("Quarterly committee meetings");
    expect(md).toContain("Provenance");
    // Order check.
    expect(md.indexOf("GOVERN function")).toBeLessThan(
      md.indexOf("MANAGE function"),
    );
  });

  it("emits subcategory tables with maturity column", () => {
    const report = buildNistAiRmf({
      scope: SCOPE,
      receipts: [],
      maturityOverrides: { "GOVERN-1.1": 3 },
    });
    const md = toMarkdown(report);
    expect(md).toContain("`GOVERN-1.1`");
    expect(md).toContain("| 3 |");
  });
});

describe("toJSON", () => {
  it("round-trips with stable schema id", () => {
    const report = buildNistAiRmf({ scope: SCOPE, receipts: [rec({})] });
    const json = toJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("vaos-nist-ai-rmf-v1");
    expect(parsed.scope.systemName).toBe(SCOPE.systemName);
    expect(parsed.subcategories.length).toBeGreaterThanOrEqual(40);
  });
});
