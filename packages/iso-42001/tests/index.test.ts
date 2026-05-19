/**
 * @sovereign-matrix/iso-42001 tests.
 *
 * Covers:
 *   - buildIso42001 populates clauses 7-10 + Annex A from receipts;
 *     leaves clauses 4-6 as operator-authored stubs
 *   - verdictCounts + blockRate arithmetic
 *   - reportingWindow first/last timestamp from receipts
 *   - clause7 retention window honors override
 *   - clause9 latency percentiles + receipts/day
 *   - clause10 distinct agents + packs over window
 *   - Annex A control evidence counts via pack-prefix match
 *   - applicabilityOverrides flip control applicability
 *   - toMarkdown produces a stable structure with every required section
 *   - toJSON produces valid JSON parseable back to the same shape
 *   - Empty receipt set produces a stub-only report without crashing
 *   - Defensive: malformed receipt fields don't throw
 */
import { describe, it, expect } from "vitest";
import {
  buildIso42001,
  toMarkdown,
  toJSON,
  type AimsScope,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const SCOPE: AimsScope = {
  organizationName: "Acme AI Operations Ltd",
  scopeStatement:
    "All production AI agents serving consumer loan applicants in the EU.",
  aiSystemRole: "provider",
  certificationBody: "BSI",
  lastInternalAudit: "2026-03-15T00:00:00Z",
  nextManagementReview: "2026-09-15T00:00:00Z",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: new Date().toISOString(),
    agentSlug: "loan-underwriter",
    pack: "iso42001-aims",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildIso42001 — Clause 7 Support", () => {
  it("counts documented information from receipts", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [rec({}), rec({}), rec({})],
    });
    expect(report.clause7Support.documentedInformationCount).toBe(3);
    expect(report.clause7Support.derived).toBe(true);
  });

  it("defaults retention to 365 days and honors override", () => {
    const defaulted = buildIso42001({ scope: SCOPE, receipts: [] });
    expect(defaulted.clause7Support.retentionWindowDays).toBe(365);

    const overridden = buildIso42001({
      scope: SCOPE,
      receipts: [],
      retentionDays: 2555, // 7 years
    });
    expect(overridden.clause7Support.retentionWindowDays).toBe(2555);
  });

  it("captures the integrity mechanism string", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [] });
    expect(report.clause7Support.integrityMechanism).toContain("Ed25519");
    expect(report.clause7Support.integrityMechanism).toContain("ML-DSA-65");
    expect(report.clause7Support.integrityMechanism).toContain("RFC 9162");
  });
});

describe("buildIso42001 — Clause 8 Operation", () => {
  it("counts pass/warn/block verdicts and computes block-rate", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [
        rec({ overall: "pass" }),
        rec({ overall: "pass" }),
        rec({ overall: "warn" }),
        rec({ overall: "block" }),
        rec({ overall: "block" }),
      ],
    });
    expect(report.clause8Operation.verdictCounts.pass).toBe(2);
    expect(report.clause8Operation.verdictCounts.warn).toBe(1);
    expect(report.clause8Operation.verdictCounts.block).toBe(2);
    expect(report.clause8Operation.blockRate).toBe(0.4);
  });

  it("aggregates distinct agents and packs sorted alphabetically", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [
        rec({ agentSlug: "loan-underwriter", pack: "iso42001-aims" }),
        rec({ agentSlug: "credit-analyst", pack: "gdpr-2026" }),
        rec({ agentSlug: "loan-underwriter", pack: "euAiActPack" }),
      ],
    });
    expect(report.clause8Operation.agentsOperated).toEqual([
      "credit-analyst",
      "loan-underwriter",
    ]);
    expect(report.clause8Operation.packsApplied).toEqual([
      "euAiActPack",
      "gdpr-2026",
      "iso42001-aims",
    ]);
  });
});

describe("buildIso42001 — Clause 9 Performance evaluation", () => {
  it("computes p50 and p99 latency from receipt.totalMs", () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const report = buildIso42001({
      scope: SCOPE,
      receipts: latencies.map((ms) =>
        rec({ totalMs: ms } as unknown as Partial<ReceiptRecord>),
      ),
    });
    expect(report.clause9Performance.p50LatencyMs).toBe(60);
    expect(report.clause9Performance.p99LatencyMs).toBe(100);
  });

  it("returns null latency when no receipts carry totalMs", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [rec({}), rec({})],
    });
    expect(report.clause9Performance.p50LatencyMs).toBeNull();
    expect(report.clause9Performance.p99LatencyMs).toBeNull();
  });

  it("counts anomalies via the anomalyKind field", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [
        rec({}),
        rec({ anomalyKind: "block-rate-spike" }),
        rec({ anomalyKind: "volume-burst" }),
        rec({}),
      ],
    });
    expect(report.clause9Performance.anomaliesDetected).toBe(2);
  });

  it("computes receipts/day across the reporting window", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [
        rec({ issuedAt: "2026-01-01T00:00:00Z" }),
        rec({ issuedAt: "2026-01-01T12:00:00Z" }),
        rec({ issuedAt: "2026-01-02T00:00:00Z" }),
      ],
    });
    // 3 receipts over ~1 day window → ~3/day. spanDays is clamped to ≥1.
    expect(report.clause9Performance.receiptsPerDay).toBeGreaterThan(0);
  });
});

describe("buildIso42001 — Clause 10 Improvement", () => {
  it("captures operator actions verbatim", () => {
    const actions = [
      "Tightened blocklist (2026-04-01)",
      "Added FAIR Act pack (2026-04-15)",
    ];
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [rec({})],
      operatorActions: actions,
    });
    expect(report.clause10Improvement.operatorActions).toEqual(actions);
  });

  it("counts distinct agents and packs over window", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [
        rec({ agentSlug: "a1", pack: "p1" }),
        rec({ agentSlug: "a2", pack: "p2" }),
        rec({ agentSlug: "a1", pack: "p1" }),
      ],
    });
    expect(report.clause10Improvement.distinctAgentsOverWindow).toBe(2);
    expect(report.clause10Improvement.distinctPacksOverWindow).toBe(2);
  });
});

describe("buildIso42001 — Annex A reference controls", () => {
  it("ships the canonical 38-control catalog", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [] });
    expect(report.annexAControls.length).toBe(38);
  });

  it("counts receipt evidence per control via pack-prefix match", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [
        rec({ pack: "iso42001-aims" }),
        rec({ pack: "iso42001-other" }),
        rec({ pack: "gdpr-2026" }),
        rec({ pack: "totally-unrelated-pack" }),
      ],
    });
    // A.2.2 (AI policy) evidencePackPrefixes includes "iso42001" — matches 2.
    const a22 = report.annexAControls.find((c) => c.id === "A.2.2");
    expect(a22?.evidenceCount).toBe(2);
    // A.7.3 (Acquisition of data) includes "iso42001" + "gdpr" + "popia" — matches 3.
    const a73 = report.annexAControls.find((c) => c.id === "A.7.3");
    expect(a73?.evidenceCount).toBe(3);
    // Pack "totally-unrelated-pack" never matches.
  });

  it("defaults all controls to applicable=true", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [] });
    expect(report.annexAControls.every((c) => c.applicable === true)).toBe(
      true,
    );
  });

  it("honors applicabilityOverrides", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [],
      applicabilityOverrides: { "A.3.3": false, "A.10.3": false },
    });
    const a33 = report.annexAControls.find((c) => c.id === "A.3.3");
    const a103 = report.annexAControls.find((c) => c.id === "A.10.3");
    const a22 = report.annexAControls.find((c) => c.id === "A.2.2");
    expect(a33?.applicable).toBe(false);
    expect(a103?.applicable).toBe(false);
    expect(a22?.applicable).toBe(true);
  });
});

describe("buildIso42001 — Reporting window", () => {
  it("picks earliest and latest issuedAt", () => {
    const report = buildIso42001({
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

  it("falls back to generatedAt when receipts have no issuedAt", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [rec({ issuedAt: undefined as unknown as string })],
    });
    expect(report.reportingWindow.from).toBeTruthy();
    expect(report.reportingWindow.to).toBeTruthy();
  });
});

describe("buildIso42001 — operator-authored stubs", () => {
  it("leaves clauses 4/5/6 empty with schema hints", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [rec({})] });
    expect(report.clause4Context.status).toBe("operator-authored");
    expect(report.clause4Context.derived).toBe(false);
    expect(report.clause4Context.content).toBe("");
    expect(report.clause4Context.schemaHint).toContain("§ 4");

    expect(report.clause5Leadership.schemaHint).toContain("§ 5");
    expect(report.clause5Leadership.schemaHint).toContain("AI policy");

    expect(report.clause6Planning.schemaHint).toContain("§ 6");
    expect(report.clause6Planning.schemaHint).toContain(
      "statement of applicability",
    );
  });
});

describe("buildIso42001 — empty receipt set", () => {
  it("does not crash and returns sensible defaults", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [] });
    expect(report.reportingWindow.totalReceipts).toBe(0);
    expect(report.clause7Support.documentedInformationCount).toBe(0);
    expect(report.clause8Operation.verdictCounts.pass).toBe(0);
    expect(report.clause8Operation.blockRate).toBe(0);
    expect(report.clause9Performance.p50LatencyMs).toBeNull();
    expect(report.annexAControls.every((c) => c.evidenceCount === 0)).toBe(
      true,
    );
  });
});

describe("buildIso42001 — defensive", () => {
  it("does not throw on malformed receipt fields", () => {
    expect(() =>
      buildIso42001({
        scope: SCOPE,
        receipts: [
          rec({ pack: undefined as unknown as string }),
          rec({ agentSlug: undefined as unknown as string }),
          rec({ overall: "weird" as ReceiptRecord["overall"] }),
          rec({ totalMs: "NaN" as unknown as number }),
        ],
      }),
    ).not.toThrow();
  });
});

describe("toMarkdown", () => {
  it("emits every required section in order", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [rec({ overall: "pass" })],
      operatorActions: ["Action 1"],
    });
    const md = toMarkdown(report);
    expect(md).toContain("ISO/IEC 42001:2023");
    expect(md).toContain("Scope");
    expect(md).toContain("§ 4 Context");
    expect(md).toContain("§ 5 Leadership");
    expect(md).toContain("§ 6 Planning");
    expect(md).toContain("§ 7 Support");
    expect(md).toContain("§ 8 Operation");
    expect(md).toContain("§ 9 Performance evaluation");
    expect(md).toContain("§ 10 Improvement");
    expect(md).toContain("Annex A");
    expect(md).toContain("`A.2.2`");
    expect(md).toContain("Provenance");
    // Section order check: clause 4 must appear before clause 10.
    expect(md.indexOf("§ 4 Context")).toBeLessThan(
      md.indexOf("§ 10 Improvement"),
    );
  });

  it("marks operator-authored sections with OPERATOR-AUTHORED tag", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [] });
    const md = toMarkdown(report);
    const matches = md.match(/\*\*OPERATOR-AUTHORED\*\*/g);
    expect(matches).toBeTruthy();
    // 1 mention in the intro paragraph + 3 clause headers (4, 5, 6).
    expect(matches!.length).toBe(4);
  });
});

describe("toJSON", () => {
  it("produces parseable JSON that round-trips", () => {
    const report = buildIso42001({
      scope: SCOPE,
      receipts: [rec({ overall: "pass" })],
    });
    const json = toJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("vaos-iso-42001-v1");
    expect(parsed.scope.organizationName).toBe(SCOPE.organizationName);
    expect(parsed.annexAControls.length).toBe(38);
  });

  it("emits stable schema identifier", () => {
    const report = buildIso42001({ scope: SCOPE, receipts: [] });
    expect(report.schema).toBe("vaos-iso-42001-v1");
  });
});
