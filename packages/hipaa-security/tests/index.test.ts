/**
 * @sovereign-matrix/hipaa-security tests.
 */
import { describe, it, expect } from "vitest";
import {
  buildHipaaSecurity,
  toMarkdown,
  toJSON,
  type HipaaScope,
} from "../src/index.js";
import {
  ALL_PACKS,
  type ReceiptRecord,
} from "@sovereign-matrix/verifiable-receipts";

/** Every pack id a receipt can actually carry. */
const ALL_REGISTRY_PACKS = ALL_PACKS.map((p) => p.id);

const SCOPE: HipaaScope = {
  organizationName: "Acme Health AI Inc.",
  organizationType: "business-associate",
  ephiCategoriesDescription:
    "AI-derived triage recommendations + clinician question/answer logs.",
  auditPeriodStart: "2026-01-01T00:00:00Z",
  auditPeriodEnd: "2026-12-31T23:59:59Z",
  securityOfficial: "Sarah Patel, CISO",
  privacyOfficial: "Dr. James Liu, Privacy Officer",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: "2026-03-15T12:00:00Z",
    agentSlug: "triage-agent",
    // A pack id that exists in packs.ts. "iam-core" named nothing: it counted
    // only under the catch-all prefix "hipaa", which every specification
    // carried and which made one receipt evidence all 52.
    pack: "owasp-agentic-top10-2026",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildHipaaSecurity — structure", () => {
  it("schema id is stable", () => {
    const report = buildHipaaSecurity({ scope: SCOPE, receipts: [] });
    expect(report.schema).toBe("vaos-hipaa-security-v1");
    expect(report.ruleVersion).toBe("45-CFR-164");
  });

  it("ships specifications across all 5 categories", () => {
    const report = buildHipaaSecurity({ scope: SCOPE, receipts: [] });
    const categories = new Set(report.specifications.map((s) => s.category));
    expect(categories.has("administrative")).toBe(true);
    expect(categories.has("physical")).toBe(true);
    expect(categories.has("technical")).toBe(true);
    expect(categories.has("organizational")).toBe(true);
    expect(categories.has("policies")).toBe(true);
  });

  it("classifies specifications as required or addressable", () => {
    const report = buildHipaaSecurity({ scope: SCOPE, receipts: [] });
    const required = report.specifications.filter(
      (s) => s.classification === "required",
    );
    const addressable = report.specifications.filter(
      (s) => s.classification === "addressable",
    );
    expect(required.length).toBeGreaterThan(0);
    expect(addressable.length).toBeGreaterThan(0);
  });

  it("includes the canonical Security Rule ids", () => {
    const report = buildHipaaSecurity({ scope: SCOPE, receipts: [] });
    const ids = new Set(report.specifications.map((s) => s.id));
    expect(ids.has("164.308(a)(1)(ii)(A)")).toBe(true); // Risk Analysis
    expect(ids.has("164.310(a)(1)")).toBe(true); // Facility Access Controls
    expect(ids.has("164.312(a)(1)")).toBe(true); // Access Control
    expect(ids.has("164.312(b)")).toBe(true); // Audit Controls
    expect(ids.has("164.312(c)(1)")).toBe(true); // Integrity
    expect(ids.has("164.316(a)")).toBe(true); // Policies + Procedures
  });
});

describe("buildHipaaSecurity — evidence counting", () => {
  it("counts evidence via pack-prefix match", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [
        rec({ pack: "owasp-agentic-top10-2026" }),
        rec({ pack: "owasp-agentic-top10-2026" }),
        rec({ pack: "owasp-agentic-top10-2026" }),
        rec({ pack: "hipaa-2026" }),
      ],
    });
    // Risk Analysis is the one specification a receipt can reach: it declares
    // the "owasp" prefix, and 3 of the 4 receipts carry that pack.
    const riskAnalysis = report.specifications.find(
      (s) => s.id === "164.308(a)(1)(ii)(A)",
    );
    expect(riskAnalysis?.evidenceCount).toBe(3);
  });

  it("the Security Rule is almost entirely out of reach of this evidence", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      // Every pack in the registry — the exporter's ceiling.
      receipts: ALL_REGISTRY_PACKS.map((pack) => rec({ pack })),
    });
    const evidenced = report.specifications.filter((s) => s.evidenceCount > 0);
    // One specification, out of 52. That is the honest number and it is what
    // this binder should say. The Security Rule governs workforce clearance,
    // facility access, workstation use, device disposal and business-associate
    // contracts; a guardrail verdict on a model's wording evidences none of
    // them. Before the catch-all prefix was removed this was 52 of 52 from a
    // single receipt, which is the reading that would have gone to an auditor.
    expect(evidenced.map((s) => s.id)).toEqual(["164.308(a)(1)(ii)(A)"]);
    expect(report.specifications.length).toBeGreaterThan(40);
  });
});

describe("buildHipaaSecurity — findings", () => {
  it("flags REQUIRED specs with zero evidence as findings", () => {
    const report = buildHipaaSecurity({ scope: SCOPE, receipts: [] });
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every((f) => f.classification === "required")).toBe(
      true,
    );
    expect(report.findings.every((f) => f.evidenceCount === 0)).toBe(true);
  });

  it("does not flag spec when operator provides implementation note", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [],
      implementationStatus: {
        "164.308(a)(2)": {
          status: "implemented",
          note: "Sarah Patel appointed Security Official 2024-01-15. See HR record SEC-2024-001.",
        },
      },
    });
    const finding = report.findings.find((f) => f.id === "164.308(a)(2)");
    expect(finding).toBeUndefined();
  });

  it("does not flag spec marked as not-applicable", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [],
      implementationStatus: {
        "164.314(b)(1)": {
          status: "not-applicable",
          note: "Not a group health plan.",
        },
      },
    });
    const finding = report.findings.find((f) => f.id === "164.314(b)(1)");
    expect(finding).toBeUndefined();
  });
});

describe("buildHipaaSecurity — fail loud", () => {
  it("throws on unknown specification ids in implementationStatus", () => {
    expect(() =>
      buildHipaaSecurity({
        scope: SCOPE,
        receipts: [],
        implementationStatus: {
          "164.999(z)": { status: "implemented" },
        },
      }),
    ).toThrow(/164\.999\(z\)/);
  });
});

describe("buildHipaaSecurity — summary stats", () => {
  it("counts required vs addressable evidenced", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: ALL_REGISTRY_PACKS.map((pack) => rec({ pack })),
    });
    // Risk Analysis is a *required* implementation specification, so the
    // required tally moves and the addressable one cannot: no addressable
    // specification declares a reachable pack.
    expect(report.summary.requiredEvidenced).toBe(1);
    expect(report.summary.addressableEvidenced).toBe(0);
  });

  it("byCategory tallies non-zero categories", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: ALL_REGISTRY_PACKS.map((pack) => rec({ pack })),
    });
    // Administrative only, via Risk Analysis. Physical and technical
    // safeguards stay at zero whatever is fed in.
    expect(report.summary.byCategory.administrative).toBe(1);
    expect(report.summary.byCategory.physical).toBe(0);
    expect(report.summary.byCategory.technical).toBe(0);
  });
});

describe("toMarkdown", () => {
  it("emits required binder structure", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [rec({})],
    });
    const md = toMarkdown(report);
    expect(md).toContain("HIPAA Security Rule Evidence Binder");
    expect(md).toContain("Scope");
    expect(md).toContain("§ 164.308");
    expect(md).toContain("§ 164.310");
    expect(md).toContain("§ 164.312");
    expect(md).toContain("Provenance");
  });

  it("includes findings section when findings exist", () => {
    const report = buildHipaaSecurity({ scope: SCOPE, receipts: [] });
    const md = toMarkdown(report);
    expect(md).toContain("Open findings");
  });
});

describe("toJSON", () => {
  it("round-trips with stable schema id", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [rec({})],
    });
    const json = toJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("vaos-hipaa-security-v1");
    expect(parsed.scope.organizationName).toBe(SCOPE.organizationName);
  });
});
