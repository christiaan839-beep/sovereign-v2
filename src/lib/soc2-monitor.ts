/**
 * SOVEREIGN MATRIX — Continuous SOC 2 monitor (Cook 58 / Tier 7 #34)
 *
 * Live control-posture dashboard. Each SOC 2 Trust Services Criterion
 * (TSC) maps to one or more INDICATORS we can evaluate from observable
 * platform state — receipt pass rate, drift events, red-team failure
 * count, encryption coverage, MFA-enrolled admin fraction, etc.
 *
 * Pure module: caller supplies the indicator readings; this module
 * scores each control + aggregates by TSC category. The result is a
 * structured `Soc2Posture` snapshot consumed by the /trust dashboard
 * UI and the audit-bundle subscription (Cook 56).
 */

// ── Public types ──────────────────────────────────────────────────────────

export type Tsc =
  | "security"
  | "availability"
  | "processing-integrity"
  | "confidentiality"
  | "privacy";

export type ControlStatus = "pass" | "warn" | "fail" | "not-applicable";

export interface IndicatorReading {
  /** Stable id (e.g. "encryption-at-rest-coverage"). */
  id: string;
  /** Numeric reading. Interpretation depends on the control. */
  value: number;
  /** Optional context for the dashboard. */
  evidence?: string;
}

export interface ControlRule {
  id: string;
  title: string;
  tsc: Tsc;
  /** Indicator the rule reads. */
  indicator: string;
  /** Threshold contract — see `evaluateRule()`. */
  threshold: {
    /** Reading >= passAt → pass. */
    passAt: number;
    /** Reading >= warnAt && < passAt → warn. */
    warnAt: number;
  };
}

export interface ControlEvaluation {
  rule: ControlRule;
  reading: IndicatorReading | undefined;
  status: ControlStatus;
  /** Distance from `passAt` (positive = above threshold). */
  delta: number;
}

export interface Soc2Posture {
  generatedAt: string;
  /** Per-control evaluation. */
  controls: ControlEvaluation[];
  /** Per-TSC aggregate counts. */
  byTsc: Record<Tsc, Record<ControlStatus, number>>;
  /** Overall fraction of controls that pass. */
  overallPassFraction: number;
}

// ── Baseline rules ────────────────────────────────────────────────────────

export const SOC2_RULES: ControlRule[] = [
  {
    id: "CC6.1-encryption-rest",
    title: "Logical access — encryption at rest coverage",
    tsc: "security",
    indicator: "encryption-at-rest-coverage",
    threshold: { passAt: 1.0, warnAt: 0.95 },
  },
  {
    id: "CC6.2-mfa-admin",
    title: "Logical access — admin MFA enrollment",
    tsc: "security",
    indicator: "mfa-admin-fraction",
    threshold: { passAt: 1.0, warnAt: 0.95 },
  },
  {
    id: "CC7.1-failed-deploy-rate",
    title: "System operations — failed deploy rate (90d)",
    tsc: "availability",
    indicator: "failed-deploy-rate",
    // Lower is better — reading is `1 - failedRate`.
    threshold: { passAt: 0.95, warnAt: 0.9 },
  },
  {
    id: "CC7.2-incident-mttr",
    title: "Change management — incident MTTR (1 - hours/24)",
    tsc: "availability",
    indicator: "incident-mttr-score",
    threshold: { passAt: 0.9, warnAt: 0.5 },
  },
  {
    id: "PI1.1-pass-rate",
    title: "Processing integrity — receipt pass rate",
    tsc: "processing-integrity",
    indicator: "receipt-pass-rate",
    threshold: { passAt: 0.99, warnAt: 0.95 },
  },
  {
    id: "PI1.2-drift-rate",
    title: "Processing integrity — receipt drift rate inverse",
    tsc: "processing-integrity",
    indicator: "receipt-non-drift-rate",
    threshold: { passAt: 0.99, warnAt: 0.95 },
  },
  {
    id: "PI1.3-red-team-critical",
    title: "Processing integrity — red-team critical failures (none)",
    tsc: "processing-integrity",
    indicator: "red-team-critical-zero",
    threshold: { passAt: 1.0, warnAt: 1.0 },
  },
  {
    id: "C1.1-pii-coverage",
    title: "Confidentiality — PII scanner coverage",
    tsc: "confidentiality",
    indicator: "pii-scanner-coverage",
    threshold: { passAt: 1.0, warnAt: 0.99 },
  },
  {
    id: "P1.1-dsr-response-sla",
    title: "Privacy — data subject request response SLA",
    tsc: "privacy",
    indicator: "dsr-response-sla",
    threshold: { passAt: 0.95, warnAt: 0.85 },
  },
];

// ── Evaluation ────────────────────────────────────────────────────────────

function evaluateRule(
  rule: ControlRule,
  readings: Map<string, IndicatorReading>,
): ControlEvaluation {
  const reading = readings.get(rule.indicator);
  if (!reading) {
    return {
      rule,
      reading: undefined,
      status: "not-applicable",
      delta: -Infinity,
    };
  }
  const delta = reading.value - rule.threshold.passAt;
  let status: ControlStatus;
  if (reading.value >= rule.threshold.passAt) status = "pass";
  else if (reading.value >= rule.threshold.warnAt) status = "warn";
  else status = "fail";
  return { rule, reading, status, delta };
}

const TSC_SEED = (): Record<ControlStatus, number> => ({
  pass: 0,
  warn: 0,
  fail: 0,
  "not-applicable": 0,
});

export function buildPosture(
  readings: IndicatorReading[],
  options?: { extraRules?: ControlRule[]; now?: Date },
): Soc2Posture {
  const now = options?.now ?? new Date();
  const rules = [...SOC2_RULES, ...(options?.extraRules ?? [])];
  const readingMap = new Map(readings.map((r) => [r.id, r]));

  const controls = rules.map((r) => evaluateRule(r, readingMap));

  const byTsc: Record<Tsc, Record<ControlStatus, number>> = {
    security: TSC_SEED(),
    availability: TSC_SEED(),
    "processing-integrity": TSC_SEED(),
    confidentiality: TSC_SEED(),
    privacy: TSC_SEED(),
  };
  for (const c of controls) {
    byTsc[c.rule.tsc][c.status]++;
  }

  const evaluable = controls.filter((c) => c.status !== "not-applicable");
  const passing = evaluable.filter((c) => c.status === "pass").length;
  const overallPassFraction =
    evaluable.length === 0 ? 0 : passing / evaluable.length;

  return {
    generatedAt: now.toISOString(),
    controls,
    byTsc,
    overallPassFraction,
  };
}
