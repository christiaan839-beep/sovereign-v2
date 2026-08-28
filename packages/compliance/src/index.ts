/**
 * The regulation registry.
 *
 * Eight standards used to be eight packages that differed only in
 * their catalogue and their nouns. They are now one engine plus five
 * catalogue-driven data packs (SOC 2, ISO/IEC 42001, NIST AI RMF,
 * HIPAA Security, EU CRA), the risk-register scorer for the two that
 * ask the operator to declare risks rather than work a fixed list
 * (ISO/IEC 23894, GDPR DPIA), and the Annex IV exporter, which builds
 * a narrative document rather than a matrix and keeps its own module.
 *
 * Adding a regulation means adding a file under `packs/` and one line
 * here.
 *
 * @packageDocumentation
 */

import { buildControlMatrix, toMarkdown } from "./engine.js";
import type {
  BuildControlMatrixOptions,
  ControlMatrixReport,
  ReceiptLike,
  RegulationPack,
  ReportScope,
} from "./types.js";

import { SOC2_PACK } from "./packs/soc2.js";
import { ISO_42001_PACK } from "./packs/iso-42001.js";
import { NIST_AI_RMF_PACK } from "./packs/nist-ai-rmf.js";
import { HIPAA_SECURITY_PACK } from "./packs/hipaa-security.js";
import { EU_CRA_PACK } from "./packs/eu-cra.js";

/** Every catalogue-driven regulation, by slug. */
export const REGULATIONS = {
  soc2: SOC2_PACK,
  "iso-42001": ISO_42001_PACK,
  "nist-ai-rmf": NIST_AI_RMF_PACK,
  "hipaa-security": HIPAA_SECURITY_PACK,
  "eu-cra": EU_CRA_PACK,
} as const satisfies Record<string, RegulationPack>;

/** Slug of a supported catalogue-driven regulation. */
export type RegulationId = keyof typeof REGULATIONS;

/** True when `id` names a supported regulation. Narrows the type. */
export function isRegulationId(id: string): id is RegulationId {
  return Object.prototype.hasOwnProperty.call(REGULATIONS, id);
}

/**
 * Resolve a slug to its pack.
 *
 * Throws on an unknown slug, listing what is available — this is
 * usually reached from an API path segment or a CLI argument, where a
 * silent empty report would be the worst possible answer.
 */
export function getRegulation(id: string): RegulationPack {
  if (!isRegulationId(id)) {
    throw new Error(
      `getRegulation: unknown regulation "${id}". Available: ${Object.keys(REGULATIONS).sort().join(", ")}.`,
    );
  }
  return REGULATIONS[id];
}

/** One row of the catalogue index — enough to render a picker. */
export interface RegulationSummary {
  id: RegulationId;
  standard: string;
  reportTitle: string;
  /** How many controls the catalogue carries. */
  controlCount: number;
  /** What this standard calls one catalogue entry. */
  controlNoun: { singular: string; plural: string };
  /** Category vocabulary, in report order. */
  categories: string[];
  /** Categories in scope no matter what the operator selects. */
  alwaysInScope: string[];
}

/** Every supported regulation, for menus, docs and API discovery. */
export function listRegulations(): RegulationSummary[] {
  return (Object.keys(REGULATIONS) as RegulationId[]).map((id) => {
    const p = REGULATIONS[id];
    return {
      id,
      standard: p.standard,
      reportTitle: p.reportTitle,
      controlCount: p.controls.length,
      controlNoun: p.controlNoun,
      categories: [...p.categories],
      alwaysInScope: [...(p.alwaysInScope ?? [])],
    };
  });
}

/** Options for {@link buildComplianceReport}. */
export interface BuildComplianceReportOptions
  extends Omit<BuildControlMatrixOptions, "pack"> {
  /** Which regulation to build against. */
  regulation: RegulationId | string;
  scope: ReportScope;
  receipts: ReceiptLike[];
}

/**
 * Build an evidence matrix for a regulation named by slug.
 *
 * The one call an API route or CLI wants: take the framework off the
 * request, hand over the receipts, get the report.
 */
export function buildComplianceReport(
  opts: BuildComplianceReportOptions,
): ControlMatrixReport {
  const { regulation, ...rest } = opts;
  return buildControlMatrix({ ...rest, pack: getRegulation(regulation) });
}

/** Reverse index so a report can find its own pack when rendering. */
const BY_SCHEMA = new Map<string, RegulationPack>(
  Object.values(REGULATIONS).map((p) => [p.schema, p]),
);

/**
 * Render any report this registry produced, without the caller having
 * to carry the pack alongside it.
 */
export function renderMarkdown(report: ControlMatrixReport): string {
  const pack = BY_SCHEMA.get(report.schema);
  if (!pack) {
    throw new Error(
      `renderMarkdown: no registered regulation for schema "${report.schema}". ` +
        `Use toMarkdown(report, pack) directly for a pack you supplied yourself.`,
    );
  }
  return toMarkdown(report, pack);
}

// ── Package surface ──────────────────────────────────────────────────
// The engine and the risk scorer, re-exported so consumers import from
// one place. Deep imports (`/engine`, `/risk`, `/types`) stay available
// for callers who want only a slice.

export {
  buildControlMatrix,
  tallyEvidence,
  toMarkdown,
  toJSON,
  type Generator,
} from "./engine.js";

export {
  RISK_LEVELS,
  attenuate,
  scoreRisk,
  scoreRiskRegister,
  summariseRegister,
  type Impact,
  type Likelihood,
  type RiskLevel,
  type RiskScenario,
  type ScoredScenario,
  type Treatment,
} from "./risk.js";

export {
  byCategory,
  byMeta,
  groupBy,
  groupTally,
  type GroupTally,
} from "./helpers.js";

export type {
  BuildControlMatrixOptions,
  ControlAnnotation,
  ControlEntry,
  ControlEvidence,
  ControlMatrixReport,
  EvidenceTally,
  MetaColumn,
  ReceiptLike,
  RegulationPack,
  ReportScope,
} from "./types.js";
