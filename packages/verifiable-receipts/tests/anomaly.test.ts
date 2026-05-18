/**
 * Receipt anomaly detection tests.
 *
 * Covers every detector path:
 *   - block-rate spike (significant Z-score between window + baseline)
 *   - per-pack failure-rate drift
 *   - volume burst (throughput ratio ≥ 5×)
 *   - quiet period (gap > maxGapHours)
 *   - new agent appearance (window-only slug)
 *   - severity bucketing (critical / warn / info)
 *   - small-input guard (< 20 receipts → no anomalies)
 *   - empty input safety
 *   - read-only (no input mutation)
 */
import { describe, it, expect } from "vitest";
import { detectAnomalies } from "../src/anomaly.js";
import type { ReceiptRecord } from "../src/audit-dsl.js";

function baseline(
  n: number,
  startMs: number,
  intervalMs: number,
  verdict: "pass" | "warn" | "block" = "pass",
  agentSlug = "agent-a",
  pack = "pack-x",
): ReceiptRecord[] {
  const out: ReceiptRecord[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      verdictId: `v_${i}`,
      overall: verdict,
      issuedAt: new Date(startMs + i * intervalMs).toISOString(),
      agentSlug,
      pack,
    });
  }
  return out;
}

describe("detectAnomalies — input invariants", () => {
  it("returns empty report on empty input", () => {
    const r = detectAnomalies([]);
    expect(r.totalReceipts).toBe(0);
    expect(r.anomalies).toEqual([]);
    expect(r.baselineStats).toEqual({
      passRate: 0,
      warnRate: 0,
      blockRate: 0,
    });
  });

  it("returns empty anomalies for input < 20 receipts (small-sample guard)", () => {
    const tiny = baseline(15, Date.now(), 1000, "block");
    const r = detectAnomalies(tiny);
    expect(r.totalReceipts).toBe(15);
    expect(r.anomalies).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const receipts = baseline(50, Date.now(), 1000);
    const before = JSON.stringify(receipts);
    detectAnomalies(receipts);
    expect(JSON.stringify(receipts)).toBe(before);
  });

  it("emits ISO 8601 detectedAt", () => {
    const r = detectAnomalies(baseline(50, Date.now(), 1000));
    expect(r.detectedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
  });
});

describe("detectAnomalies — baseline stats", () => {
  it("computes accurate pass / warn / block rates", () => {
    const start = Date.now();
    const rs: ReceiptRecord[] = [
      ...baseline(60, start, 1000, "pass"),
      ...baseline(30, start + 60000, 1000, "warn", "agent-a", "pack-x"),
      ...baseline(10, start + 90000, 1000, "block", "agent-a", "pack-x"),
    ];
    const r = detectAnomalies(rs);
    expect(r.baselineStats.passRate).toBeCloseTo(0.6, 2);
    expect(r.baselineStats.warnRate).toBeCloseTo(0.3, 2);
    expect(r.baselineStats.blockRate).toBeCloseTo(0.1, 2);
  });
});

describe("detectAnomalies — block-rate spike", () => {
  it("flags critical when window block-rate is much higher than baseline", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    const passReceipts = baseline(180, start, 60000, "pass");
    const burstStart =
      Date.parse(passReceipts[passReceipts.length - 1].issuedAt) + 1000;
    const blockBurst = baseline(20, burstStart, 1000, "block");
    const r = detectAnomalies([...passReceipts, ...blockBurst]);
    const spike = r.anomalies.find((a) => a.kind === "block-rate-spike");
    expect(spike).toBeDefined();
    expect(spike?.severity).toBe("critical");
    expect(spike?.zScore).toBeGreaterThan(3.5);
  });

  it("does NOT flag when block-rate is uniformly low", () => {
    const allPass = baseline(200, Date.now() - 3600000, 5000, "pass");
    const r = detectAnomalies(allPass);
    expect(
      r.anomalies.find((a) => a.kind === "block-rate-spike"),
    ).toBeUndefined();
  });
});

describe("detectAnomalies — rule-failure drift per pack", () => {
  it("flags per-pack drift when one pack's failure-rate spikes", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    // Baseline: 180 passes across two packs
    const baselinePassesA = baseline(
      90,
      start,
      60000,
      "pass",
      "agent-a",
      "pack-a",
    );
    const baselinePassesB = baseline(
      90,
      start + 1,
      60000,
      "pass",
      "agent-b",
      "pack-b",
    );
    // Window: pack-a's failure rate jumps; pack-b stays clean
    const burstStart =
      Date.parse(baselinePassesA[baselinePassesA.length - 1].issuedAt) + 1000;
    const failingPackA = baseline(
      15,
      burstStart,
      1000,
      "block",
      "agent-a",
      "pack-a",
    );
    const cleanPackB = baseline(
      5,
      burstStart + 16000,
      1000,
      "pass",
      "agent-b",
      "pack-b",
    );
    const r = detectAnomalies([
      ...baselinePassesA,
      ...baselinePassesB,
      ...failingPackA,
      ...cleanPackB,
    ]);
    const drift = r.anomalies.find(
      (a) => a.kind === "rule-failure-drift" && a.affectedField === "pack-a",
    );
    expect(drift).toBeDefined();
    expect(drift?.zScore).toBeGreaterThan(2);
  });
});

describe("detectAnomalies — volume burst", () => {
  it("flags volume burst when window throughput is ≥ 5× baseline", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    // Baseline: 50 receipts spread across 6 hours (~ 1 every 7.2 min)
    const baselineReceipts = baseline(50, start, 7.2 * 60 * 1000, "pass");
    const burstStart =
      Date.parse(baselineReceipts[baselineReceipts.length - 1].issuedAt) + 1000;
    // Window: 50 receipts in 5 minutes (~ 1 every 6 sec, ~ 72× baseline rate)
    const burst = baseline(50, burstStart, 6 * 1000, "pass");
    const r = detectAnomalies([...baselineReceipts, ...burst]);
    const v = r.anomalies.find((a) => a.kind === "volume-burst");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("critical");
  });

  it("does NOT flag volume burst when throughput is uniform", () => {
    const r = detectAnomalies(
      baseline(100, Date.now() - 3600000, 36000, "pass"),
    );
    expect(r.anomalies.find((a) => a.kind === "volume-burst")).toBeUndefined();
  });
});

describe("detectAnomalies — quiet period", () => {
  it("flags warn when gap > maxGapHours", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    const first = baseline(15, start, 60000, "pass");
    const lastTs = Date.parse(first[first.length - 1].issuedAt);
    // Gap of 8 hours (default threshold is 6h)
    const second = baseline(15, lastTs + 8 * 3600 * 1000, 60000, "pass");
    const r = detectAnomalies([...first, ...second]);
    const q = r.anomalies.find((a) => a.kind === "quiet-period");
    expect(q).toBeDefined();
    expect(q?.severity).toBe("warn");
  });

  it("flags critical when gap > 4× maxGapHours", () => {
    const start = Date.now() - 4 * 24 * 3600 * 1000;
    const first = baseline(15, start, 60000, "pass");
    const lastTs = Date.parse(first[first.length - 1].issuedAt);
    // Gap of 30 hours (>= 4× the 6h default threshold)
    const second = baseline(15, lastTs + 30 * 3600 * 1000, 60000, "pass");
    const r = detectAnomalies([...first, ...second]);
    const q = r.anomalies.find((a) => a.kind === "quiet-period");
    expect(q).toBeDefined();
    expect(q?.severity).toBe("critical");
  });

  it("respects custom maxGapHours option", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    const first = baseline(15, start, 60000, "pass");
    const lastTs = Date.parse(first[first.length - 1].issuedAt);
    // 3-hour gap — below default but above custom 1h threshold
    const second = baseline(15, lastTs + 3 * 3600 * 1000, 60000, "pass");
    const r = detectAnomalies([...first, ...second], { maxGapHours: 1 });
    expect(r.anomalies.find((a) => a.kind === "quiet-period")).toBeDefined();
  });
});

describe("detectAnomalies — new agent appearance", () => {
  it("flags info severity when window has a never-before-seen agent", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    const baselineReceipts = baseline(180, start, 60000, "pass", "agent-known");
    const lastTs =
      Date.parse(baselineReceipts[baselineReceipts.length - 1].issuedAt) + 1000;
    const windowReceipts = baseline(20, lastTs, 1000, "pass", "agent-new");
    const r = detectAnomalies([...baselineReceipts, ...windowReceipts]);
    const newAgent = r.anomalies.find((a) => a.kind === "new-agent");
    expect(newAgent).toBeDefined();
    expect(newAgent?.severity).toBe("info");
    expect(newAgent?.affectedField).toBe("agent-new");
  });

  it("does NOT flag when agent has appeared in baseline", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    const r = detectAnomalies(baseline(200, start, 60000, "pass", "agent-x"));
    expect(r.anomalies.find((a) => a.kind === "new-agent")).toBeUndefined();
  });
});

describe("detectAnomalies — severity ordering + bucketing", () => {
  it("sorts anomalies critical → warn → info", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    // Compose a stream with critical block-rate spike + info new-agent
    const passReceipts = baseline(180, start, 60000, "pass", "agent-known");
    const burstStart =
      Date.parse(passReceipts[passReceipts.length - 1].issuedAt) + 1000;
    const blockBurst = baseline(20, burstStart, 1000, "block", "agent-new");
    const r = detectAnomalies([...passReceipts, ...blockBurst]);

    expect(r.anomalies.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < r.anomalies.length; i++) {
      const rank = { critical: 0, warn: 1, info: 2 } as const;
      expect(rank[r.anomalies[i].severity]).toBeGreaterThanOrEqual(
        rank[r.anomalies[i - 1].severity],
      );
    }
  });
});

describe("detectAnomalies — option overrides", () => {
  it("custom warnZ + criticalZ are honored when bucketing severities", () => {
    // Build a stream where the default thresholds bucket the spike as
    // critical (z >> 3.5). With criticalZ raised above the observed z,
    // the same spike must downgrade to warn.
    const start = Date.now() - 24 * 3600 * 1000;
    const passReceipts = baseline(180, start, 60000, "pass");
    const burstStart =
      Date.parse(passReceipts[passReceipts.length - 1].issuedAt) + 1000;
    const blockBurst = baseline(20, burstStart, 1000, "block");

    const defaultRun = detectAnomalies([...passReceipts, ...blockBurst]);
    const defaultSpike = defaultRun.anomalies.find(
      (a) => a.kind === "block-rate-spike",
    );
    expect(defaultSpike).toBeDefined();
    expect(defaultSpike?.severity).toBe("critical");

    const z = defaultSpike?.zScore ?? 0;
    const raisedRun = detectAnomalies([...passReceipts, ...blockBurst], {
      warnZ: 2,
      criticalZ: z + 100,
    });
    const raisedSpike = raisedRun.anomalies.find(
      (a) => a.kind === "block-rate-spike",
    );
    expect(raisedSpike).toBeDefined();
    expect(raisedSpike?.severity).toBe("warn");
  });

  it("custom windowSize uses the explicit value", () => {
    const start = Date.now() - 24 * 3600 * 1000;
    const r = detectAnomalies(baseline(200, start, 60000, "pass"), {
      windowSize: 30,
    });
    expect(r.windowSize).toBe(30);
  });
});
