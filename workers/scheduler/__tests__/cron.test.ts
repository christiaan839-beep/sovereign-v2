/**
 * Cron matcher tests.
 *
 * A wrong matcher does not crash — it silently skips a job, or fires one
 * twice. So these check behaviour over whole simulated days rather than
 * spot-checking a couple of timestamps, and they assert the exact firing
 * count for each of the ten real schedules.
 */
import { describe, it, expect } from "vitest";
import { compileCron, expandField, isDue, matches } from "../src/cron";
import { JOBS } from "../src/jobs";

/** Every minute of one UTC day, as Dates. */
function minutesOfDay(iso: string): Date[] {
  const base = new Date(`${iso}T00:00:00.000Z`).getTime();
  return Array.from({ length: 1440 }, (_, i) => new Date(base + i * 60_000));
}

function firesPerDay(expression: string, iso: string): number {
  const c = compileCron(expression);
  return minutesOfDay(iso).filter((d) => matches(c, d)).length;
}

describe("field expansion", () => {
  it("expands a wildcard to the full range", () => {
    expect(expandField("*", 0).size).toBe(60);
    expect(expandField("*", 1).size).toBe(24);
    expect(expandField("*", 4).size).toBe(7);
  });

  it("expands steps", () => {
    expect([...expandField("*/15", 0)]).toEqual([0, 15, 30, 45]);
    expect([...expandField("*/4", 0)].length).toBe(15);
  });

  it("expands ranges and lists", () => {
    expect([...expandField("1-5", 0)]).toEqual([1, 2, 3, 4, 5]);
    expect([...expandField("1,5,9", 0)]).toEqual([1, 5, 9]);
    expect([...expandField("0-10/5", 0)]).toEqual([0, 5, 10]);
  });

  it("treats N/step as an open-ended step from N", () => {
    // `5/15` is "from 5, every 15" — not the single value 5.
    expect([...expandField("5/15", 0)]).toEqual([5, 20, 35, 50]);
  });

  it("rejects malformed fields rather than matching nothing", () => {
    // A field nobody can parse is a job that silently never runs.
    expect(() => expandField("", 0)).toThrow();
    expect(() => expandField("abc", 0)).toThrow();
    expect(() => expandField("99", 0)).toThrow(RangeError);
    expect(() => expandField("5-1", 0)).toThrow(RangeError);
    expect(() => expandField("*/0", 0)).toThrow();
    expect(() => expandField("*/1/2", 0)).toThrow();
    expect(() => expandField("8", 4)).toThrow(RangeError); // no day 8
  });

  it("rejects an expression without exactly five fields", () => {
    expect(() => compileCron("* * * *")).toThrow(SyntaxError);
    expect(() => compileCron("* * * * * *")).toThrow(SyntaxError);
  });
});

describe("the day-of-month / day-of-week rule", () => {
  // The detail most implementations get wrong: when BOTH are restricted
  // they are OR'd, not AND'd.
  it("ORs them when both are restricted", () => {
    const e = "0 0 1 * 1"; // 1st of the month, AND every Monday
    expect(isDue(e, new Date("2026-04-01T00:00:00Z"))).toBe(true); // a Wednesday, but the 1st
    expect(isDue(e, new Date("2026-04-06T00:00:00Z"))).toBe(true); // a Monday, not the 1st
    expect(isDue(e, new Date("2026-04-07T00:00:00Z"))).toBe(false); // neither
  });

  it("uses only day-of-month when day-of-week is *", () => {
    expect(isDue("0 0 1 * *", new Date("2026-04-01T00:00:00Z"))).toBe(true);
    expect(isDue("0 0 1 * *", new Date("2026-04-06T00:00:00Z"))).toBe(false);
  });

  it("uses only day-of-week when day-of-month is *", () => {
    expect(isDue("0 0 * * 1", new Date("2026-04-06T00:00:00Z"))).toBe(true); // Monday
    expect(isDue("0 0 * * 1", new Date("2026-04-07T00:00:00Z"))).toBe(false);
  });

  it("numbers Sunday as 0, matching vercel.json and standard cron", () => {
    // Cloudflare's own parser uses 1=Sunday. Getting this backwards
    // would move the weekly cleanup by a day, silently.
    expect(new Date("2026-04-05T03:00:00Z").getUTCDay()).toBe(0); // a Sunday
    expect(isDue("0 3 * * 0", new Date("2026-04-05T03:00:00Z"))).toBe(true);
    expect(isDue("0 3 * * 0", new Date("2026-04-06T03:00:00Z"))).toBe(false);
  });
});

describe("the ten real schedules", () => {
  const byPath = (p: string) => JOBS.find((j) => j.path === p)!.schedule;
  const WEDNESDAY = "2026-04-08"; // not the 1st, not a Sunday, not a Monday

  it.each([
    ["/api/cron/job-runner", 1440],
    ["/api/cron/playbook-scheduler", 288],
    ["/api/health/ping", 360],
    ["/api/cron/synthetic-probe", 288],
    ["/api/_cron/soc2-indicators", 96],
    ["/api/_cron/audit-bundles", 24],
    ["/api/cron/daily-digest", 1],
    ["/api/cron/audit-log-anchor", 1],
  ])("%s fires %i times on an ordinary day", (path, expected) => {
    expect(firesPerDay(byPath(path), WEDNESDAY)).toBe(expected);
  });

  it("weekly-report fires only on Mondays at 08:00", () => {
    expect(firesPerDay(byPath("/api/cron/weekly-report"), WEDNESDAY)).toBe(0);
    expect(firesPerDay(byPath("/api/cron/weekly-report"), "2026-04-06")).toBe(1); // Monday
    expect(isDue(byPath("/api/cron/weekly-report"), new Date("2026-04-06T08:00:00Z"))).toBe(true);
  });

  it("cleanup fires only on Sundays at 03:00", () => {
    expect(firesPerDay(byPath("/api/cron/cleanup"), WEDNESDAY)).toBe(0);
    expect(firesPerDay(byPath("/api/cron/cleanup"), "2026-04-05")).toBe(1); // Sunday
  });

  it("audit-log-anchor fires at 02:30, not 02:00", () => {
    expect(isDue(byPath("/api/cron/audit-log-anchor"), new Date("2026-04-08T02:30:00Z"))).toBe(true);
    expect(isDue(byPath("/api/cron/audit-log-anchor"), new Date("2026-04-08T02:00:00Z"))).toBe(false);
  });

  it("every schedule compiles", () => {
    for (const job of JOBS) {
      expect(() => compileCron(job.schedule), job.path).not.toThrow();
    }
  });

  it("every job fires at least once a week", () => {
    // Catches a schedule that parses but can never match.
    const week = ["2026-04-05", "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-11"];
    for (const job of JOBS) {
      const total = week.reduce((n, d) => n + firesPerDay(job.schedule, d), 0);
      expect(total, `${job.path} never fires`).toBeGreaterThan(0);
    }
  });
});

describe("matching is UTC", () => {
  it("ignores the host timezone", () => {
    // 07:00Z is the daily digest regardless of where this runs.
    expect(isDue("0 7 * * *", new Date("2026-04-08T07:00:00Z"))).toBe(true);
    expect(isDue("0 7 * * *", new Date("2026-04-08T09:00:00+02:00"))).toBe(true); // same instant
    expect(isDue("0 7 * * *", new Date("2026-04-08T07:00:00+02:00"))).toBe(false); // 05:00Z
  });
});
