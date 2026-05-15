/**
 * Tests for src/lib/cost-anomaly.ts — Cook 117.
 */

import { describe, it, expect } from "vitest";
import {
  detectAnomaly,
  detectFleetAnomalies,
  type CostSample,
} from "../cost-anomaly";

function samples(values: number[]): CostSample[] {
  return values.map((cents, i) => ({
    windowStartMs: i * 60_000,
    cents,
  }));
}

describe("detectAnomaly — empty input", () => {
  it("returns flagged=false with message", () => {
    const r = detectAnomaly([]);
    expect(r.flagged).toBe(false);
    expect(r.message).toContain("no samples");
  });
});

describe("detectAnomaly — insufficient baseline", () => {
  it("returns flagged=false until minSamples", () => {
    const r = detectAnomaly(samples([100, 100, 100]));
    expect(r.flagged).toBe(false);
    expect(r.message).toContain("insufficient");
  });
});

describe("detectAnomaly — stable baseline", () => {
  it("does NOT flag when latest is within band", () => {
    const r = detectAnomaly(samples([100, 100, 100, 100, 100, 100, 105]));
    expect(r.flagged).toBe(false);
  });
});

describe("detectAnomaly — spike", () => {
  it("flags when latest is 5σ above EWMA baseline", () => {
    const r = detectAnomaly(samples([100, 101, 99, 100, 102, 99, 5000]));
    expect(r.flagged).toBe(true);
    expect(r.zScore).toBeGreaterThan(3);
    expect(r.message).toContain("σ above baseline");
  });
});

describe("detectAnomaly — knob: sigmas", () => {
  it("higher sigma threshold suppresses moderate anomalies", () => {
    const series = samples([100, 100, 100, 100, 100, 100, 500]);
    expect(detectAnomaly(series, { sigmas: 3 }).flagged).toBe(true);
    expect(detectAnomaly(series, { sigmas: 100 }).flagged).toBe(false);
  });
});

describe("detectFleetAnomalies", () => {
  it("returns one detection per tenant", () => {
    const fleet = [
      { tenantId: "t1", samples: samples([100, 100, 100, 100, 100, 5000]) },
      { tenantId: "t2", samples: samples([50, 50, 50, 50, 50, 55]) },
    ];
    const results = detectFleetAnomalies(fleet);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.tenantId === "t1")?.detection.flagged).toBe(
      true,
    );
    expect(results.find((r) => r.tenantId === "t2")?.detection.flagged).toBe(
      false,
    );
  });
});
