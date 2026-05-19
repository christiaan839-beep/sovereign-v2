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
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

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
    pack: "hipaa-iam",
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
        rec({ pack: "hipaa-iam-rbac" }),
        rec({ pack: "hipaa-iam-mfa" }),
        rec({ pack: "rbac-policy" }),
        rec({ pack: "totally-unrelated" }),
      ],
    });
    const access = report.specifications.find((s) => s.id === "164.312(a)(1)");
    // 164.312(a)(1) prefixes: hipaa, iam, rbac — 3 of 4 match.
    expect(access?.evidenceCount).toBe(3);
  });

  it("vaos prefix maps to integrity controls", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [rec({ pack: "vaos-receipt" })],
    });
    const integrity = report.specifications.find(
      (s) => s.id === "164.312(c)(1)",
    );
    expect(integrity?.evidenceCount).toBeGreaterThan(0);
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
      receipts: [
        rec({ pack: "hipaa-iam" }),
        rec({ pack: "hipaa-audit-log" }),
        rec({ pack: "hipaa-encryption" }),
      ],
    });
    expect(report.summary.requiredEvidenced).toBeGreaterThan(0);
    expect(report.summary.addressableEvidenced).toBeGreaterThan(0);
  });

  it("byCategory tallies non-zero categories", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [
        rec({ pack: "hipaa-iam" }), // administrative + technical
        rec({ pack: "hipaa-encryption" }), // technical
      ],
    });
    expect(report.summary.byCategory.administrative).toBeGreaterThan(0);
    expect(report.summary.byCategory.technical).toBeGreaterThan(0);
  });
});

describe("toMarkdown", () => {
  it("emits required binder structure", () => {
    const report = buildHipaaSecurity({
      scope: SCOPE,
      receipts: [rec({ pack: "hipaa-iam" })],
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
