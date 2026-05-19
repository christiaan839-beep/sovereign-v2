/**
 * @sovereign-matrix/annex-iv tests.
 *
 * Covers:
 *   - buildAnnexIv populates §3/§4/§6/§9 from receipts; leaves
 *     §1/§2/§5/§7/§8 as operator-authored stubs
 *   - verdictCounts + blockRate + warnRate arithmetic
 *   - reportingWindow first/last timestamp from receipts
 *   - sampleBlockedReceipts respects the cap
 *   - performanceMetrics p50/p99 latency from receipts
 *   - consistencyIndicator counts only receipts that carry the field
 *   - lifecycleChanges counts distinct agents + packs
 *   - postMarketMonitoring counts anomaly receipts
 *   - toMarkdown produces a stable structure (every required section)
 *   - toJSON produces valid JSON parseable back to the same shape
 *   - Empty receipt set produces a stub-only report without crashing
 *   - Defensive: malformed receipt fields don't throw
 */
import { describe, it, expect } from "vitest";
import {
  buildAnnexIv,
  toMarkdown,
  toJSON,
  type SystemDescription,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const SYSTEM: SystemDescription = {
  name: "Acme Loan Underwriting AI",
  identifier: "acme-loan-2026",
  riskCategory: "high-risk",
  provider: "Acme Financial AI Ltd",
  authorisedRepresentativeEU: "Acme EU GmbH",
  intendedPurpose:
    "Automated decisioning for consumer loan applications EUR 1k-50k.",
  annexIIIUseCase: "creditworthiness assessment",
  placedOnMarketAt: "2026-01-15T00:00:00Z",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: new Date().toISOString(),
    agentSlug: "loan-underwriter",
    pack: "cfpb-2026",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildAnnexIv — §3 monitoring section", () => {
  it("counts pass/warn/block verdicts and computes rates", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [
        rec({ overall: "pass" }),
        rec({ overall: "pass" }),
        rec({ overall: "warn" }),
        rec({ overall: "block" }),
        rec({ overall: "block" }),
      ],
    });
    expect(report.monitoringFunctioning.verdictCounts.pass).toBe(2);
    expect(report.monitoringFunctioning.verdictCounts.warn).toBe(1);
    expect(report.monitoringFunctioning.verdictCounts.block).toBe(2);
    expect(report.monitoringFunctioning.blockRate).toBe(0.4);
    expect(report.monitoringFunctioning.warnRate).toBe(0.2);
  });

  it("aggregates distinct agents and packs", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [
        rec({ agentSlug: "loan-underwriter", pack: "cfpb-2026" }),
        rec({ agentSlug: "loan-underwriter", pack: "euAiActPack" }),
        rec({ agentSlug: "credit-analyst", pack: "cfpb-2026" }),
      ],
    });
    expect(report.monitoringFunctioning.agentsObserved).toEqual([
      "credit-analyst",
      "loan-underwriter",
    ]);
    expect(report.monitoringFunctioning.packsExercised).toEqual([
      "cfpb-2026",
      "euAiActPack",
    ]);
  });

  it("respects sampleBlockedReceipts cap", () => {
    const blocks = Array.from({ length: 20 }, (_, i) =>
      rec({ overall: "block", verdictId: `block_${i}` }),
    );
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: blocks,
      sampleBlockedReceipts: 3,
    });
    expect(report.monitoringFunctioning.sampleBlockedReceipts.length).toBe(3);
  });
});

describe("buildAnnexIv — §4 performance metrics", () => {
  it("computes p50 and p99 latency from receipt.totalMs", () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: latencies.map((ms) =>
        rec({ totalMs: ms } as unknown as Partial<ReceiptRecord>),
      ),
    });
    // p50 → index 5 (0-indexed) of sorted = 60
    expect(report.performanceMetrics.p50LatencyMs).toBe(60);
    // p99 → index 9 of 10-element sorted = 100
    expect(report.performanceMetrics.p99LatencyMs).toBe(100);
  });

  it("returns null latency when no receipts have totalMs", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [rec({}), rec({})],
    });
    expect(report.performanceMetrics.p50LatencyMs).toBeNull();
    expect(report.performanceMetrics.p99LatencyMs).toBeNull();
  });

  it("counts only receipts with a `consistent` boolean for consistencyIndicator", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [
        rec({ consistent: true } as unknown as Partial<ReceiptRecord>),
        rec({ consistent: true } as unknown as Partial<ReceiptRecord>),
        rec({ consistent: false } as unknown as Partial<ReceiptRecord>),
        rec({}), // no `consistent` field — ignored
      ],
    });
    // 2 of 3 sampled = 0.6667
    expect(report.performanceMetrics.consistencyIndicator).toBeCloseTo(
      2 / 3,
      3,
    );
  });

  it("defaults consistencyIndicator to 1.0 when no receipt has the field", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [rec({}), rec({})],
    });
    expect(report.performanceMetrics.consistencyIndicator).toBe(1.0);
  });
});

describe("buildAnnexIv — §6 lifecycle changes", () => {
  it("records first + latest receipt timestamps and distinct counts", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [
        rec({
          issuedAt: "2026-01-15T00:00:00Z",
          agentSlug: "agent-a",
          pack: "hipaa",
        }),
        rec({
          issuedAt: "2026-03-15T00:00:00Z",
          agentSlug: "agent-b",
          pack: "cfpb",
        }),
        rec({
          issuedAt: "2026-05-15T00:00:00Z",
          agentSlug: "agent-a",
          pack: "hipaa",
        }),
      ],
    });
    expect(report.lifecycleChanges.firstReceiptAt).toBe("2026-01-15T00:00:00Z");
    expect(report.lifecycleChanges.latestReceiptAt).toBe(
      "2026-05-15T00:00:00Z",
    );
    expect(report.lifecycleChanges.distinctAgentsLaunched).toBe(2);
    expect(report.lifecycleChanges.distinctPacksAdopted).toBe(2);
  });
});

describe("buildAnnexIv — §9 post-market monitoring", () => {
  it("counts anomalies via the anomalyKind field", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [
        rec({}),
        rec({
          anomalyKind: "block-rate-spike",
        } as unknown as Partial<ReceiptRecord>),
        rec({
          anomalyKind: "quiet-period",
        } as unknown as Partial<ReceiptRecord>),
      ],
    });
    expect(report.postMarketMonitoring.anomaliesDetected).toBe(2);
    expect(report.postMarketMonitoring.receiptsAnchored).toBe(3);
  });

  it("surfaces operator actions and next-report-due date", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [rec({})],
      operatorActions: [
        "Tightened SR 11-7 model risk gate (2026-04-12).",
        "Rolled back v2.3 underwriter agent on EU traffic (2026-04-22).",
      ],
      nextReportDue: "2026-08-15T00:00:00Z",
    });
    expect(report.postMarketMonitoring.operatorActions).toEqual([
      "Tightened SR 11-7 model risk gate (2026-04-12).",
      "Rolled back v2.3 underwriter agent on EU traffic (2026-04-22).",
    ]);
    expect(report.postMarketMonitoring.nextReportDue).toBe(
      "2026-08-15T00:00:00Z",
    );
  });
});

describe("buildAnnexIv — operator-authored stubs", () => {
  it("emits all 5 operator-authored sections as empty stubs", () => {
    const report = buildAnnexIv({ system: SYSTEM, receipts: [rec({})] });
    expect(report.generalDescription.status).toBe("operator-authored");
    expect(report.generalDescription.content).toBe("");
    expect(report.developmentProcess.status).toBe("operator-authored");
    expect(report.riskManagementSystem.status).toBe("operator-authored");
    expect(report.harmonisedStandards.status).toBe("operator-authored");
    expect(report.conformityDeclaration.status).toBe("operator-authored");
  });

  it("emits schemaHint strings citing the regulation", () => {
    const report = buildAnnexIv({ system: SYSTEM, receipts: [rec({})] });
    expect(report.generalDescription.schemaHint).toMatch(/Article 11/);
    expect(report.riskManagementSystem.schemaHint).toMatch(/Article 9/);
    expect(report.conformityDeclaration.schemaHint).toMatch(/Article 47/);
  });
});

describe("buildAnnexIv — empty + defensive", () => {
  it("produces a valid report from an empty receipt set", () => {
    const report = buildAnnexIv({ system: SYSTEM, receipts: [] });
    expect(report.reportingWindow.totalReceipts).toBe(0);
    expect(report.monitoringFunctioning.verdictCounts.pass).toBe(0);
    expect(report.monitoringFunctioning.blockRate).toBe(0);
    expect(report.lifecycleChanges.firstReceiptAt).toBeNull();
    expect(report.lifecycleChanges.distinctAgentsLaunched).toBe(0);
  });

  it("does not mutate the input receipt array", () => {
    const receipts = [rec({}), rec({})];
    const before = JSON.stringify(receipts);
    buildAnnexIv({ system: SYSTEM, receipts });
    expect(JSON.stringify(receipts)).toBe(before);
  });
});

describe("toMarkdown — output structure", () => {
  it("emits every Annex IV section header", () => {
    const md = toMarkdown(
      buildAnnexIv({ system: SYSTEM, receipts: [rec({})] }),
    );
    expect(md).toContain("§1 General description");
    expect(md).toContain("§2 Development process");
    expect(md).toContain("§3 Monitoring, functioning and control");
    expect(md).toContain("§4 Performance metrics");
    expect(md).toContain("§5 Risk management system");
    expect(md).toContain("§6 Lifecycle changes");
    expect(md).toContain("§7 Harmonised standards");
    expect(md).toContain("§8 EU declaration of conformity");
    expect(md).toContain("§9 Post-market monitoring");
  });

  it("flags operator-authored sections in the Markdown output", () => {
    const md = toMarkdown(
      buildAnnexIv({ system: SYSTEM, receipts: [rec({})] }),
    );
    expect(md).toContain("**OPERATOR-AUTHORED**");
  });

  it("references @sovereign-matrix/annex-iv in the provenance section", () => {
    const md = toMarkdown(
      buildAnnexIv({ system: SYSTEM, receipts: [rec({})] }),
    );
    expect(md).toContain("@sovereign-matrix/annex-iv");
    expect(md).toContain("Apache-2.0");
  });

  it("includes system metadata in the output", () => {
    const md = toMarkdown(
      buildAnnexIv({ system: SYSTEM, receipts: [rec({})] }),
    );
    expect(md).toContain("Acme Loan Underwriting AI");
    expect(md).toContain("high-risk");
    expect(md).toContain("creditworthiness assessment");
  });
});

describe("toJSON — machine-readable serialization", () => {
  it("emits valid JSON parseable back to the same shape", () => {
    const report = buildAnnexIv({
      system: SYSTEM,
      receipts: [rec({ overall: "pass" }), rec({ overall: "block" })],
    });
    const json = toJSON(report);
    const roundTripped = JSON.parse(json);
    expect(roundTripped.schema).toBe("vaos-annex-iv-v1");
    expect(roundTripped.monitoringFunctioning.verdictCounts.pass).toBe(1);
    expect(roundTripped.monitoringFunctioning.verdictCounts.block).toBe(1);
  });

  it("carries the schema-version tag for procurement-tool consumers", () => {
    const report = buildAnnexIv({ system: SYSTEM, receipts: [] });
    expect(toJSON(report)).toMatch(/"schema": "vaos-annex-iv-v1"/);
  });
});
