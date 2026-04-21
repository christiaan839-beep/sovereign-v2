import { describe, it, expect } from "vitest";
import {
  validateCron,
  computeNextRun,
  CronValidationError,
  FAILURE_AUTOPAUSE_THRESHOLD,
} from "@/lib/scheduled-playbooks";

// Only pure functions are tested here — DB-touching methods (create,
// listDueNow, markDispatched) are covered by the dispatcher integration
// test which mocks Drizzle directly.

describe("validateCron", () => {
  it("accepts standard 5-field expressions", () => {
    expect(() => validateCron("0 9 * * 1")).not.toThrow();         // Mon 9am
    expect(() => validateCron("*/5 * * * *")).not.toThrow();       // every 5 min
    expect(() => validateCron("0 0 1 * *")).not.toThrow();         // 1st of month
    expect(() => validateCron("30 14 * * 1-5")).not.toThrow();     // weekdays 2:30pm
  });

  it("throws CronValidationError on garbage", () => {
    expect(() => validateCron("not a cron")).toThrow(CronValidationError);
    expect(() => validateCron("60 * * * *")).toThrow(CronValidationError); // minute 60 invalid
    expect(() => validateCron("")).toThrow(CronValidationError);
  });

  it("error message includes the bad expression", () => {
    try {
      validateCron("25 25 25 25 25");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CronValidationError);
      expect((err as Error).message).toContain("25 25 25 25 25");
    }
  });
});

describe("computeNextRun", () => {
  it("produces a future Date", () => {
    const now = new Date("2026-04-21T10:00:00Z");
    const next = computeNextRun("0 9 * * 1", "UTC", now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("is deterministic given the same inputs", () => {
    const from = new Date("2026-04-21T10:00:00Z");
    const a = computeNextRun("*/15 * * * *", "UTC", from);
    const b = computeNextRun("*/15 * * * *", "UTC", from);
    expect(a.toISOString()).toBe(b.toISOString());
  });

  it("handles IANA timezones (returns UTC Date)", () => {
    const from = new Date("2026-04-21T10:00:00Z"); // 6am EDT
    // "0 9 * * *" in NY = 9am EDT = 13:00 UTC
    const next = computeNextRun("0 9 * * *", "America/New_York", from);
    expect(next.getUTCHours()).toBe(13);
  });

  it("skips to the next interval when current time matches", () => {
    // Every minute, called at exactly XX:00:00 — should return XX+1:00, not XX:00
    const from = new Date("2026-04-21T10:00:00Z");
    const next = computeNextRun("* * * * *", "UTC", from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("FAILURE_AUTOPAUSE_THRESHOLD", () => {
  it("is 5 — prevents runaway spending on broken schedules", () => {
    expect(FAILURE_AUTOPAUSE_THRESHOLD).toBe(5);
  });
});
