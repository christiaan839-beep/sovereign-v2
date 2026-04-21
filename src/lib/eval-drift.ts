/**
 * EVAL DRIFT DETECTION — compares two consecutive eval_runs rows and
 * returns a structured drift report.
 *
 * Called from the run-evals cron after each run completes. When drift
 * is detected (pass_rate drops > 5pts, OR any eval flips from
 * passed→failed), the cron captures a Sentry warning with full context.
 *
 * Pure function: takes previous + current data, returns the report.
 * No I/O. Unit-testable without mocking the DB or Sentry.
 */

export interface EvalRunSummary {
  id: string;
  passRate: number; // 0..1
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface EvalResultRow {
  evalSlug: string;
  agentSlug: string;
  status: "passed" | "failed" | "skipped";
  outputHash: string | null;
}

export interface DriftReport {
  drifted: boolean;
  /** Percentage points: positive = pass rate dropped, negative = improved */
  passRateDeltaPp: number;
  /** Evals that flipped from passed → failed */
  newlyFailed: string[];
  /** Evals that flipped from failed → passed (non-blocking, informational) */
  newlyPassed: string[];
  /** Evals where output_hash changed — silent drift */
  silentDrift: string[];
  severity: "none" | "warning" | "critical";
  summary: string;
}

const DRIFT_THRESHOLD_PP = 5; // > 5 percentage-point drop fires alert

/**
 * Compare previous and current eval runs. Both may be the same run
 * (self-check) or consecutive runs; the caller provides the summaries
 * + per-result detail arrays.
 */
export function detectDrift(
  previous: { summary: EvalRunSummary; results: EvalResultRow[] } | null,
  current: { summary: EvalRunSummary; results: EvalResultRow[] },
): DriftReport {
  // First run ever — nothing to compare against
  if (!previous) {
    return {
      drifted: false,
      passRateDeltaPp: 0,
      newlyFailed: [],
      newlyPassed: [],
      silentDrift: [],
      severity: "none",
      summary: "first run — no baseline",
    };
  }

  const prevRate = previous.summary.passRate;
  const curRate = current.summary.passRate;
  const deltaPp = (prevRate - curRate) * 100; // positive = regression

  // Build lookup maps by "slug:agent" composite key
  const prevByKey = new Map(previous.results.map((r) => [`${r.evalSlug}:${r.agentSlug}`, r]));
  const curByKey = new Map(current.results.map((r) => [`${r.evalSlug}:${r.agentSlug}`, r]));

  const newlyFailed: string[] = [];
  const newlyPassed: string[] = [];
  const silentDrift: string[] = [];

  for (const [key, cur] of curByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue; // new eval added; not drift

    // Status flip
    if (prev.status === "passed" && cur.status === "failed") {
      newlyFailed.push(key);
    } else if (prev.status === "failed" && cur.status === "passed") {
      newlyPassed.push(key);
    }

    // Silent drift — same status (passed) but output_hash changed.
    // Hash changes on "skipped" rows don't count (no output).
    if (
      prev.status === "passed" &&
      cur.status === "passed" &&
      prev.outputHash &&
      cur.outputHash &&
      prev.outputHash !== cur.outputHash
    ) {
      silentDrift.push(key);
    }
  }

  const passRateDrift = deltaPp > DRIFT_THRESHOLD_PP;
  const anyNewlyFailed = newlyFailed.length > 0;
  const drifted = passRateDrift || anyNewlyFailed;

  // Severity:
  //   critical — pass rate fell > 10pp OR >=3 newly-failed evals
  //   warning  — either drift condition present
  //   none     — healthy
  let severity: DriftReport["severity"] = "none";
  if (drifted) {
    severity = deltaPp > 10 || newlyFailed.length >= 3 ? "critical" : "warning";
  }

  const summary = drifted
    ? `Pass rate ${(curRate * 100).toFixed(1)}% (Δ ${deltaPp >= 0 ? "-" : "+"}${Math.abs(deltaPp).toFixed(1)}pp). ${newlyFailed.length} newly failed, ${silentDrift.length} silent drift.`
    : `Healthy: ${(curRate * 100).toFixed(1)}% pass rate, no regressions.`;

  return {
    drifted,
    passRateDeltaPp: deltaPp,
    newlyFailed,
    newlyPassed,
    silentDrift,
    severity,
    summary,
  };
}
