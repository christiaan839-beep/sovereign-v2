/**
 * dashboard-empty-states — pure predicates for "no data" detection
 * across the analytics, scheduled, and reports pages.
 *
 * Each helper returns a boolean. They exist as a separate module so the
 * logic can be unit-tested without a DOM, and the dashboard pages stay
 * surgical — one `isAnalyticsEmpty({...})` call replaces scattered
 * inline checks.
 *
 * Constraints:
 *  - Functions must be pure (no I/O, no React).
 *  - `undefined`/`null` inputs collapse to the "empty" answer so call sites
 *    can pass freshly-fetched state without pre-guarding.
 */

/* ─── Analytics ─── */

export interface AnalyticsEmptyInput {
  agentExecutions?: number | null;
  playbookRuns?: number | null;
}

/**
 * Analytics is empty when the user has not yet triggered any agent
 * executions AND has not run any playbooks. Both counts are the
 * observable signals the dashboard surfaces.
 */
export function isAnalyticsEmpty(input: AnalyticsEmptyInput): boolean {
  const execs = input.agentExecutions ?? 0;
  const runs = input.playbookRuns ?? 0;
  return execs <= 0 && runs <= 0;
}

/* ─── Scheduled ─── */

export interface ScheduledEmptyInput {
  scheduleCount?: number | null;
}

/**
 * Scheduled is empty when there are zero schedules defined.
 */
export function isScheduledEmpty(input: ScheduledEmptyInput): boolean {
  const n = input.scheduleCount ?? 0;
  return n <= 0;
}

/* ─── Reports ─── */

export interface ReportsEmptyInput {
  /** Total completed playbook runs on record. */
  playbookRuns?: number | null;
  /** Reports already generated in this session. */
  generatedReportCount?: number | null;
}

/** Threshold at which reports stop showing the "warm-up" empty state. */
export const REPORTS_MIN_RUNS = 5;

/**
 * Reports page shows a warm-up empty state until the account has at
 * least REPORTS_MIN_RUNS playbook runs AND has not generated any
 * reports yet in the current session.
 */
export function isReportsEmpty(input: ReportsEmptyInput): boolean {
  const runs = input.playbookRuns ?? 0;
  const generated = input.generatedReportCount ?? 0;
  return generated <= 0 && runs < REPORTS_MIN_RUNS;
}
