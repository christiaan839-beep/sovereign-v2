/**
 * SOVEREIGN MATRIX — Compliance regression-test framework (Cook 115).
 *
 * For every Cook 49 control + Cook 58 SOC 2 rule, declare a typed
 * regression test that runs on every CI build. If a feature change
 * breaks a control we depend on, the build turns red before the
 * change merges.
 *
 * Pure module: each regression test is a pure function the caller
 * supplies. The framework orchestrates execution + verdict
 * aggregation.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type ControlSeverity = "low" | "medium" | "high" | "critical";

export interface ComplianceTest {
  /** Stable id (matches a Cook 49 control or Cook 58 rule). */
  controlId: string;
  /** Human-readable test name. */
  name: string;
  /** Test severity — caller's CI gate decides when to fail. */
  severity: ControlSeverity;
  /** Pure function returning pass/fail + evidence. */
  run: () => Promise<{ pass: boolean; evidence: string }>;
}

export interface ControlResult {
  controlId: string;
  name: string;
  severity: ControlSeverity;
  pass: boolean;
  evidence: string;
  durationMs: number;
}

export interface ComplianceRunReport {
  total: number;
  passed: number;
  failed: number;
  results: ControlResult[];
  /** Failures bucketed by severity. */
  failuresBySeverity: Record<ControlSeverity, number>;
  /** True iff every critical + high control passed. */
  blocking: boolean;
}

// ── Runner ────────────────────────────────────────────────────────────────

/**
 * Run every supplied compliance test in parallel + aggregate the
 * verdict. Each test's `run` is wrapped in a try/catch so a throwing
 * test counts as a failure (with the error message as evidence)
 * rather than aborting the whole suite.
 */
export async function runCompliance(
  tests: ComplianceTest[],
): Promise<ComplianceRunReport> {
  if (tests.length === 0) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      results: [],
      failuresBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      blocking: false,
    };
  }
  const results: ControlResult[] = await Promise.all(
    tests.map(async (t) => {
      const start = Date.now();
      try {
        const r = await t.run();
        return {
          controlId: t.controlId,
          name: t.name,
          severity: t.severity,
          pass: r.pass,
          evidence: r.evidence,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          controlId: t.controlId,
          name: t.name,
          severity: t.severity,
          pass: false,
          evidence: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        };
      }
    }),
  );
  const failuresBySeverity: Record<ControlSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const r of results) {
    if (!r.pass) failuresBySeverity[r.severity]++;
  }
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const blocking =
    failuresBySeverity.critical === 0 && failuresBySeverity.high === 0;
  return {
    total: results.length,
    passed,
    failed,
    results,
    failuresBySeverity,
    blocking: passed === results.length || blocking,
  };
}

/**
 * Render a CI-friendly report. Each result on its own line; the
 * caller pipes this to stdout in the CI step.
 */
export function renderReport(report: ComplianceRunReport): string {
  const lines: string[] = [
    `compliance: ${report.passed}/${report.total} controls passed`,
  ];
  for (const r of report.results) {
    const marker = r.pass ? "✓" : "✗";
    lines.push(
      `${marker} [${r.severity}] ${r.controlId} — ${r.name}: ${r.evidence}`,
    );
  }
  if (report.failed > 0) {
    lines.push(
      `failures: critical=${report.failuresBySeverity.critical} high=${report.failuresBySeverity.high} medium=${report.failuresBySeverity.medium} low=${report.failuresBySeverity.low}`,
    );
  }
  return lines.join("\n");
}
