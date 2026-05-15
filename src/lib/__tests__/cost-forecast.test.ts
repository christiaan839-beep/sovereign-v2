/**
 * Tests for src/lib/cost-forecast.ts — Cook 124.
 */

import { describe, it, expect } from "vitest";
import { forecast, recommendUpgrade, type DailyCost } from "../cost-forecast";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-05-15T12:00:00Z"); // day 15 of 31-day May

function days(values: number[]): DailyCost[] {
  return values.map((cents, i) => ({
    dayStartMs: NOW - (values.length - 1 - i) * DAY,
    cents,
  }));
}

describe("forecast — sufficiency", () => {
  it("returns sufficient=false on empty input", () => {
    const r = forecast([], {}, NOW);
    expect(r.sufficient).toBe(false);
    expect(r.monthEndCents).toBe(0);
  });

  it("returns sufficient=false on < 3 samples", () => {
    const r = forecast(days([100, 100]), {}, NOW);
    expect(r.sufficient).toBe(false);
  });

  it("returns sufficient=true with ≥ 3 samples", () => {
    const r = forecast(days([100, 110, 120]), {}, NOW);
    expect(r.sufficient).toBe(true);
  });
});

describe("forecast — stable baseline", () => {
  it("projects ~mean × remaining-days for a flat series", () => {
    const r = forecast(days([100, 100, 100, 100, 100, 100, 100]), {}, NOW);
    // 7 samples × 100 = 700 so far; remaining = 31 - 15 = 16 days × 100 = 1600
    expect(r.monthEndCents).toBeGreaterThan(2000);
    expect(r.monthEndCents).toBeLessThan(2500);
  });
});

describe("forecast — rising trend", () => {
  it("projects higher than flat-baseline for a rising series", () => {
    const flat = forecast(days([100, 100, 100, 100, 100]), {}, NOW);
    const rising = forecast(days([100, 110, 120, 130, 140]), {}, NOW);
    expect(rising.monthEndCents).toBeGreaterThan(flat.monthEndCents);
    expect(rising.trend).toBeGreaterThan(0);
  });
});

describe("forecast — falling trend", () => {
  it("projects lower than flat-baseline for a falling series", () => {
    const flat = forecast(days([200, 200, 200, 200, 200]), {}, NOW);
    const falling = forecast(days([200, 180, 160, 140, 120]), {}, NOW);
    expect(falling.monthEndCents).toBeLessThan(flat.monthEndCents);
    expect(falling.trend).toBeLessThan(0);
  });
});

describe("recommendUpgrade", () => {
  it("does NOT recommend when projection is under cap", () => {
    const r = recommendUpgrade(
      {
        level: 100,
        trend: 0,
        monthEndCents: 1000,
        sufficient: true,
        daysRemaining: 5,
      },
      5000,
    );
    expect(r.recommend).toBe(false);
    expect(r.severity).toBe("none");
  });

  it("low severity when 1.0-1.1× cap", () => {
    const r = recommendUpgrade(
      {
        level: 100,
        trend: 0,
        monthEndCents: 5100,
        sufficient: true,
        daysRemaining: 1,
      },
      5000,
    );
    expect(r.recommend).toBe(true);
    expect(r.severity).toBe("low");
    expect(r.projectedOverageCents).toBe(100);
  });

  it("high severity when 1.1-1.5× cap", () => {
    const r = recommendUpgrade(
      {
        level: 100,
        trend: 0,
        monthEndCents: 6000,
        sufficient: true,
        daysRemaining: 1,
      },
      5000,
    );
    expect(r.severity).toBe("high");
  });

  it("critical severity when > 1.5× cap", () => {
    const r = recommendUpgrade(
      {
        level: 100,
        trend: 0,
        monthEndCents: 10000,
        sufficient: true,
        daysRemaining: 1,
      },
      5000,
    );
    expect(r.severity).toBe("critical");
  });

  it("returns none when monthlyCapCents <= 0", () => {
    const r = recommendUpgrade(
      {
        level: 100,
        trend: 0,
        monthEndCents: 1_000_000,
        sufficient: true,
        daysRemaining: 1,
      },
      0,
    );
    expect(r.recommend).toBe(false);
  });
});
