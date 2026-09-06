/**
 * @sovereign-matrix/iso-23894
 *
 * ISO/IEC 23894:2023 Information technology — Artificial intelligence
 * — Guidance on risk management.
 *
 * ISO/IEC 23894 is the AI-specific adaptation of ISO 31000 (the
 * general risk management standard). It provides guidance for
 * managing AI-related risk across the AI lifecycle. ISO 42001
 * (AIMS) references 23894 as the canonical source for AI risk
 * management practice.
 *
 * Where 42001 says "you must do AI risk management", 23894 says "and
 * here is how". The two packages are deliberately separable so
 * organisations can adopt one without the other.
 *
 * This exporter consumes VAOS receipts + operator-declared risk
 * scenarios and emits an ISO 23894-aligned risk-management report.
 *
 * Apache 2.0. Zero runtime deps beyond @sovereign-matrix/verifiable-receipts.
 */

import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
// Every receipt-derived string this module publishes goes through this.
// SECURITY.md item 4: key material must not reach an exporter's output.
import { redactKeyMaterial } from "@sovereign-matrix/verifiable-receipts";

/**
 * AI risk-management scope per ISO/IEC 23894 § 4 (context establishment).
 */
export interface RiskMgmtScope {
  /** Organization name. */
  organizationName: string;
  /** Name of the AI system being assessed. */
  systemName: string;
  /** AI lifecycle phase per § 4.2: inception / design / development / verification / deployment / operation / re-evaluation / retirement. */
  lifecyclePhase:
    | "inception"
    | "design"
    | "development"
    | "verification-validation"
    | "deployment"
    | "operation-monitoring"
    | "re-evaluation"
    | "retirement";
  /** Risk-management policy version (operator-supplied id). */
  policyVersion: string;
  /** Reporting period start ISO 8601. */
  periodStart: string;
  /** Reporting period end ISO 8601. */
  periodEnd: string;
}

/**
 * Operator-declared risk scenario per ISO/IEC 23894 § 5.4 (risk identification).
 */
export interface RiskScenario {
  /** Stable id. */
  id: string;
  /** Plain-language scenario description. */
  description: string;
  /** Risk source per § 5.4.2 (e.g. "training data quality", "prompt injection", "model drift"). */
  source: string;
  /** Likelihood per § 5.5.2. ENISA-style scale. */
  likelihood: "rare" | "unlikely" | "possible" | "likely" | "almost-certain";
  /** Impact per § 5.5.3. */
  impact: "negligible" | "minor" | "moderate" | "major" | "catastrophic";
  /** Trustworthy-AI characteristic affected (mirrors NIST AI RMF). */
  characteristic:
    | "valid-and-reliable"
    | "safe"
    | "secure-and-resilient"
    | "accountable-and-transparent"
    | "explainable-and-interpretable"
    | "privacy-enhanced"
    | "fair-with-bias-managed";
  /** Operator-supplied treatment plan per § 6 (avoid / reduce / share / accept). */
  treatment: "avoid" | "reduce" | "share" | "accept";
  /** Treatment description (free text). */
  treatmentDescription: string;
  /** Guardian-pack prefixes whose receipts evidence treatment effectiveness. */
  evidencePackPrefixes: string[];
}

/**
 * Computed risk level. ISO 31000 uses a 5×5 matrix; we collapse the
 * 25 cells into 5 bands for output clarity.
 */
export type RiskLevel = "very-low" | "low" | "medium" | "high" | "extreme";

export interface ScoredScenario extends RiskScenario {
  inherentRisk: RiskLevel;
  evidenceCount: number;
  residualRisk: RiskLevel;
}

/** Full report. */
export interface Iso23894Report {
  schema: "vaos-iso-23894-v1";
  generatedAt: string;
  standardVersion: "23894:2023";
  scope: RiskMgmtScope;
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
  };
  scenarios: ScoredScenario[];
  byLevel: Record<RiskLevel, number>;
  byCharacteristic: Record<RiskScenario["characteristic"], number>;
  summary: {
    scenariosTotal: number;
    extremeOrHighInherent: number;
    extremeOrHighResidual: number;
    untreated: number;
  };
}

/** Options for the build call. */
export interface BuildIso23894Options {
  scope: RiskMgmtScope;
  scenarios: RiskScenario[];
  receipts: ReceiptRecord[];
}

/**
 * Standard 5×5 risk matrix collapsing to a level.
 *   ┌──────────────┬──────────────────────────────────────────┐
 *   │              │ Negligible Minor Moderate Major Catastr. │
 *   ├──────────────┼──────────────────────────────────────────┤
 *   │ Almost cert. │ low        medium high     extreme extreme│
 *   │ Likely       │ low        medium high     high    extreme│
 *   │ Possible     │ very-low   low    medium   high    extreme│
 *   │ Unlikely     │ very-low   low    low      medium  high   │
 *   │ Rare         │ very-low   very-low low    medium  high   │
 *   └──────────────┴──────────────────────────────────────────┘
 */
function scoreRisk(
  likelihood: RiskScenario["likelihood"],
  impact: RiskScenario["impact"],
): RiskLevel {
  const L: Record<RiskScenario["likelihood"], number> = {
    rare: 0,
    unlikely: 1,
    possible: 2,
    likely: 3,
    "almost-certain": 4,
  };
  const I: Record<RiskScenario["impact"], number> = {
    negligible: 0,
    minor: 1,
    moderate: 2,
    major: 3,
    catastrophic: 4,
  };
  // Use sum-of-indices banded to levels.
  const s = L[likelihood] + I[impact];
  if (s >= 7) return "extreme";
  if (s >= 5) return "high";
  if (s >= 3) return "medium";
  if (s >= 1) return "low";
  return "very-low";
}

/**
 * Apply evidence-count attenuation. Each receipt that evidences the
 * treatment shifts the inherent risk one band lower, up to 2 bands.
 * No magic — pure operator-explainable arithmetic.
 */
function attenuate(inherent: RiskLevel, evidenceCount: number): RiskLevel {
  const order: RiskLevel[] = ["very-low", "low", "medium", "high", "extreme"];
  const idx = order.indexOf(inherent);
  // Buckets: <10 evidence → 0 shift; 10-100 → 1 shift; 100+ → 2 shifts.
  const shift = evidenceCount >= 100 ? 2 : evidenceCount >= 10 ? 1 : 0;
  const newIdx = Math.max(0, idx - shift);
  return order[newIdx]!;
}

export function buildIso23894(opts: BuildIso23894Options): Iso23894Report {
  const { scope, scenarios, receipts } = opts;
  const generatedAt = new Date().toISOString();

  // Validate scenario id uniqueness.
  const seen = new Set<string>();
  for (const s of scenarios) {
    if (seen.has(s.id)) {
      throw new Error(
        `buildIso23894: duplicate scenario id "${s.id}". Scenario ids MUST be unique.`,
      );
    }
    seen.add(s.id);
  }

  // Score every scenario.
  const scored: ScoredScenario[] = scenarios.map((s) => {
    let evidenceCount = 0;
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? redactKeyMaterial(r.pack).toLowerCase() : "";
      if (!pack) continue;
      if (
        s.evidencePackPrefixes.some((p) => pack.startsWith(p.toLowerCase()))
      ) {
        evidenceCount++;
      }
    }
    const inherent = scoreRisk(s.likelihood, s.impact);
    const residual = attenuate(inherent, evidenceCount);
    return {
      ...s,
      inherentRisk: inherent,
      evidenceCount,
      residualRisk: residual,
    };
  });

  // Aggregate.
  const byLevel: Record<RiskLevel, number> = {
    "very-low": 0,
    low: 0,
    medium: 0,
    high: 0,
    extreme: 0,
  };
  const byCharacteristic: Record<RiskScenario["characteristic"], number> = {
    "valid-and-reliable": 0,
    safe: 0,
    "secure-and-resilient": 0,
    "accountable-and-transparent": 0,
    "explainable-and-interpretable": 0,
    "privacy-enhanced": 0,
    "fair-with-bias-managed": 0,
  };
  let extremeOrHighInherent = 0;
  let extremeOrHighResidual = 0;
  let untreated = 0;
  for (const s of scored) {
    byLevel[s.residualRisk]++;
    byCharacteristic[s.characteristic]++;
    if (s.inherentRisk === "extreme" || s.inherentRisk === "high")
      extremeOrHighInherent++;
    if (s.residualRisk === "extreme" || s.residualRisk === "high")
      extremeOrHighResidual++;
    if (s.evidenceCount === 0) untreated++;
  }

  return {
    schema: "vaos-iso-23894-v1",
    generatedAt,
    standardVersion: "23894:2023",
    scope,
    reportingWindow: {
      from: scope.periodStart,
      to: scope.periodEnd,
      totalReceipts: receipts.length,
    },
    scenarios: scored,
    byLevel,
    byCharacteristic,
    summary: {
      scenariosTotal: scored.length,
      extremeOrHighInherent,
      extremeOrHighResidual,
      untreated,
    },
  };
}

export function toMarkdown(report: Iso23894Report): string {
  const lines: string[] = [];
  const h = (lv: number, t: string): void => {
    lines.push(`${"#".repeat(lv)} ${t}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  h(1, "ISO/IEC 23894:2023 — AI Risk Management Report");
  lines.push(
    `*Generated by @sovereign-matrix/iso-23894 at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*Aligned to ISO/IEC 23894:2023 + ISO 31000. Risk scenarios are operator-declared; inherent and residual levels are computed via the 5×5 likelihood × impact matrix; residual levels attenuated by receipt-derived treatment evidence (≥10 receipts → 1 band lower, ≥100 → 2 bands lower).*",
  );
  lines.push("");

  h(2, "Scope");
  kv("Organization", report.scope.organizationName);
  kv("System", report.scope.systemName);
  kv("Lifecycle phase", report.scope.lifecyclePhase);
  kv("Policy version", report.scope.policyVersion);
  kv("Period", `${report.scope.periodStart} → ${report.scope.periodEnd}`);
  kv("Receipts in window", report.reportingWindow.totalReceipts);
  lines.push("");

  h(2, "Summary");
  kv("Risk scenarios", report.summary.scenariosTotal);
  kv("Extreme/high inherent", report.summary.extremeOrHighInherent);
  kv("Extreme/high residual", report.summary.extremeOrHighResidual);
  kv("Untreated (zero evidence)", report.summary.untreated);
  lines.push("");

  h(3, "Residual risk by level");
  for (const [k, v] of Object.entries(report.byLevel)) {
    kv(k, v);
  }
  lines.push("");

  h(3, "Coverage by trustworthy-AI characteristic");
  for (const [k, v] of Object.entries(report.byCharacteristic)) {
    kv(k, v);
  }
  lines.push("");

  h(2, "Risk scenarios");
  lines.push(
    "| ID | Description | Char. | Inherent | Evidence | Residual | Treatment |",
  );
  lines.push("|---|---|---|---|---|---|---|");
  for (const s of report.scenarios) {
    lines.push(
      `| \`${s.id}\` | ${s.description.slice(0, 64)}${s.description.length > 64 ? "…" : ""} | ${s.characteristic} | ${s.inherentRisk} | ${s.evidenceCount} | ${s.residualRisk} | ${s.treatment} |`,
    );
  }
  lines.push("");

  h(2, "Provenance");
  lines.push(
    `Generated by [@sovereign-matrix/iso-23894](https://www.npmjs.com/package/@sovereign-matrix/iso-23894) v0.1.0 · Apache 2.0. Risk-band computation is deterministic from the matrix function + receipt counts; auditors can re-derive every band given the same scenarios + receipts.`,
  );

  return lines.join("\n");
}

export function toJSON(report: Iso23894Report): string {
  return JSON.stringify(report, null, 2);
}
