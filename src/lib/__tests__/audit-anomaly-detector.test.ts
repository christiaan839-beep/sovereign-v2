/**
 * audit-anomaly-detector (R57) — tests.
 *
 * Pure-function statistical detector. Same inputs → same findings.
 *
 * Covers:
 *   - Rate spike: z-score above threshold → warning; >= 2x threshold → critical
 *   - Rate spike: constant-baseline edge case (stdDev=0)
 *   - Rate drop: z-score below -threshold → warning
 *   - Rate drop: zero recent count + nonzero baseline → warning even when stdDev=0
 *   - Insufficient baseline samples are NOT flagged (avoid false positives)
 *   - Denial-rate jump: +20pp = warning, +40pp = critical
 *   - Denial rate small sample (n<5) is skipped
 *   - Chain integrity break is ALWAYS critical
 *   - Signature failure rate spike → warning/critical
 *   - Novel actor → info (not warning, not critical)
 *   - Sorting: critical → warning → info
 *   - deriveAuditChainIntactFromFindings: null / true / false
 *   - classifyOverallAnomalyState: clean / info / warning / critical
 */

import { describe, it, expect } from "vitest";
import {
  detectAnomalies,
  deriveAuditChainIntactFromFindings,
  classifyOverallAnomalyState,
  type DetectionInput,
  type AuditEventCount,
} from "../anomaly/audit-anomaly-detector";

const baseInput = (overrides: Partial<DetectionInput> = {}): DetectionInput => ({
  events: [],
  denialRates: [],
  chainIntegrity: null,
  signatureFailures: null,
  novelActors: [],
  ...overrides,
});

const ev = (overrides: Partial<AuditEventCount> = {}): AuditEventCount => ({
  agent: "agent-foo",
  action: "agent.execute",
  tenant: "tenant-x",
  recentCount: 10,
  baselineMean: 10,
  baselineStdDev: 2,
  baselineWindowCount: 7,
  ...overrides,
});

describe("detectAnomalies — rate spikes (z-score)", () => {
  it("normal traffic (z<3) produces no finding", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [ev({ recentCount: 14, baselineMean: 10, baselineStdDev: 2 })],
      }),
    );
    expect(findings).toEqual([]);
  });

  it("spike above z=3 → warning", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [ev({ recentCount: 18, baselineMean: 10, baselineStdDev: 2 })], // z=4
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("rate_spike");
    expect(findings[0].severity).toBe("warning");
  });

  it("spike above z=6 (= 2× threshold) → critical", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [ev({ recentCount: 30, baselineMean: 10, baselineStdDev: 2 })], // z=10
      }),
    );
    expect(findings[0].severity).toBe("critical");
  });

  it("custom z-threshold of 2 catches smaller spikes", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [ev({ recentCount: 15, baselineMean: 10, baselineStdDev: 2 })], // z=2.5
        zScoreThreshold: 2,
      }),
    );
    expect(findings).toHaveLength(1);
  });

  it("insufficient baseline (windowCount < minBaselineSamples) is NOT flagged", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [
          ev({
            recentCount: 100,
            baselineMean: 10,
            baselineStdDev: 2,
            baselineWindowCount: 1,
          }),
        ],
        minBaselineSamples: 3,
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("detectAnomalies — constant-baseline edge case", () => {
  it("stdDev=0 + recent > baseline → spike", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [
          ev({ recentCount: 5, baselineMean: 0, baselineStdDev: 0 }),
        ],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("rate_spike");
  });

  it("stdDev=0 + recent=0 + baseline>0 → drop", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [
          ev({ recentCount: 0, baselineMean: 5, baselineStdDev: 0 }),
        ],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("rate_drop");
  });

  it("stdDev=0 + recent <= baseline + recent>0 → no finding (steady)", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [ev({ recentCount: 5, baselineMean: 5, baselineStdDev: 0 })],
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("detectAnomalies — rate drops", () => {
  it("z-score below -threshold → warning", () => {
    const findings = detectAnomalies(
      baseInput({
        events: [ev({ recentCount: 0, baselineMean: 10, baselineStdDev: 2 })], // z=-5
      }),
    );
    expect(findings[0].kind).toBe("rate_drop");
  });
});

describe("detectAnomalies — denial rate jumps", () => {
  it("+20pp jump → warning", () => {
    const findings = detectAnomalies(
      baseInput({
        denialRates: [
          {
            agent: "x",
            tenant: "t",
            recentDenialRate: 0.30,
            baselineDenialRate: 0.10,
            recentSampleSize: 50,
          },
        ],
      }),
    );
    expect(findings[0].kind).toBe("denial_rate_spike");
    expect(findings[0].severity).toBe("warning");
  });

  it("+40pp jump → critical", () => {
    const findings = detectAnomalies(
      baseInput({
        denialRates: [
          {
            agent: "x",
            tenant: "t",
            recentDenialRate: 0.50,
            baselineDenialRate: 0.05,
            recentSampleSize: 50,
          },
        ],
      }),
    );
    expect(findings[0].severity).toBe("critical");
  });

  it("small sample (n<5) is skipped", () => {
    const findings = detectAnomalies(
      baseInput({
        denialRates: [
          {
            agent: "x",
            tenant: "t",
            recentDenialRate: 0.90,
            baselineDenialRate: 0.05,
            recentSampleSize: 3,
          },
        ],
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("detectAnomalies — chain integrity break is always critical", () => {
  it("intact=false → critical chain_integrity_break", () => {
    const findings = detectAnomalies(
      baseInput({
        chainIntegrity: {
          intact: false,
          firstBrokenId: "row-42",
          totalRows: 1000,
        },
      }),
    );
    expect(findings[0].kind).toBe("chain_integrity_break");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].details.firstBrokenId).toBe("row-42");
  });

  it("intact=true → no chain finding", () => {
    const findings = detectAnomalies(
      baseInput({
        chainIntegrity: { intact: true, firstBrokenId: null, totalRows: 1000 },
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("detectAnomalies — signature-failure spike", () => {
  it("+10pp signature-fail jump → warning", () => {
    const findings = detectAnomalies(
      baseInput({
        signatureFailures: {
          recentFailures: 12,
          recentTotal: 100,
          baselineFailureRate: 0.02,
        },
      }),
    );
    expect(findings[0].kind).toBe("signature_failure_spike");
    expect(findings[0].severity).toBe("warning");
  });

  it("+25pp signature-fail jump → critical (key compromise pattern)", () => {
    const findings = detectAnomalies(
      baseInput({
        signatureFailures: {
          recentFailures: 27,
          recentTotal: 100,
          baselineFailureRate: 0.02,
        },
      }),
    );
    expect(findings[0].severity).toBe("critical");
  });

  it("+5% jump above 2% baseline → no finding (under threshold)", () => {
    const findings = detectAnomalies(
      baseInput({
        signatureFailures: {
          recentFailures: 6,
          recentTotal: 100,
          baselineFailureRate: 0.02,
        },
      }),
    );
    // 6/100 - 0.02 = 0.04 (4pp), below the 0.05 threshold.
    expect(findings).toEqual([]);
  });
});

describe("detectAnomalies — novel actors are info, not warning", () => {
  it("novel actor produces info severity", () => {
    const findings = detectAnomalies(
      baseInput({
        novelActors: [
          {
            agent: "new-agent",
            action: "agent.execute",
            tenant: "t",
            isNovel: true,
          },
        ],
      }),
    );
    expect(findings[0].kind).toBe("novel_actor");
    expect(findings[0].severity).toBe("info");
  });

  it("non-novel actor (isNovel=false) produces no finding", () => {
    const findings = detectAnomalies(
      baseInput({
        novelActors: [
          {
            agent: "x",
            action: "y",
            tenant: "t",
            isNovel: false,
          },
        ],
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("detectAnomalies — sorting (critical → warning → info)", () => {
  it("returns findings sorted by severity descending", () => {
    const findings = detectAnomalies(
      baseInput({
        novelActors: [
          { agent: "a", action: "x", tenant: "t", isNovel: true }, // info
        ],
        events: [
          ev({ recentCount: 30, baselineMean: 10, baselineStdDev: 2 }), // critical (z=10)
        ],
        denialRates: [
          {
            agent: "y",
            tenant: "t",
            recentDenialRate: 0.30,
            baselineDenialRate: 0.10,
            recentSampleSize: 50,
          }, // warning
        ],
      }),
    );
    expect(findings.map((f) => f.severity)).toEqual([
      "critical",
      "warning",
      "info",
    ]);
  });
});

describe("deriveAuditChainIntactFromFindings", () => {
  it("null snapshot → null (honest unknown)", () => {
    expect(deriveAuditChainIntactFromFindings(null)).toBe(null);
  });

  it("intact=true → true", () => {
    expect(
      deriveAuditChainIntactFromFindings({
        intact: true,
        firstBrokenId: null,
        totalRows: 100,
      }),
    ).toBe(true);
  });

  it("intact=false → false", () => {
    expect(
      deriveAuditChainIntactFromFindings({
        intact: false,
        firstBrokenId: "x",
        totalRows: 100,
      }),
    ).toBe(false);
  });
});

describe("classifyOverallAnomalyState", () => {
  it("empty findings → clean", () => {
    expect(classifyOverallAnomalyState([])).toBe("clean");
  });

  it("only info findings → info", () => {
    expect(
      classifyOverallAnomalyState([
        {
          kind: "novel_actor",
          severity: "info",
          message: "x",
          details: {},
        },
      ]),
    ).toBe("info");
  });

  it("any warning + no critical → warning", () => {
    expect(
      classifyOverallAnomalyState([
        { kind: "novel_actor", severity: "info", message: "x", details: {} },
        { kind: "rate_spike", severity: "warning", message: "y", details: {} },
      ]),
    ).toBe("warning");
  });

  it("any critical → critical (regardless of others)", () => {
    expect(
      classifyOverallAnomalyState([
        { kind: "novel_actor", severity: "info", message: "x", details: {} },
        { kind: "rate_spike", severity: "warning", message: "y", details: {} },
        {
          kind: "chain_integrity_break",
          severity: "critical",
          message: "z",
          details: {},
        },
      ]),
    ).toBe("critical");
  });
});
