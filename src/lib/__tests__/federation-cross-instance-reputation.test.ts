/**
 * federation/cross-instance-reputation (R50) — tests.
 *
 * Pure-function aggregator + verifier. Same trustless invariants as
 * R34/R37/R40/R42/R44 — aggregation is reproducible from the
 * per-instance reports, so an inspector can verify Sovereign isn't
 * fabricating a federated grade.
 *
 * Covers:
 *   - Empty reports → no_score_yet
 *   - All reports are no_score_yet → no_score_yet
 *   - Single report → federated == that report
 *   - WORST grade is selected (banking-grade conservatism)
 *   - Median is robust to a single outlier
 *   - "Concerning" list = anything C or worse
 *   - compareGrades orders correctly
 *   - Verifier catches grade fabrication, score fabrication, and
 *     instance-count fabrication
 *   - summarizeFederationCoverage produces sensible procurement text
 */

import { describe, it, expect } from "vitest";
import {
  aggregateFederatedReputation,
  verifyFederatedReputation,
  compareGrades,
  summarizeFederationCoverage,
  type InstanceReputationReport,
} from "../federation/cross-instance-reputation";

const NOW = new Date("2026-04-29T12:00:00.000Z");

const report = (
  url: string,
  grade: InstanceReputationReport["letterGrade"],
  score: number,
): InstanceReputationReport => ({
  deploymentUrl: url,
  agentId: "agent-foo",
  letterGrade: grade,
  numericScore: score,
  computedAt: "2026-04-29T05:00:00.000Z",
});

describe("compareGrades — ordering invariant", () => {
  it("F < D < C- < C < C+ < B- < B < B+ < A- < A < A+", () => {
    const ordered: InstanceReputationReport["letterGrade"][] = [
      "F",
      "D",
      "C-",
      "C",
      "C+",
      "B-",
      "B",
      "B+",
      "A-",
      "A",
      "A+",
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(compareGrades(ordered[i - 1], ordered[i])).toBeLessThan(0);
    }
  });

  it("no_score_yet ranks below F", () => {
    expect(compareGrades("no_score_yet", "F")).toBeLessThan(0);
  });
});

describe("aggregateFederatedReputation — math", () => {
  it("empty reports → no signal, no_score_yet", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [],
      now: NOW,
    });
    expect(fed.hasFederatedSignal).toBe(false);
    expect(fed.federatedLetterGrade).toBe("no_score_yet");
    expect(fed.instanceCount).toBe(0);
    expect(fed.noScoreInstanceCount).toBe(0);
  });

  it("all reports unscored → no signal but instances counted", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "no_score_yet", 0),
        report("https://b", "no_score_yet", 0),
      ],
      now: NOW,
    });
    expect(fed.hasFederatedSignal).toBe(false);
    expect(fed.instanceCount).toBe(0);
    expect(fed.noScoreInstanceCount).toBe(2);
  });

  it("single A+ report → federated A+ (single source of truth)", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [report("https://a", "A+", 98)],
      now: NOW,
    });
    expect(fed.federatedLetterGrade).toBe("A+");
    expect(fed.medianNumericScore).toBe(98);
    expect(fed.hasFederatedSignal).toBe(true);
  });

  it("3 A+ reports + 1 F report → federated F (worst-of conservatism)", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "A+", 95),
        report("https://b", "A+", 96),
        report("https://c", "A+", 97),
        report("https://d", "F", 30), // single bad-faith / breach instance
      ],
      now: NOW,
    });
    // Conservative: ANY F is federated F.
    expect(fed.federatedLetterGrade).toBe("F");
    // But median score reflects the dominance of the others.
    expect(fed.medianNumericScore).toBe(95.5);
    expect(fed.concerningInstances.length).toBe(1);
  });

  it("median is the middle of an odd-length sorted score list", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "B", 75),
        report("https://b", "B", 78),
        report("https://c", "B", 76),
      ],
      now: NOW,
    });
    expect(fed.medianNumericScore).toBe(76);
  });

  it("median is the average of the two middle values for an even-length list", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "A", 90),
        report("https://b", "A", 92),
        report("https://c", "B+", 80),
        report("https://d", "B+", 82),
      ],
      now: NOW,
    });
    // Sorted: 80, 82, 90, 92 → median = (82 + 90) / 2 = 86
    expect(fed.medianNumericScore).toBe(86);
  });

  it("concerning instances = anything C or worse", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "B", 75),
        report("https://b", "C+", 65), // not concerning (>= B-)... wait, C+ is below B-, so concerning
        report("https://c", "C", 60),
        report("https://d", "F", 30),
      ],
      now: NOW,
    });
    // C+, C, F are all "concerning" (below B-).
    expect(fed.concerningInstances.length).toBe(3);
    expect(fed.concerningInstances.map((r) => r.deploymentUrl)).toContain(
      "https://b",
    );
  });

  it("unscored reports don't pollute the worst-of calculation", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "no_score_yet", 0),
        report("https://b", "A", 90),
        report("https://c", "no_score_yet", 0),
      ],
      now: NOW,
    });
    expect(fed.federatedLetterGrade).toBe("A");
    expect(fed.instanceCount).toBe(1);
    expect(fed.noScoreInstanceCount).toBe(2);
  });
});

describe("verifyFederatedReputation — trustless invariant", () => {
  it("matches when published is honestly recomputed", () => {
    const reports = [
      report("https://a", "A+", 95),
      report("https://b", "B", 75),
      report("https://c", "B+", 82),
    ];
    const honest = aggregateFederatedReputation({
      agentId: "x",
      reports,
      now: NOW,
    });
    const result = verifyFederatedReputation({
      publishedFederation: honest,
      reports,
    });
    expect(result.valid).toBe(true);
  });

  it("catches grade fabrication (claim A when reports support B)", () => {
    const reports = [
      report("https://a", "B", 75),
      report("https://b", "B", 76),
    ];
    const honest = aggregateFederatedReputation({
      agentId: "x",
      reports,
      now: NOW,
    });
    const fabricated = { ...honest, federatedLetterGrade: "A" as const };
    const result = verifyFederatedReputation({
      publishedFederation: fabricated,
      reports,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("grade_mismatch");
    }
  });

  it("catches median-score fabrication", () => {
    const reports = [report("https://a", "B", 75)];
    const honest = aggregateFederatedReputation({
      agentId: "x",
      reports,
      now: NOW,
    });
    const fabricated = { ...honest, medianNumericScore: 99 };
    const result = verifyFederatedReputation({
      publishedFederation: fabricated,
      reports,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("score_mismatch");
    }
  });

  it("catches instance-count fabrication (claim more peers than reported)", () => {
    const reports = [report("https://a", "A", 90)];
    const honest = aggregateFederatedReputation({
      agentId: "x",
      reports,
      now: NOW,
    });
    const fabricated = { ...honest, instanceCount: 99 };
    const result = verifyFederatedReputation({
      publishedFederation: fabricated,
      reports,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("instance_count_mismatch");
    }
  });
});

describe("summarizeFederationCoverage — procurement-readable text", () => {
  it("produces 'no peers' message when truly empty", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [],
      now: NOW,
    });
    expect(summarizeFederationCoverage(fed)).toContain(
      "No federation peers",
    );
  });

  it("flags concerning instances in the summary", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "B", 75),
        report("https://b", "F", 30),
      ],
      now: NOW,
    });
    const summary = summarizeFederationCoverage(fed);
    expect(summary).toMatch(/concerning|F/);
    expect(summary).toContain("Federated grade (worst-of): F");
  });

  it("includes counts of responding vs no-data peers", () => {
    const fed = aggregateFederatedReputation({
      agentId: "x",
      reports: [
        report("https://a", "B", 75),
        report("https://b", "no_score_yet", 0),
        report("https://c", "no_score_yet", 0),
      ],
      now: NOW,
    });
    const summary = summarizeFederationCoverage(fed);
    expect(summary).toContain("1 of 3");
  });
});
