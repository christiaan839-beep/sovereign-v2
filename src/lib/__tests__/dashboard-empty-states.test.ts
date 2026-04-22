/**
 * Tests for the pure empty-state predicates used by the Analytics,
 * Scheduled, and Reports dashboard pages. Each predicate is a plain
 * function of its inputs, so exhaustive boundary coverage is cheap.
 */

import { describe, expect, it } from "vitest";
import {
  REPORTS_MIN_RUNS,
  isAnalyticsEmpty,
  isReportsEmpty,
  isScheduledEmpty,
} from "@/lib/dashboard-empty-states";

describe("isAnalyticsEmpty", () => {
  it("is empty when both execs and runs are zero", () => {
    expect(isAnalyticsEmpty({ agentExecutions: 0, playbookRuns: 0 })).toBe(true);
  });

  it("is empty when values are missing", () => {
    expect(isAnalyticsEmpty({})).toBe(true);
    expect(isAnalyticsEmpty({ agentExecutions: null, playbookRuns: null })).toBe(true);
  });

  it("is not empty once executions start", () => {
    expect(isAnalyticsEmpty({ agentExecutions: 1, playbookRuns: 0 })).toBe(false);
  });

  it("is not empty once a playbook runs", () => {
    expect(isAnalyticsEmpty({ agentExecutions: 0, playbookRuns: 1 })).toBe(false);
  });

  it("ignores negative values (treats them as empty)", () => {
    expect(isAnalyticsEmpty({ agentExecutions: -3, playbookRuns: -1 })).toBe(true);
  });
});

describe("isScheduledEmpty", () => {
  it("is empty when no schedules exist", () => {
    expect(isScheduledEmpty({ scheduleCount: 0 })).toBe(true);
    expect(isScheduledEmpty({})).toBe(true);
  });

  it("is not empty when at least one schedule exists", () => {
    expect(isScheduledEmpty({ scheduleCount: 1 })).toBe(false);
    expect(isScheduledEmpty({ scheduleCount: 42 })).toBe(false);
  });
});

describe("isReportsEmpty", () => {
  it("is empty when no runs and no generated reports", () => {
    expect(isReportsEmpty({ playbookRuns: 0, generatedReportCount: 0 })).toBe(true);
  });

  it("is empty when below the threshold and no generated reports", () => {
    expect(
      isReportsEmpty({ playbookRuns: REPORTS_MIN_RUNS - 1, generatedReportCount: 0 }),
    ).toBe(true);
  });

  it("is not empty once the user generated at least one report", () => {
    expect(isReportsEmpty({ playbookRuns: 0, generatedReportCount: 1 })).toBe(false);
  });

  it("is not empty once runs reach the threshold", () => {
    expect(
      isReportsEmpty({ playbookRuns: REPORTS_MIN_RUNS, generatedReportCount: 0 }),
    ).toBe(false);
  });

  it("handles missing inputs as empty", () => {
    expect(isReportsEmpty({})).toBe(true);
  });
});
