/**
 * @sovereign-matrix/soc2-evidence tests.
 */
import { describe, it, expect } from "vitest";
import {
  buildSoc2Report,
  toMarkdown,
  toJSON,
  type Soc2Scope,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const SCOPE: Soc2Scope = {
  organizationName: "Acme AI Operations Ltd",
  auditPeriodStart: "2026-01-01T00:00:00Z",
  auditPeriodEnd: "2026-06-30T23:59:59Z",
  inScope: ["security", "availability", "confidentiality"],
  serviceAuditor: "Big Four CPA Firm LLP",
  servicesDescription:
    "AI-powered loan-underwriting platform delivering automated decisions for consumer loans 1k-50k EUR.",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: "2026-03-15T12:00:00Z",
    agentSlug: "underwriter",
    pack: "soc2-cc6",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildSoc2Report — structure", () => {
  it("schema id is stable", () => {
    const report = buildSoc2Report({ scope: SCOPE, receipts: [] });
    expect(report.schema).toBe("vaos-soc2-evidence-v1");
    expect(report.tscVersion).toBe("2017");
  });

  it("ships every CC1-CC9 + opted-in categories", () => {
    const report = buildSoc2Report({ scope: SCOPE, receipts: [] });
    const ids = new Set(report.criteria.map((c) => c.id));
    expect(ids.has("CC1.1")).toBe(true);
    expect(ids.has("CC6.1")).toBe(true);
    expect(ids.has("CC8.1")).toBe(true);
    expect(ids.has("A1.1")).toBe(true); // availability in scope
    expect(ids.has("C1.1")).toBe(true); // confidentiality in scope
    // Privacy NOT in scope — should be absent
    expect(ids.has("P1.1")).toBe(false);
    // Processing integrity NOT in scope — absent
    expect(ids.has("PI1.1")).toBe(false);
  });

  it("security category is always required even if not listed", () => {
    const minimal: Soc2Scope = {
      organizationName: "Acme",
      auditPeriodStart: "2026-01-01T00:00:00Z",
      auditPeriodEnd: "2026-06-30T00:00:00Z",
      inScope: [], // operator left it empty
      servicesDescription: "test",
    };
    const report = buildSoc2Report({ scope: minimal, receipts: [] });
    const ids = new Set(report.criteria.map((c) => c.id));
    expect(ids.has("CC1.1")).toBe(true);
    expect(ids.has("CC6.1")).toBe(true);
  });
});

describe("buildSoc2Report — evidence counting", () => {
  it("counts receipts via pack-prefix match", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [
        rec({ pack: "soc2-cc6-iam" }),
        rec({ pack: "soc2-cc6-rbac" }),
        rec({ pack: "auth-mfa" }),
        rec({ pack: "totally-unrelated" }),
      ],
    });
    const cc61 = report.criteria.find((c) => c.id === "CC6.1");
    // CC6.1 prefixes: soc2, auth, rbac, iam — 3 of the 4 receipts match.
    expect(cc61?.evidenceCount).toBe(3);
  });

  it("tracks earliest/latest issuedAt per criterion", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [
        rec({ pack: "soc2-cc6", issuedAt: "2026-03-15T12:00:00Z" }),
        rec({ pack: "soc2-cc6", issuedAt: "2026-01-05T08:00:00Z" }),
        rec({ pack: "soc2-cc6", issuedAt: "2026-06-20T20:00:00Z" }),
      ],
    });
    const cc61 = report.criteria.find((c) => c.id === "CC6.1");
    expect(cc61?.evidencePeriod.earliest).toBe("2026-01-05T08:00:00Z");
    expect(cc61?.evidencePeriod.latest).toBe("2026-06-20T20:00:00Z");
  });

  it("computes daysOfCoverage as distinct calendar days", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [
        // 3 distinct days
        rec({ pack: "soc2-cc6", issuedAt: "2026-01-01T08:00:00Z" }),
        rec({ pack: "soc2-cc6", issuedAt: "2026-01-01T20:00:00Z" }), // same day
        rec({ pack: "soc2-cc6", issuedAt: "2026-02-15T12:00:00Z" }),
        rec({ pack: "soc2-cc6", issuedAt: "2026-03-20T12:00:00Z" }),
      ],
    });
    const cc61 = report.criteria.find((c) => c.id === "CC6.1");
    expect(cc61?.daysOfCoverage).toBe(3);
  });
});

describe("buildSoc2Report — gap analysis", () => {
  it("flags criteria with zero evidence as gaps", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [rec({ pack: "soc2-cc6" })],
    });
    // Many criteria with no evidence at all.
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(
      report.gaps.every((g) => g.evidenceCount === 0 || g.daysOfCoverage < 30),
    ).toBe(true);
  });

  it("respects custom coverage threshold", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [
        rec({ pack: "soc2-cc6", issuedAt: "2026-01-01T00:00:00Z" }),
        rec({ pack: "soc2-cc6", issuedAt: "2026-01-02T00:00:00Z" }),
      ],
      coverageThresholdDays: 1, // very low
    });
    const cc61 = report.criteria.find((c) => c.id === "CC6.1");
    expect(cc61?.daysOfCoverage).toBe(2);
    // CC6.1 has 2 days coverage, threshold is 1 → not a gap.
    expect(report.gaps.find((g) => g.id === "CC6.1")).toBeUndefined();
  });
});

describe("buildSoc2Report — control owners", () => {
  it("honors controlOwners on valid criterion ids", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [],
      controlOwners: {
        "CC6.1": "Sarah Chen, Director of Security",
        "CC7.4": "Incident Response Team Lead",
      },
    });
    const cc61 = report.criteria.find((c) => c.id === "CC6.1");
    expect(cc61?.controlOwner).toBe("Sarah Chen, Director of Security");
  });

  it("throws on unknown criterion ids in controlOwners", () => {
    expect(() =>
      buildSoc2Report({
        scope: SCOPE,
        receipts: [],
        controlOwners: { "CC99.99": "Nobody" },
      }),
    ).toThrow(/CC99\.99/);
  });
});

describe("buildSoc2Report — summary stats", () => {
  it("byCategory tallies criteria with evidence", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [
        rec({ pack: "soc2-cc1" }),
        rec({ pack: "soc2-availability" }),
        rec({ pack: "soc2-confidentiality" }),
      ],
    });
    expect(report.summary.byCategory.security).toBeGreaterThan(0);
    expect(report.summary.byCategory.availability).toBeGreaterThan(0);
    expect(report.summary.byCategory.confidentiality).toBeGreaterThan(0);
    // Privacy not in scope — never counted
    expect(report.summary.byCategory.privacy).toBe(0);
  });

  it("durationDays computes from auditPeriodStart/End", () => {
    const report = buildSoc2Report({ scope: SCOPE, receipts: [] });
    // 2026-01-01 → 2026-06-30 ~= 181 days
    expect(report.reportingWindow.durationDays).toBeGreaterThan(170);
    expect(report.reportingWindow.durationDays).toBeLessThan(190);
  });
});

describe("buildSoc2Report — empty receipt set", () => {
  it("returns zero-coverage without crashing", () => {
    const report = buildSoc2Report({ scope: SCOPE, receipts: [] });
    expect(report.summary.criteriaWithEvidence).toBe(0);
    expect(report.summary.coverageRate).toBe(0);
    expect(report.gaps.length).toBe(report.criteria.length);
  });
});

describe("buildSoc2Report — defensive", () => {
  it("does not throw on malformed pack fields", () => {
    expect(() =>
      buildSoc2Report({
        scope: SCOPE,
        receipts: [
          rec({ pack: undefined as unknown as string }),
          rec({ pack: "" }),
        ],
      }),
    ).not.toThrow();
  });
});

describe("toMarkdown", () => {
  it("emits binder structure", () => {
    const report = buildSoc2Report({
      scope: SCOPE,
      receipts: [rec({ pack: "soc2-cc6" })],
      controlOwners: { "CC6.1": "Director of Security" },
    });
    const md = toMarkdown(report);
    expect(md).toContain("SOC 2 Evidence Binder");
    expect(md).toContain("Scope");
    expect(md).toContain("Audit period");
    expect(md).toContain("SECURITY criteria");
    expect(md).toContain("AVAILABILITY criteria");
    expect(md).toContain("`CC6.1`");
    expect(md).toContain("Director of Security");
    expect(md).toContain("Provenance");
  });

  it("includes evidence-gaps section when gaps exist", () => {
    const report = buildSoc2Report({ scope: SCOPE, receipts: [] });
    const md = toMarkdown(report);
    expect(md).toContain("Evidence gaps");
  });
});

describe("toJSON", () => {
  it("round-trips with stable schema id", () => {
    const report = buildSoc2Report({ scope: SCOPE, receipts: [rec({})] });
    const json = toJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("vaos-soc2-evidence-v1");
    expect(parsed.tscVersion).toBe("2017");
    expect(parsed.scope.organizationName).toBe(SCOPE.organizationName);
  });
});
