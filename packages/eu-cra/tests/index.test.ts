import { describe, it, expect } from "vitest";
import { buildEuCra, toMarkdown, toJSON, type CraScope } from "../src/index.js";
import {
  ALL_PACKS,
  type ReceiptRecord,
} from "@sovereign-matrix/verifiable-receipts";

/** Every pack id a receipt can actually carry. */
const ALL_REGISTRY_PACKS = ALL_PACKS.map((p) => p.id);

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
    // A pack id from packs.ts. "cra-secure-design" named nothing in the
    // registry; it counted only under the catch-all prefix "cra".
    pack: "owasp-agentic-top10-2026",
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
        rec({ pack: "owasp-agentic-top10-2026" }),
        rec({ pack: "owasp-agentic-top10-2026" }),
        rec({ pack: "hipaa-2026" }),
        rec({ pack: "dscsa-2024" }),
      ],
    });
    // AI.I.1 (secure by design) declares the "owasp" prefix — 2 of the 4.
    const designReq = r.requirements.find((rq) => rq.id === "AI.I.1");
    expect(designReq?.evidenceCount).toBe(2);
  });

  it("Annex I is almost entirely out of reach of this evidence", () => {
    const r = buildEuCra({
      scope: SCOPE,
      // Every pack in the registry — the exporter's ceiling.
      receipts: ALL_REGISTRY_PACKS.map((pack) => rec({ pack })),
    });
    const evidenced = r.requirements.filter((rq) => rq.evidenceCount > 0);
    // Three requirements out of 29, all three reached through one pack.
    // Annex I is about the security properties of a shipped product — SBOM,
    // signed updates, vulnerability handling, attack-surface reduction. A
    // guardrail verdict on a model's wording evidences none of that, and the
    // report has to say so rather than counting every receipt through the
    // catch-all prefix "cra", under which one receipt covered all 29.
    expect(evidenced.length).toBe(3);
    expect(r.requirements.length).toBeGreaterThan(20);
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
      receipts: [rec({})],
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
