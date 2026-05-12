/**
 * Tests for src/lib/scheduling.ts — Cook 46 cron primitive.
 *
 *   - parseCron: accepts *, exact, range, step, comma list; throws on
 *     malformed input.
 *   - nextFireAt: returns the next minute that matches; respects UTC;
 *     handles dom OR dow per cron tradition; obeys lookahead horizon.
 */

import { describe, it, expect } from "vitest";
import { parseCron, nextFireAt } from "../scheduling";

describe("parseCron", () => {
  it("parses '* * * * *' as every-minute", () => {
    const s = parseCron("* * * * *");
    expect(s.minute.size).toBe(60);
    expect(s.hour.size).toBe(24);
    expect(s.dom.size).toBe(31);
    expect(s.month.size).toBe(12);
    expect(s.dow.size).toBe(7);
    expect(s.domStar).toBe(true);
    expect(s.dowStar).toBe(true);
  });

  it("parses exact values, ranges, and steps", () => {
    const s = parseCron("0 9 1-7 * 1-5");
    expect([...s.minute]).toEqual([0]);
    expect([...s.hour]).toEqual([9]);
    expect([...s.dom]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...s.dow]).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses comma-separated lists", () => {
    const s = parseCron("0,15,30,45 * * * *");
    expect([...s.minute]).toEqual([0, 15, 30, 45]);
  });

  it("parses '*/5' as every-fifth", () => {
    const s = parseCron("*/5 * * * *");
    expect([...s.minute]).toEqual([
      0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
    ]);
  });

  it("throws on the wrong number of fields", () => {
    expect(() => parseCron("0 0 0")).toThrow();
  });

  it("throws on out-of-range values", () => {
    expect(() => parseCron("60 * * * *")).toThrow();
    expect(() => parseCron("0 24 * * *")).toThrow();
    expect(() => parseCron("0 0 32 * *")).toThrow();
  });
});

describe("nextFireAt", () => {
  it("fires next minute for every-minute spec", () => {
    const spec = parseCron("* * * * *");
    const from = new Date("2026-05-12T10:00:30Z");
    const next = nextFireAt(spec, from)!;
    expect(next.toISOString()).toBe("2026-05-12T10:01:00.000Z");
  });

  it("fires every Monday at 09:00 UTC", () => {
    const spec = parseCron("0 9 * * 1");
    // 2026-05-12 is a Tuesday; next Monday is 2026-05-18.
    const from = new Date("2026-05-12T00:00:00Z");
    const next = nextFireAt(spec, from)!;
    expect(next.toISOString()).toBe("2026-05-18T09:00:00.000Z");
  });

  it("fires every-15-minutes on the same day", () => {
    const spec = parseCron("*/15 * * * *");
    const from = new Date("2026-05-12T10:00:01Z");
    const next = nextFireAt(spec, from)!;
    expect(next.toISOString()).toBe("2026-05-12T10:15:00.000Z");
  });

  it("treats dom AND dow restrictions as OR (cron tradition)", () => {
    // "Run on the 1st of the month OR every Friday."
    const spec = parseCron("0 0 1 * 5");
    // 2026-05-02 is a Saturday; next match: 2026-05-08 (Friday).
    const from = new Date("2026-05-02T00:00:00Z");
    const next = nextFireAt(spec, from)!;
    expect(next.toISOString()).toBe("2026-05-08T00:00:00.000Z");
  });

  it("returns null on unsatisfiable specs within the lookahead", () => {
    // Feb 30th never exists.
    const spec = parseCron("0 0 30 2 *");
    const from = new Date("2026-01-01T00:00:00Z");
    expect(nextFireAt(spec, from, { lookaheadDays: 365 })).toBeNull();
  });

  it("STRICTLY moves forward — calling nextFireAt twice yields a later time", () => {
    const spec = parseCron("* * * * *");
    const t1 = nextFireAt(spec, new Date("2026-05-12T10:00:00Z"))!;
    const t2 = nextFireAt(spec, t1)!;
    expect(t2.getTime()).toBeGreaterThan(t1.getTime());
  });
});
