/**
 * @sovereign-matrix/soc2-evidence
 *
 * SOC 2 Trust Service Criteria evidence-binder exporter.
 *
 * The AICPA Trust Services Criteria (TSC) 2017 organize SOC 2
 * controls into five categories:
 *
 *   Security             — common criteria CC1-CC9 (required for
 *                          every SOC 2 report)
 *   Availability         — A1 (system uptime, capacity, backups)
 *   Processing Integrity — PI1 (system processing is complete,
 *                          accurate, timely, authorized)
 *   Confidentiality      — C1 (information designated as
 *                          confidential is protected)
 *   Privacy              — P-series (notice, choice, collection,
 *                          use, retention, access, disclosure)
 *
 * A SOC 2 Type II audit verifies that controls operated effectively
 * over a period (typically 6-12 months), and the auditor needs
 * evidence of each control's operation throughout the window.
 *
 * This package consumes VAOS receipts and renders the criterion
 * table in Markdown and JSON, marking each criterion evidenced or
 * unevidenced.
 *
 * ## What a receipt can evidence here
 *
 * A receipt is a Guardian verdict on the wording of one model output (see
 * the module docstring of `packs.ts`). It is signed, timestamped and
 * re-verifiable, so it is good evidence of what it actually records — and
 * that is a narrow thing. It does not observe a firewall rule, an access review, a
 * background check, a data-centre door or a vendor contract, so it cannot
 * evidence the criteria that are about those — which is most of the TSC.
 * Two of the 33 security criteria declare a reachable pack.
 *
 * So this binder is a partial input to a SOC 2 audit, not a coverage claim
 * for it. Controls the receipts cannot reach carry no prefix mapping and
 * report as unevidenced, which is the honest reading and the one an auditor
 * would reach anyway.
 *
 * Output formats:
 *   - Markdown (binder-style, audit-archive friendly)
 *   - JSON (machine-readable, ingestible by PBC platforms)
 *
 * Apache 2.0. Zero runtime deps beyond @sovereign-matrix/verifiable-receipts.
 *
 * @packageDocumentation
 */

import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
// Every receipt-derived string this module publishes goes through this.
// SECURITY.md item 4: key material must not reach an exporter's output.
import { redactKeyMaterial } from "@sovereign-matrix/verifiable-receipts";

/**
 * SOC 2 scope. The operator declares which TSC categories are in
 * scope for this audit cycle. Security (CC1-CC9) is always required;
 * the other four are operator-selected per the Description Criteria.
 */
export interface Soc2Scope {
  /** Service organization legal name. */
  organizationName: string;
  /** Audit period start, ISO 8601. SOC 2 Type II requires a 6-12 month period. */
  auditPeriodStart: string;
  /** Audit period end, ISO 8601. */
  auditPeriodEnd: string;
  /** Which TSC categories are in scope. Security is always implied. */
  inScope: Soc2Category[];
  /** Service auditor (CPA firm). */
  serviceAuditor?: string;
  /** Description of the service organization's services per AT-C § 105.10. */
  servicesDescription: string;
}

export type Soc2Category =
  | "security"
  | "availability"
  | "processing-integrity"
  | "confidentiality"
  | "privacy";

/**
 * Per-criterion evidence summary. Each AICPA TSC criterion (e.g.
 * CC6.1, A1.2, PI1.4) maps to a control objective. Receipts provide
 * the operational evidence that the control operated during the
 * audit period.
 */
export interface TscCriterionEvidence {
  /** Canonical criterion id, e.g. "CC6.1". */
  id: string;
  /** Parent category. */
  category: Soc2Category;
  /** Title from AICPA TSC 2017. */
  title: string;
  /** Brief description of the control objective. */
  objective: string;
  /** Receipts that evidence this criterion's operation. */
  evidenceCount: number;
  /** Period the evidence covers — first-to-last issuedAt of matching receipts. */
  evidencePeriod: {
    earliest: string | null;
    latest: string | null;
  };
  /**
   * Days-of-coverage in the audit period (0-365). Used by the auditor
   * to spot evidence gaps — e.g. a control that only fired in 1 month
   * of a 12-month audit period is a finding.
   */
  daysOfCoverage: number;
  /** Operator-assigned control owner (for the binder's RACI). */
  controlOwner?: string;
}

/**
 * The complete SOC 2 evidence binder report.
 */
export interface Soc2Report {
  /** Schema version. */
  schema: "vaos-soc2-evidence-v1";
  /** TSC version this report targets. */
  tscVersion: "2017";
  /** ISO 8601 of report generation. */
  generatedAt: string;
  /** Operator-supplied scope. */
  scope: Soc2Scope;
  /** Reporting window — equals auditPeriodStart..auditPeriodEnd. */
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
    durationDays: number;
  };
  /** All criteria with evidence counts. */
  criteria: TscCriterionEvidence[];
  /** Evidence-gap analysis. */
  gaps: TscCriterionEvidence[];
  /** Summary statistics. */
  summary: {
    criteriaTotal: number;
    criteriaWithEvidence: number;
    criteriaWithoutEvidence: number;
    averageDaysOfCoverage: number;
    coverageRate: number;
    byCategory: Record<Soc2Category, number>;
  };
}

/** Options controlling how the receipt set rolls into the binder. */
export interface BuildSoc2Options {
  scope: Soc2Scope;
  receipts: ReceiptRecord[];
  /** Map of criterion id → control owner (RACI). Unknown ids throw. */
  controlOwners?: Record<string, string>;
  /**
   * Coverage threshold (days) below which a criterion is flagged as
   * a gap. Default 30 (about a month) — a control that only fires in
   * one month of a 12-month audit is a real finding.
   */
  coverageThresholdDays?: number;
}

/**
 * AICPA Trust Service Criteria 2017 catalog. Ships every criterion
 * across all 5 categories (~60 criteria total in the 2017 TSC).
 *
 * Each entry maps to one or more Guardian-pack prefixes — when a
 * receipt's `pack` field starts with one of `evidencePackPrefixes`,
 * the criterion's evidenceCount increments.
 */
const TSC_CATALOG: Array<{
  id: string;
  category: Soc2Category;
  title: string;
  objective: string;
  evidencePackPrefixes: string[];
}> = [
  // ── Security (CC1-CC9) ──────────────────────────────────────────
  {
    id: "CC1.1",
    category: "security",
    title: "Control Environment — Integrity and Ethical Values",
    objective:
      "The entity demonstrates a commitment to integrity and ethical values.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC1.2",
    category: "security",
    title: "Control Environment — Board Oversight",
    objective:
      "The board of directors demonstrates independence from management and exercises oversight of internal control.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC1.3",
    category: "security",
    title: "Control Environment — Organizational Structure",
    objective:
      "Management establishes structures, reporting lines, and appropriate authorities and responsibilities.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC1.4",
    category: "security",
    title: "Control Environment — Personnel Competence",
    objective:
      "The entity demonstrates a commitment to attract, develop, and retain competent individuals.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC1.5",
    category: "security",
    title: "Control Environment — Accountability",
    objective:
      "The entity holds individuals accountable for their internal control responsibilities.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC2.1",
    category: "security",
    title: "Communication and Information — Information Quality",
    objective:
      "The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC2.2",
    category: "security",
    title: "Communication and Information — Internal Communication",
    objective:
      "The entity internally communicates information necessary to support the functioning of internal control.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC2.3",
    category: "security",
    title: "Communication and Information — External Communication",
    objective:
      "The entity communicates with external parties regarding matters affecting the functioning of internal control.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC3.1",
    category: "security",
    title: "Risk Assessment — Objectives",
    objective:
      "The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC3.2",
    category: "security",
    title: "Risk Assessment — Risk Identification",
    objective:
      "The entity identifies risks to the achievement of its objectives and analyzes risks as a basis for determining how the risks should be managed.",
    evidencePackPrefixes: ["owasp"],
  },
  {
    id: "CC3.3",
    category: "security",
    title: "Risk Assessment — Fraud Risk",
    objective:
      "The entity considers the potential for fraud in assessing risks to the achievement of objectives.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC3.4",
    category: "security",
    title: "Risk Assessment — Change Identification",
    objective:
      "The entity identifies and assesses changes that could significantly impact the system of internal control.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC4.1",
    category: "security",
    title: "Monitoring Activities — Ongoing Evaluations",
    objective:
      "The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC4.2",
    category: "security",
    title: "Monitoring Activities — Deficiency Evaluation",
    objective:
      "The entity evaluates and communicates internal control deficiencies in a timely manner.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC5.1",
    category: "security",
    title: "Control Activities — Selection and Development",
    objective:
      "The entity selects and develops control activities that contribute to the mitigation of risks.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC5.2",
    category: "security",
    title: "Control Activities — Technology Controls",
    objective:
      "The entity selects and develops general control activities over technology to support the achievement of objectives.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC5.3",
    category: "security",
    title: "Control Activities — Policies and Procedures",
    objective:
      "The entity deploys control activities through policies that establish what is expected and procedures that put policies into action.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.1",
    category: "security",
    title: "Logical and Physical Access Controls — Logical Access",
    objective:
      "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.2",
    category: "security",
    title: "Logical and Physical Access Controls — Access Authorization",
    objective:
      "Prior to issuing system credentials, the entity registers and authorizes new internal and external users.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.3",
    category: "security",
    title: "Logical and Physical Access Controls — Access Modification",
    objective:
      "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.4",
    category: "security",
    title: "Logical and Physical Access Controls — Physical Access",
    objective:
      "The entity restricts physical access to facilities and protected information assets.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.5",
    category: "security",
    title: "Logical and Physical Access Controls — Asset Disposal",
    objective:
      "The entity discontinues logical and physical protections over physical assets only after the ability to read or recover data and software from those assets has been diminished.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.6",
    category: "security",
    title: "Logical and Physical Access Controls — External Threats",
    objective:
      "The entity implements logical access security measures to protect against threats from sources outside its system boundaries.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.7",
    category: "security",
    title: "Logical and Physical Access Controls — Data Transmission",
    objective:
      "The entity restricts the transmission, movement, and removal of information.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC6.8",
    category: "security",
    title:
      "Logical and Physical Access Controls — Malicious Software Prevention",
    objective:
      "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC7.1",
    category: "security",
    title: "System Operations — Configuration Vulnerabilities",
    objective:
      "To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations that result in the introduction of new vulnerabilities.",
    evidencePackPrefixes: ["owasp"],
  },
  {
    id: "CC7.2",
    category: "security",
    title: "System Operations — Anomaly Monitoring",
    objective:
      "The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC7.3",
    category: "security",
    title: "System Operations — Security Event Evaluation",
    objective:
      "The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives and, if so, takes actions to prevent or address such failures.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC7.4",
    category: "security",
    title: "System Operations — Incident Response",
    objective:
      "The entity responds to identified security incidents by executing a defined incident response program to understand, contain, remediate, and communicate security incidents, as appropriate.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC7.5",
    category: "security",
    title: "System Operations — Incident Recovery",
    objective:
      "The entity identifies, develops, and implements activities to recover from identified security incidents.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC8.1",
    category: "security",
    title: "Change Management",
    objective:
      "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC9.1",
    category: "security",
    title: "Risk Mitigation — Risk Mitigation Activities",
    objective:
      "The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.",
    evidencePackPrefixes: [],
  },
  {
    id: "CC9.2",
    category: "security",
    title: "Risk Mitigation — Vendor and Business Partner Management",
    objective:
      "The entity assesses and manages risks associated with vendors and business partners.",
    evidencePackPrefixes: [],
  },

  // ── Availability (A1) ────────────────────────────────────────────
  {
    id: "A1.1",
    category: "availability",
    title: "Availability — Capacity",
    objective:
      "The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand.",
    evidencePackPrefixes: [],
  },
  {
    id: "A1.2",
    category: "availability",
    title: "Availability — Environmental Protection",
    objective:
      "The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure to meet its objectives.",
    evidencePackPrefixes: [],
  },
  {
    id: "A1.3",
    category: "availability",
    title: "Availability — Recovery Testing",
    objective:
      "The entity tests recovery plan procedures supporting system recovery to meet its objectives.",
    evidencePackPrefixes: [],
  },

  // ── Processing Integrity (PI1) ───────────────────────────────────
  {
    id: "PI1.1",
    category: "processing-integrity",
    title: "Processing Integrity — System Inputs",
    objective:
      "The entity obtains or generates, uses, and communicates relevant, quality information regarding the objectives related to processing.",
    evidencePackPrefixes: [],
  },
  {
    id: "PI1.2",
    category: "processing-integrity",
    title: "Processing Integrity — System Inputs Are Complete",
    objective:
      "The entity implements policies and procedures over system inputs, including controls over completeness and accuracy.",
    evidencePackPrefixes: [],
  },
  {
    id: "PI1.3",
    category: "processing-integrity",
    title: "Processing Integrity — System Processing",
    objective:
      "The entity implements policies and procedures over system processing to result in products, services, and reporting to meet the entity's objectives.",
    evidencePackPrefixes: [],
  },
  {
    id: "PI1.4",
    category: "processing-integrity",
    title: "Processing Integrity — System Outputs",
    objective:
      "The entity implements policies and procedures to make available or deliver output completely, accurately, and timely in accordance with specifications.",
    evidencePackPrefixes: [],
  },
  {
    id: "PI1.5",
    category: "processing-integrity",
    title: "Processing Integrity — Stored Items",
    objective:
      "The entity implements policies and procedures to store inputs, items in processing, and outputs completely, accurately, and timely in accordance with specifications.",
    evidencePackPrefixes: [],
  },

  // ── Confidentiality (C1) ─────────────────────────────────────────
  {
    id: "C1.1",
    category: "confidentiality",
    title: "Confidentiality — Identification and Maintenance",
    objective:
      "The entity identifies and maintains confidential information to meet the entity's objectives related to confidentiality.",
    evidencePackPrefixes: [],
  },
  {
    id: "C1.2",
    category: "confidentiality",
    title: "Confidentiality — Disposal",
    objective:
      "The entity disposes of confidential information to meet the entity's objectives related to confidentiality.",
    evidencePackPrefixes: [],
  },

  // ── Privacy (P-series) ───────────────────────────────────────────
  {
    id: "P1.1",
    category: "privacy",
    title: "Privacy — Notice",
    objective:
      "The entity provides notice to data subjects about its privacy practices.",
    evidencePackPrefixes: [],
  },
  {
    id: "P2.1",
    category: "privacy",
    title: "Privacy — Choice and Consent",
    objective:
      "The entity communicates choices available regarding the collection, use, retention, disclosure, and disposal of personal information.",
    evidencePackPrefixes: [],
  },
  {
    id: "P3.1",
    category: "privacy",
    title: "Privacy — Collection",
    objective:
      "Personal information is collected consistent with the entity's objectives related to privacy.",
    evidencePackPrefixes: [],
  },
  {
    id: "P4.1",
    category: "privacy",
    title: "Privacy — Use",
    objective:
      "The entity limits the use of personal information to the purposes identified in the entity's objectives.",
    evidencePackPrefixes: [],
  },
  {
    id: "P5.1",
    category: "privacy",
    title: "Privacy — Access",
    objective:
      "The entity grants identified and authenticated data subjects the ability to access their personal information.",
    evidencePackPrefixes: [],
  },
  {
    id: "P6.1",
    category: "privacy",
    title: "Privacy — Disclosure and Notification",
    objective:
      "The entity discloses personal information to third parties consistent with the entity's objectives related to privacy.",
    evidencePackPrefixes: [],
  },
  {
    id: "P7.1",
    category: "privacy",
    title: "Privacy — Quality",
    objective:
      "The entity collects and maintains accurate, up-to-date, complete, and relevant personal information.",
    evidencePackPrefixes: [],
  },
  {
    id: "P8.1",
    category: "privacy",
    title: "Privacy — Monitoring and Enforcement",
    objective:
      "The entity implements a process for receiving, addressing, resolving, and communicating the resolution of inquiries, complaints, and disputes from data subjects.",
    evidencePackPrefixes: [],
  },
];

/**
 * Build the SOC 2 evidence binder from a receipt set.
 */
export function buildSoc2Report(opts: BuildSoc2Options): Soc2Report {
  const {
    scope,
    receipts,
    controlOwners = {},
    coverageThresholdDays = 30,
  } = opts;
  const generatedAt = new Date().toISOString();

  // Validate control-owner keys against the canonical catalog —
  // fail loud on typos.
  const catalogIds = new Set(TSC_CATALOG.map((c) => c.id));
  const unknown = Object.keys(controlOwners).filter((k) => !catalogIds.has(k));
  if (unknown.length > 0) {
    throw new Error(
      `buildSoc2Report: controlOwners referenced unknown TSC criterion id(s): ${unknown.join(", ")}. Valid ids: ${[...catalogIds].sort().join(", ")}`,
    );
  }

  // Filter the catalog to in-scope categories. Security is always
  // implied; the operator opts into the other four.
  const inScope = new Set<Soc2Category>(["security", ...scope.inScope]);
  const applicableCatalog = TSC_CATALOG.filter((c) => inScope.has(c.category));

  // Audit period duration.
  const fromMs = Date.parse(scope.auditPeriodStart);
  const toMs = Date.parse(scope.auditPeriodEnd);
  const durationDays = Math.max(
    1,
    Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? Math.round((toMs - fromMs) / (24 * 3600 * 1000))
      : 1,
  );

  // Per-criterion evidence count + period coverage.
  const criteria: TscCriterionEvidence[] = applicableCatalog.map((cat) => {
    let evidenceCount = 0;
    let earliest: string | null = null;
    let latest: string | null = null;
    const evidenceDays = new Set<string>();
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? redactKeyMaterial(r.pack).toLowerCase() : "";
      if (!pack) continue;
      if (
        cat.evidencePackPrefixes.some((prefix) =>
          pack.startsWith(prefix.toLowerCase()),
        )
      ) {
        evidenceCount++;
        if (typeof r.issuedAt === "string") {
          if (earliest === null || r.issuedAt < earliest) earliest = r.issuedAt;
          if (latest === null || r.issuedAt > latest) latest = r.issuedAt;
          evidenceDays.add(r.issuedAt.slice(0, 10));
        }
      }
    }
    const result: TscCriterionEvidence = {
      id: cat.id,
      category: cat.category,
      title: cat.title,
      objective: cat.objective,
      evidenceCount,
      evidencePeriod: { earliest, latest },
      daysOfCoverage: evidenceDays.size,
    };
    if (controlOwners[cat.id]) {
      result.controlOwner = controlOwners[cat.id]!;
    }
    return result;
  });

  // Gap analysis — criteria with zero evidence OR with days-of-coverage
  // below the threshold.
  const gaps = criteria.filter(
    (c) => c.evidenceCount === 0 || c.daysOfCoverage < coverageThresholdDays,
  );

  // Summary stats.
  const criteriaWithEvidence = criteria.filter(
    (c) => c.evidenceCount > 0,
  ).length;
  const totalDays = criteria.reduce((s, c) => s + c.daysOfCoverage, 0);
  const averageDaysOfCoverage =
    criteria.length > 0 ? totalDays / criteria.length : 0;
  const coverageRate =
    criteria.length > 0 ? criteriaWithEvidence / criteria.length : 0;

  const byCategory: Record<Soc2Category, number> = {
    security: 0,
    availability: 0,
    "processing-integrity": 0,
    confidentiality: 0,
    privacy: 0,
  };
  for (const c of criteria) {
    if (c.evidenceCount > 0) byCategory[c.category]++;
  }

  return {
    schema: "vaos-soc2-evidence-v1",
    tscVersion: "2017",
    generatedAt,
    scope,
    reportingWindow: {
      from: scope.auditPeriodStart,
      to: scope.auditPeriodEnd,
      totalReceipts: receipts.length,
      durationDays,
    },
    criteria,
    gaps,
    summary: {
      criteriaTotal: criteria.length,
      criteriaWithEvidence,
      criteriaWithoutEvidence: criteria.length - criteriaWithEvidence,
      averageDaysOfCoverage,
      coverageRate,
      byCategory,
    },
  };
}

/**
 * Serialize the binder as Markdown — auditor-readable.
 */
export function toMarkdown(report: Soc2Report): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, "SOC 2 Evidence Binder");
  lines.push(
    `*Generated by @sovereign-matrix/soc2-evidence at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    `*This binder maps AICPA Trust Service Criteria (2017) to receipt-derived evidence over the audit period. Hand to your CPA firm as Period of Performance evidence under AT-C § 105 / SSAE 21.*`,
  );
  lines.push("");

  heading(2, "Scope");
  kv("Organization", report.scope.organizationName);
  kv(
    "Audit period",
    `${report.scope.auditPeriodStart} → ${report.scope.auditPeriodEnd}`,
  );
  kv("Duration", `${report.reportingWindow.durationDays} days`);
  kv("TSC version", report.tscVersion);
  kv(
    "Categories in scope",
    [
      "security (always required)",
      ...report.scope.inScope.filter((c) => c !== "security"),
    ].join(", "),
  );
  if (report.scope.serviceAuditor) {
    kv("Service auditor", report.scope.serviceAuditor);
  }
  kv("Services description", report.scope.servicesDescription);
  lines.push("");

  heading(2, "Summary");
  kv(
    "Criteria with evidence",
    `${report.summary.criteriaWithEvidence} / ${report.summary.criteriaTotal}`,
  );
  kv("Coverage rate", `${(report.summary.coverageRate * 100).toFixed(1)}%`);
  kv(
    "Average days of coverage",
    `${report.summary.averageDaysOfCoverage.toFixed(1)} of ${report.reportingWindow.durationDays}`,
  );
  kv("Total receipts", report.reportingWindow.totalReceipts);
  lines.push("");
  heading(3, "By category");
  for (const [k, v] of Object.entries(report.summary.byCategory)) {
    kv(k, `${v} criteria evidenced`);
  }
  lines.push("");

  // Group criteria by category for the binder.
  const categories: Soc2Category[] = [
    "security",
    "availability",
    "processing-integrity",
    "confidentiality",
    "privacy",
  ];
  for (const category of categories) {
    const subset = report.criteria.filter((c) => c.category === category);
    if (subset.length === 0) continue;
    heading(2, `${category.toUpperCase()} criteria`);
    lines.push("| ID | Title | Evidence | Days of coverage | Owner |");
    lines.push("|---|---|---|---|---|");
    for (const c of subset) {
      lines.push(
        `| \`${c.id}\` | ${c.title} | ${c.evidenceCount} | ${c.daysOfCoverage}/${report.reportingWindow.durationDays} | ${c.controlOwner ?? "-"} |`,
      );
    }
    lines.push("");
  }

  if (report.gaps.length > 0) {
    heading(2, "Evidence gaps");
    lines.push(
      "Criteria below the coverage threshold — these need either supplementary manual evidence or pack-coverage expansion before the next audit:",
    );
    lines.push("");
    for (const g of report.gaps) {
      lines.push(
        `- \`${g.id}\` (${g.title}) — ${g.evidenceCount} receipts, ${g.daysOfCoverage} days of coverage`,
      );
    }
    lines.push("");
  }

  heading(2, "Provenance");
  lines.push(
    `This binder was generated by [@sovereign-matrix/soc2-evidence](https://www.npmjs.com/package/@sovereign-matrix/soc2-evidence) v0.1.0, an Apache-2.0 open-source SOC 2 evidence-binder exporter. Each evidence count is derived from cryptographically-signed VAOS receipts — reproducible by the auditor against the same receipt set.`,
  );

  return lines.join("\n");
}

/**
 * Serialize as JSON — ingestible by PBC platforms.
 */
export function toJSON(report: Soc2Report): string {
  return JSON.stringify(report, null, 2);
}
