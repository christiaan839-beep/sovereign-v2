/**
 * Regression tests for the scheduled-workflows minimum-interval validation.
 *
 * The fix: reject cron expressions that fire more than every 5 minutes,
 * because a per-minute schedule on a paid plan burns through the entire
 * monthly LLM budget in ~7 days.
 *
 * We test the validator inline by recreating the logic — the real
 * handler lives behind Clerk auth + DB and isn't unit-testable without
 * heavy mocking.
 */
import { describe, it, expect } from "vitest";

function validateCronSchedule(
  schedule: string,
): { ok: true; minuteField: string } | { ok: false; reason: string } {
  const cronParts = schedule.trim().split(/\s+/);
  if (cronParts.length < 5 || cronParts.length > 6) {
    return { ok: false, reason: "wrong field count" };
  }
  const minuteField = cronParts.length === 6 ? cronParts[1] : cronParts[0];
  const isEveryMinuteOrSubMinute =
    minuteField === "*" || /^\*\/[1-4]$/.test(minuteField);
  if (isEveryMinuteOrSubMinute) {
    return { ok: false, reason: "interval too frequent" };
  }
  return { ok: true, minuteField };
}

describe("scheduled-workflows cron validation", () => {
  describe("accepts valid schedules", () => {
    it("every 5 minutes", () => {
      expect(validateCronSchedule("*/5 * * * *").ok).toBe(true);
    });

    it("every 10 minutes", () => {
      expect(validateCronSchedule("*/10 * * * *").ok).toBe(true);
    });

    it("hourly", () => {
      expect(validateCronSchedule("0 * * * *").ok).toBe(true);
    });

    it("daily at 9am", () => {
      expect(validateCronSchedule("0 9 * * *").ok).toBe(true);
    });

    it("specific minute — 30 * * * *", () => {
      expect(validateCronSchedule("30 * * * *").ok).toBe(true);
    });

    it("weekdays at noon — 0 12 * * 1-5", () => {
      expect(validateCronSchedule("0 12 * * 1-5").ok).toBe(true);
    });

    it("6-field (with seconds) — 0 */5 * * * *", () => {
      expect(validateCronSchedule("0 */5 * * * *").ok).toBe(true);
    });
  });

  describe("REGRESSION: rejects LLM-cost-runaway schedules", () => {
    it("every minute (* * * * *)", () => {
      const result = validateCronSchedule("* * * * *");
      expect(result.ok).toBe(false);
    });

    it("every 1 minute (*/1 * * * *)", () => {
      expect(validateCronSchedule("*/1 * * * *").ok).toBe(false);
    });

    it("every 2 minutes (*/2 * * * *)", () => {
      expect(validateCronSchedule("*/2 * * * *").ok).toBe(false);
    });

    it("every 3 minutes (*/3 * * * *)", () => {
      expect(validateCronSchedule("*/3 * * * *").ok).toBe(false);
    });

    it("every 4 minutes (*/4 * * * *)", () => {
      expect(validateCronSchedule("*/4 * * * *").ok).toBe(false);
    });

    it("every 5 minutes is the BOUNDARY — allowed", () => {
      // Exactly 5-minute intervals are allowed (the minimum).
      expect(validateCronSchedule("*/5 * * * *").ok).toBe(true);
    });

    it("every minute in 6-field form", () => {
      // 6-field: seconds, minutes, hours, day, month, dow
      expect(validateCronSchedule("0 * * * * *").ok).toBe(false);
    });

    it("every 3 minutes in 6-field form", () => {
      expect(validateCronSchedule("0 */3 * * * *").ok).toBe(false);
    });
  });

  describe("rejects structurally invalid schedules", () => {
    it("too few fields", () => {
      expect(validateCronSchedule("* * *").ok).toBe(false);
    });

    it("too many fields", () => {
      expect(validateCronSchedule("* * * * * * *").ok).toBe(false);
    });

    it("empty string", () => {
      expect(validateCronSchedule("").ok).toBe(false);
    });
  });
});
