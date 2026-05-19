import { describe, it, expect } from "vitest";
import { buildEuCra, toMarkdown, toJSON, type CraScope } from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const SCOPE: CraScope = {
  manufacturer: "Acme AI Inc.",
  productName: "Sovereign Receipt Mint",
  productIdentifier: "srm-1.0",
  category: "important-class-II",
  intendedUse:
    "Server-side mint of cryptographically signed receipts for autonomous AI agents.",
  placedOnMarketAt: "2026-06-01T00:00:00Z",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: "2026-06-15T12:00:00Z",
    agentSlug: "mint",
    pack: "cra-secure-design",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildEuCra — structure", () => {
  it("schema id is stable", () => {
    const r = buildEuCra({ scope: SCOPE, receipts: [] });
    expect(r.schema).toBe("vaos-eu-cra-v1");
    expect(r.regulationVersion).toBe("2024-2847");
  });

  it("ships requirements across all 4 categories", () => {
    const r = buildEuCra({ scope: SCOPE, receipts: [] });
    const cats = new Set(r.requirements.map((rq) => rq.category));
    expect(cats.has("design")).toBe(true);
    expect(cats.has("vulnerability-handling")).toBe(true);
    expect(cats.has("post-market")).toBe(true);
    expect(cats.has("documentation")).toBe(true);
  });

  it("includes the canonical Annex I + Article ids", () => {
    const r = buildEuCra({ scope: SCOPE, receipts: [] });
    const ids = new Set(r.requirements.map((rq) => rq.id));
    expect(ids.has("AI.I.1")).toBe(true);
    expect(ids.has("AI.I.3.d")).toBe(true);
    expect(ids.has("AI.II.5")).toBe(true);
    expect(ids.has("AI.PM.1")).toBe(true);
    expect(ids.has("AI.TD.2")).toBe(true);
  });
});

describe("buildEuCra — evidence counting", () => {
  it("counts via pack-prefix match", () => {
    const r = buildEuCra({
      scope: SCOPE,
      receipts: [
        rec({ pack: "cra-secure-design" }),
        rec({ pack: "cra-encryption-aes" }),
        rec({ pack: "tls-1.3" }),
        rec({ pack: "totally-unrelated" }),
      ],
    });
    const designReq = r.requirements.find((rq) => rq.id === "AI.I.1");
    // AI.I.1 prefixes: cra + soc2-cc6 + owasp + secure-design → at least 1 matches
    expect(designReq?.evidenceCount).toBeGreaterThan(0);
  });

  it("vaos prefix maps to integrity controls", () => {
    const r = buildEuCra({
      scope: SCOPE,
      receipts: [rec({ pack: "vaos-receipt-signature" })],
    });
    const integrityReq = r.requirements.find((rq) => rq.id === "AI.I.3.e");
    expect(integrityReq?.evidenceCount).toBe(1);
  });
});

describe("buildEuCra — findings", () => {
  it("flags requirements with zero evidence + no note", () => {
    const r = buildEuCra({ scope: SCOPE, receipts: [] });
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings.every((f) => f.evidenceCount === 0)).toBe(true);
  });

  it("does not flag requirement with operator note", () => {
    const r = buildEuCra({
      scope: SCOPE,
      receipts: [],
      implementationStatus: {
        "AI.TD.4": {
          status: "compliant",
          note: "CE mark applied on product packaging per 2026-06-01.",
        },
      },
    });
    expect(r.findings.find((f) => f.id === "AI.TD.4")).toBeUndefined();
  });

  it("does not flag requirement marked not-applicable", () => {
    const r = buildEuCra({
      scope: SCOPE,
      receipts: [],
      implementationStatus: {
        "AI.I.3.h": {
          status: "not-applicable",
          note: "Product does not interact with other devices/networks.",
        },
      },
    });
    expect(r.findings.find((f) => f.id === "AI.I.3.h")).toBeUndefined();
  });
});

describe("buildEuCra — fail loud", () => {
  it("throws on unknown ids in implementationStatus", () => {
    expect(() =>
      buildEuCra({
        scope: SCOPE,
        receipts: [],
        implementationStatus: { "AI.ZZZ.99": { status: "compliant" } },
      }),
    ).toThrow(/AI\.ZZZ\.99/);
  });
});

describe("buildEuCra — risk assessment", () => {
  it("preserves operator-declared residual risks", () => {
    const r = buildEuCra({
      scope: SCOPE,
      receipts: [],
      residualRisks: [
        "Quantum-computer-led break of ECDSA receipts within 5-10 years.",
        "ASI-class adversary forging signatures via training-data exfiltration.",
      ],
    });
    expect(r.riskAssessment.residualRisks.length).toBe(2);
    expect(r.riskAssessment.risksIdentified).toBe(2);
  });
});

describe("toMarkdown / toJSON", () => {
  it("toMarkdown emits required sections", () => {
    const r = buildEuCra({
      scope: SCOPE,
      receipts: [rec({ pack: "cra-encryption" })],
    });
    const md = toMarkdown(r);
    expect(md).toContain("EU Cyber Resilience Act");
    expect(md).toContain("Annex I Part I");
    expect(md).toContain("Annex I Part II");
    expect(md).toContain("Article 14");
    expect(md).toContain("Article 13");
    expect(md).toContain("Provenance");
  });

  it("toJSON round-trips", () => {
    const r = buildEuCra({ scope: SCOPE, receipts: [rec({})] });
    const parsed = JSON.parse(toJSON(r));
    expect(parsed.schema).toBe("vaos-eu-cra-v1");
    expect(parsed.scope.productName).toBe(SCOPE.productName);
  });
});
