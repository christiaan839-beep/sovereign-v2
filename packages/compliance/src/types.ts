/**
 * The shapes the compliance engine speaks.
 *
 * Every regulation this package supports is expressed as data — a
 * `RegulationPack` — and rendered by one engine. Adding a regulation
 * is a data change, not a code change. That is the whole design.
 *
 * @packageDocumentation
 */

/**
 * One control, criterion, requirement, implementation specification or
 * subcategory — whatever the regulation calls its smallest auditable
 * unit. The engine treats them identically; the pack supplies the noun.
 */
export interface ControlEntry {
  /** The regulation's own identifier, verbatim (e.g. `CC6.1`, `164.308(a)(1)(i)`). */
  id: string;
  /** Grouping key, drawn from the regulation's own vocabulary. */
  category: string;
  /** Short human title. */
  title: string;
  /** The requirement / objective / outcome text, as the regulation words it. */
  objective: string;
  /**
   * Guardian pack-name prefixes whose receipts evidence this control.
   * A receipt evidences the control when its `pack` starts with any of
   * these, compared case-insensitively.
   */
  evidencePackPrefixes: string[];
  /**
   * Regulation-specific fields that do not generalise — HIPAA's
   * required/addressable classification, the CRA's annex reference,
   * the RMF's trustworthy-AI characteristic. Rendered as columns when
   * the pack declares them in `metaColumns`.
   */
  meta?: Record<string, string>;
}

/** A column derived from `ControlEntry.meta`. */
export interface MetaColumn {
  /** Key within `ControlEntry.meta`. */
  key: string;
  /** Column header in the rendered table. */
  header: string;
}

/**
 * A regulation, entirely as data.
 */
export interface RegulationPack {
  /** Stable slug — the registry key, and the id an API or CLI accepts. */
  id: string;
  /** Standard name and edition, e.g. `ISO/IEC 42001:2023`. */
  standard: string;
  /** H1 of the rendered report. */
  reportTitle: string;
  /** `schema` tag written into the JSON output, for downstream consumers. */
  schema: string;
  /**
   * One paragraph under the H1 saying what the report is and is not.
   * Italicised in the markdown output.
   */
  preamble: string;
  /** What this regulation calls one catalogue entry. */
  controlNoun: { singular: string; plural: string };
  /**
   * Category vocabulary, in report order. Categories present in the
   * catalogue but missing here still render, sorted, after these.
   */
  categories: string[];
  /**
   * Categories always in scope no matter what the operator selects
   * (SOC 2 Security, for instance, is not optional).
   */
  alwaysInScope?: string[];
  /** Extra `meta` keys to surface as table columns, in order. */
  metaColumns?: MetaColumn[];
  /** The catalogue. */
  controls: ControlEntry[];
}

/** Evidence found for one control over the reporting window. */
export interface EvidenceTally {
  /** Receipts whose pack matched one of the control's prefixes. */
  count: number;
  /** Earliest matching receipt's `issuedAt`, or null when none matched. */
  earliest: string | null;
  /** Latest matching receipt's `issuedAt`, or null when none matched. */
  latest: string | null;
  /**
   * Distinct calendar days (UTC) on which evidence exists. This, not
   * `count`, is what distinguishes continuous operation from a single
   * busy afternoon — which is the question every auditor actually asks.
   */
  daysOfCoverage: number;
}

/**
 * An operator's own note against a control.
 *
 * Several frameworks need this under different names — HIPAA marks a
 * specification implemented / alternative / not-applicable, the CRA
 * marks a requirement compliant / alternative-measure / open. Both are
 * the same thing: a human saying something a receipt count cannot.
 * `status` is free-form because each framework's vocabulary differs.
 */
export interface ControlAnnotation {
  /** Framework-specific status word, e.g. "not-applicable". */
  status?: string;
  /** Why. Rendered next to the control, and required for a real audit. */
  note?: string;
}

/** A catalogue entry with its evidence attached. */
export interface ControlEvidence extends ControlEntry {
  evidence: EvidenceTally;
  /** Operator-named accountable owner, when supplied. */
  controlOwner?: string;
  /** Operator annotation, when supplied. */
  annotation?: ControlAnnotation;
}

/** Reporting scope, common across every catalogue-driven regulation. */
export interface ReportScope {
  /** Legal entity the report is about. */
  organizationName: string;
  /** System or service under assessment. */
  systemName: string;
  /** Start of the reporting period, ISO 8601. */
  periodStart: string;
  /** End of the reporting period, ISO 8601. */
  periodEnd: string;
  /**
   * Optional categories the operator opts into, beyond the pack's
   * `alwaysInScope` set. Omit to include the whole catalogue.
   */
  inScope?: string[];
  /**
   * Free-form fields the regulation needs but the engine does not
   * interpret — a profile type, an AIMS policy version, a CRA product
   * class. Rendered verbatim in the Scope section.
   */
  declarations?: Record<string, string>;
}

/** The rendered report. */
export interface ControlMatrixReport {
  schema: string;
  standard: string;
  reportTitle: string;
  generatedAt: string;
  scope: ReportScope;
  reportingWindow: {
    from: string;
    to: string;
    durationDays: number;
    totalReceipts: number;
  };
  controls: ControlEvidence[];
  /** Controls with evidence, keyed by category. */
  byCategory: Record<string, { total: number; withEvidence: number }>;
  /**
   * Controls with no evidence at all, or with coverage below the
   * threshold. This is the section an auditor reads first.
   */
  gaps: ControlEvidence[];
  summary: {
    controlsTotal: number;
    controlsWithEvidence: number;
    /** Controls the operator annotated. */
    controlsAnnotated: number;
    /** withEvidence / total, 0..1. */
    coverageRate: number;
    averageDaysOfCoverage: number;
    /** Receipts that matched no control in the catalogue. */
    unmappedReceipts: number;
  };
}

/** Options for {@link buildControlMatrix}. */
export interface BuildControlMatrixOptions {
  /** The regulation to build against. */
  pack: RegulationPack;
  scope: ReportScope;
  /** Receipts covering the reporting window. */
  receipts: ReceiptLike[];
  /** Accountable owner per control id. Unknown ids throw. */
  controlOwners?: Record<string, string>;
  /**
   * Operator annotations per control id. Unknown ids throw, for the
   * same reason `controlOwners` does: a typo here silently drops a
   * "not applicable, because …" from an audit document.
   */
  annotations?: Record<string, ControlAnnotation>;
  /**
   * Days of coverage below which a control counts as a gap even when
   * it has evidence. Defaults to 30 — a month of continuous operation.
   */
  coverageThresholdDays?: number;
}

/**
 * The engine reads three fields off a receipt and ignores everything
 * else, so anything receipt-shaped works — a minted attestation, a row
 * out of your own audit table, an OpenTelemetry span you projected.
 */
export interface ReceiptLike {
  issuedAt?: string;
  pack?: string;
  [key: string]: unknown;
}
