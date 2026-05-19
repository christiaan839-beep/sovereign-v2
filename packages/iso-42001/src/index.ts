/**
 * @sovereign-matrix/iso-42001
 *
 * ISO/IEC 42001:2023 AI management system (AIMS) exporter.
 *
 * ISO/IEC 42001:2023 is the world's first AI management-system
 * standard. Clauses 4-10 follow the canonical ISO Annex SL high-level
 * structure (Plan-Do-Check-Act), and Annex A lists 38 reference
 * controls organized in 9 control objectives (A.2-A.10).
 *
 * Most organizations seeking AIMS certification have to assemble
 * Clause 9 (performance evaluation) + Annex A control evidence by
 * hand. Closed-source vendors (Credo AI / Holistic AI / IBM
 * watsonx.governance) ship this for $50K-200K+/year. This package
 * is the Apache-2.0 open-source equivalent:
 *
 *   Clause 4 — Context of the organization      (operator-authored)
 *   Clause 5 — Leadership                        (operator-authored)
 *   Clause 6 — Planning                          (operator-authored)
 *   Clause 7 — Support                           (derived: §7.5 documented information from receipts)
 *   Clause 8 — Operation                         (derived: agent + pack inventory, verdict mix)
 *   Clause 9 — Performance evaluation            (derived: latency, block-rate, anomalies)
 *   Clause 10 — Improvement                      (derived: operator actions, distinct-control churn)
 *   Annex A — Reference controls (A.2-A.10)      (derived: control coverage from Guardian-pack tags)
 *
 * The derived sections are reproducible from the receipt set —
 * byte-identical numbers given byte-identical input. The
 * operator-authored sections emit structured stubs with
 * schema-hint references to the relevant ISO clause.
 *
 * Output formats:
 *   - Markdown (auditor-readable, archive-friendly)
 *   - JSON (machine-readable, ingestible by GRC tools)
 *
 * Apache 2.0. Zero runtime deps beyond @sovereign-matrix/verifiable-receipts.
 *
 * @packageDocumentation
 */

import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

/**
 * AIMS-level metadata that no receipt set can supply — the operator
 * fills these once per scope of certification and they roll into
 * every generated report.
 */
export interface AimsScope {
  /** Human-readable name of the AIMS scope. */
  organizationName: string;
  /** Scope statement per ISO/IEC 42001 § 4.3 (typically a one-paragraph description of which systems/processes are inside). */
  scopeStatement: string;
  /** AI-system role per Annex B classification: provider / user / partner / mixed. */
  aiSystemRole: "provider" | "user" | "partner" | "mixed";
  /** Certification body, if currently engaged (e.g. "BSI", "TUV SUD"). Optional. */
  certificationBody?: string;
  /** Last AIMS internal-audit date, ISO 8601. */
  lastInternalAudit?: string;
  /** Next scheduled management-review date, ISO 8601. */
  nextManagementReview?: string;
}

/**
 * Annex A control objectives and reference controls (ISO/IEC
 * 42001:2023 Annex A). Each entry tracks (a) the control id, (b)
 * whether it is applicable to this scope (per § 6.1.3 statement of
 * applicability), (c) the receipt-derived evidence count.
 */
export interface AnnexAControl {
  /** Control id, e.g. "A.6.2.1". */
  id: string;
  /** Control objective parent, e.g. "A.6 Planning". */
  objective: string;
  /** Short title from the standard. */
  title: string;
  /** Operator decision per § 6.1.3 — included in the statement of applicability? */
  applicable: boolean;
  /** Number of receipts that evidence this control. Derived from rule-pack tags. */
  evidenceCount: number;
  /** Optional rationale text (operator-authored). */
  rationale?: string;
}

/**
 * Structured ISO/IEC 42001 report. Each top-level key corresponds
 * to a clause of the standard; populated clauses carry a `summary`
 * + a `_derived` flag indicating whether the data came from receipts
 * (true) or operator narrative (false).
 */
export interface Iso42001Report {
  /** Schema version. Verifiers MUST tolerate additive fields. */
  schema: "vaos-iso-42001-v1";

  /** ISO 8601 of report generation. */
  generatedAt: string;

  /** Window the receipts in this report cover. */
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
  };

  /** Operator-supplied AIMS scope. */
  scope: AimsScope;

  /** Clause 4 Context of the organization. */
  clause4Context: ClauseStub;
  /** Clause 5 Leadership. */
  clause5Leadership: ClauseStub;
  /** Clause 6 Planning. */
  clause6Planning: ClauseStub;

  /** Clause 7 Support — DERIVED FROM RECEIPTS (§ 7.5 documented information). */
  clause7Support: {
    summary: string;
    documentedInformationCount: number;
    retentionWindowDays: number;
    integrityMechanism: string;
    derived: true;
  };

  /** Clause 8 Operation — DERIVED FROM RECEIPTS. */
  clause8Operation: {
    summary: string;
    agentsOperated: string[];
    packsApplied: string[];
    verdictCounts: { pass: number; warn: number; block: number };
    blockRate: number;
    derived: true;
  };

  /** Clause 9 Performance evaluation — DERIVED FROM RECEIPTS. */
  clause9Performance: {
    summary: string;
    p50LatencyMs: number | null;
    p99LatencyMs: number | null;
    receiptsPerDay: number;
    anomaliesDetected: number;
    derived: true;
  };

  /** Clause 10 Improvement — DERIVED FROM RECEIPTS + operator actions. */
  clause10Improvement: {
    summary: string;
    operatorActions: string[];
    distinctAgentsOverWindow: number;
    distinctPacksOverWindow: number;
    derived: true;
  };

  /** Annex A reference controls — DERIVED FROM PACK COVERAGE. */
  annexAControls: AnnexAControl[];
}

/**
 * Stub for operator-authored clauses 4-6. Carries schema hints
 * citing the relevant ISO clause so the operator (or downstream
 * GRC tooling) can pre-fill the structure.
 */
export interface ClauseStub {
  status: "operator-authored" | "draft" | "complete";
  /** Markdown content. Empty until the operator fills it. */
  content: string;
  /** External-reference URIs (e.g. uploaded PDFs of internal policies). */
  externalReferences: string[];
  /** Schema hint citing the ISO clause. */
  schemaHint: string;
  /** Always false for operator-authored sections. */
  derived: false;
}

/** Options controlling how the receipt set rolls into the report. */
export interface BuildIso42001Options {
  /** Operator-supplied AIMS scope. */
  scope: AimsScope;
  /** Receipts to summarize. Typically the last 365 days for AIMS surveillance audit. */
  receipts: ReceiptRecord[];
  /** Retention window for documented information (§ 7.5.3), in days. Default 365. */
  retentionDays?: number;
  /** Operator actions taken in response to anomalies, for Clause 10. */
  operatorActions?: string[];
  /**
   * Optional override of the Annex A applicability map. If omitted,
   * the exporter defaults all controls to `applicable: true`
   * (the conservative posture). Operator should override per their
   * § 6.1.3 statement of applicability.
   */
  applicabilityOverrides?: Record<string, boolean>;
}

/**
 * ISO/IEC 42001:2023 Annex A reference controls. Tracks the
 * canonical id + parent objective + short title for the 38 controls
 * in the standard. Operators can override applicability per their
 * scope's statement of applicability (§ 6.1.3).
 *
 * Controls are mapped to receipt evidence via Guardian-pack tags
 * — when a receipt's `pack` field starts with one of the
 * `evidencePackPrefixes` it counts toward the control. Operators
 * with custom packs can extend the map by post-processing the
 * `annexAControls` array.
 */
const ANNEX_A_CATALOG: Array<
  Omit<AnnexAControl, "applicable" | "evidenceCount"> & {
    evidencePackPrefixes: string[];
  }
> = [
  // A.2 Policies related to AI
  {
    id: "A.2.2",
    objective: "A.2 Policies related to AI",
    title: "AI policy",
    evidencePackPrefixes: ["iso42001", "ai-policy"],
  },
  {
    id: "A.2.3",
    objective: "A.2 Policies related to AI",
    title: "Alignment with other organizational policies",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.2.4",
    objective: "A.2 Policies related to AI",
    title: "Review of the AI policy",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.3 Internal organization
  {
    id: "A.3.2",
    objective: "A.3 Internal organization",
    title: "AI roles and responsibilities",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.3.3",
    objective: "A.3 Internal organization",
    title: "Reporting of concerns",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.4 Resources for AI systems
  {
    id: "A.4.2",
    objective: "A.4 Resources for AI systems",
    title: "Resource documentation",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.4.3",
    objective: "A.4 Resources for AI systems",
    title: "Data resources",
    evidencePackPrefixes: ["iso42001", "gdpr", "popia"],
  },
  {
    id: "A.4.4",
    objective: "A.4 Resources for AI systems",
    title: "Tooling resources",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.4.5",
    objective: "A.4 Resources for AI systems",
    title: "System and computing resources",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.4.6",
    objective: "A.4 Resources for AI systems",
    title: "Human resources",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.5 Assessing impacts of AI systems
  {
    id: "A.5.2",
    objective: "A.5 Assessing impacts of AI systems",
    title: "AI system impact assessment process",
    evidencePackPrefixes: ["iso42001", "euAiAct", "eu-ai-act"],
  },
  {
    id: "A.5.3",
    objective: "A.5 Assessing impacts of AI systems",
    title: "Documentation of AI system impact assessments",
    evidencePackPrefixes: ["iso42001", "euAiAct", "eu-ai-act"],
  },
  {
    id: "A.5.4",
    objective: "A.5 Assessing impacts of AI systems",
    title: "Assessing AI system impact on individuals and groups",
    evidencePackPrefixes: ["iso42001", "fairness"],
  },
  {
    id: "A.5.5",
    objective: "A.5 Assessing impacts of AI systems",
    title: "Assessing societal impacts",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.6 AI system life cycle
  {
    id: "A.6.1.2",
    objective: "A.6 AI system life cycle",
    title: "Objectives for responsible development of AI system",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.6.1.3",
    objective: "A.6 AI system life cycle",
    title: "Processes for responsible AI development",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.6.2.2",
    objective: "A.6 AI system life cycle",
    title: "AI system requirements and specification",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.6.2.3",
    objective: "A.6 AI system life cycle",
    title: "Documentation of AI system design and development",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.6.2.4",
    objective: "A.6 AI system life cycle",
    title: "AI system verification and validation",
    evidencePackPrefixes: ["iso42001", "owasp", "red-team"],
  },
  {
    id: "A.6.2.5",
    objective: "A.6 AI system life cycle",
    title: "AI system deployment",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.6.2.6",
    objective: "A.6 AI system life cycle",
    title: "AI system operation and monitoring",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.6.2.7",
    objective: "A.6 AI system life cycle",
    title: "AI system technical documentation",
    evidencePackPrefixes: ["iso42001", "euAiAct", "eu-ai-act"],
  },
  {
    id: "A.6.2.8",
    objective: "A.6 AI system life cycle",
    title: "AI system event logs",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.7 Data for AI systems
  {
    id: "A.7.2",
    objective: "A.7 Data for AI systems",
    title: "Data for development and enhancement of AI system",
    evidencePackPrefixes: ["iso42001", "gdpr", "popia"],
  },
  {
    id: "A.7.3",
    objective: "A.7 Data for AI systems",
    title: "Acquisition of data",
    evidencePackPrefixes: ["iso42001", "gdpr", "popia"],
  },
  {
    id: "A.7.4",
    objective: "A.7 Data for AI systems",
    title: "Quality of data for AI systems",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.7.5",
    objective: "A.7 Data for AI systems",
    title: "Data provenance",
    evidencePackPrefixes: ["iso42001", "c2pa"],
  },
  {
    id: "A.7.6",
    objective: "A.7 Data for AI systems",
    title: "Data preparation",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.8 Information for interested parties of AI systems
  {
    id: "A.8.2",
    objective: "A.8 Information for interested parties of AI systems",
    title: "System documentation and information for users",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.8.3",
    objective: "A.8 Information for interested parties of AI systems",
    title: "External reporting",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.8.4",
    objective: "A.8 Information for interested parties of AI systems",
    title: "Communication of incidents",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.8.5",
    objective: "A.8 Information for interested parties of AI systems",
    title: "Information for interested parties",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.9 Use of AI systems
  {
    id: "A.9.2",
    objective: "A.9 Use of AI systems",
    title: "Processes for responsible use of AI systems",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.9.3",
    objective: "A.9 Use of AI systems",
    title: "Objectives for responsible use of AI systems",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.9.4",
    objective: "A.9 Use of AI systems",
    title: "Intended use of AI systems",
    evidencePackPrefixes: ["iso42001"],
  },
  // A.10 Third-party and customer relationships
  {
    id: "A.10.2",
    objective: "A.10 Third-party and customer relationships",
    title: "Allocation of responsibilities",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.10.3",
    objective: "A.10 Third-party and customer relationships",
    title: "Suppliers",
    evidencePackPrefixes: ["iso42001"],
  },
  {
    id: "A.10.4",
    objective: "A.10 Third-party and customer relationships",
    title: "Customers",
    evidencePackPrefixes: ["iso42001"],
  },
];

/**
 * Build the structured ISO/IEC 42001 report from a receipt set.
 *
 * Read-only — does not mutate the input array. Returns the full
 * Iso42001Report; serialize via `toMarkdown()` or `toJSON()`.
 */
export function buildIso42001(opts: BuildIso42001Options): Iso42001Report {
  const {
    scope,
    receipts,
    retentionDays = 365,
    operatorActions = [],
    applicabilityOverrides = {},
  } = opts;
  const generatedAt = new Date().toISOString();

  // Validate override keys against the canonical catalog. A typoed key
  // (e.g. "A.99.99") silently no-opping would produce a wrong-and-confident
  // regulatory artifact — fail loud so the operator fixes the input.
  const catalogIds = new Set(ANNEX_A_CATALOG.map((c) => c.id));
  const unknown = Object.keys(applicabilityOverrides).filter(
    (k) => !catalogIds.has(k),
  );
  if (unknown.length > 0) {
    throw new Error(
      `buildIso42001: applicabilityOverrides referenced unknown control id(s): ${unknown.join(", ")}. Valid ids: ${[...catalogIds].sort().join(", ")}`,
    );
  }

  // Reporting window — earliest + latest issuedAt across receipts.
  const sortedTimestamps = receipts
    .map((r) => r.issuedAt)
    .filter((t): t is string => typeof t === "string")
    .sort();
  const from = sortedTimestamps[0] ?? generatedAt;
  const to = sortedTimestamps[sortedTimestamps.length - 1] ?? generatedAt;

  // Verdict counts + agent/pack inventory + latency + anomaly.
  let passCount = 0;
  let warnCount = 0;
  let blockCount = 0;
  let anomaliesDetected = 0;
  const agentsObserved = new Set<string>();
  const packsExercised = new Set<string>();
  const latencies: number[] = [];
  for (const r of receipts) {
    if (r.overall === "pass") passCount++;
    else if (r.overall === "warn") warnCount++;
    else if (r.overall === "block") blockCount++;
    if (typeof r.agentSlug === "string" && r.agentSlug) {
      agentsObserved.add(r.agentSlug);
    }
    if (typeof r.pack === "string" && r.pack) {
      packsExercised.add(r.pack);
    }
    const ms = (r as Record<string, unknown>).totalMs;
    if (typeof ms === "number" && Number.isFinite(ms)) {
      latencies.push(ms);
    }
    if ((r as Record<string, unknown>).anomalyKind) {
      anomaliesDetected++;
    }
  }
  const total = receipts.length;
  const blockRate = total > 0 ? blockCount / total : 0;
  latencies.sort((a, b) => a - b);
  const percentile = (arr: number[], pct: number): number | null => {
    if (arr.length === 0) return null;
    const idx = Math.min(arr.length - 1, Math.floor(arr.length * pct));
    return arr[idx];
  };
  const p50 = percentile(latencies, 0.5);
  const p99 = percentile(latencies, 0.99);

  // Receipts/day across the reporting window.
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const spanDays = Math.max(
    1,
    Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? (toMs - fromMs) / (24 * 3600 * 1000)
      : 1,
  );
  const receiptsPerDay = total / spanDays;

  // Annex A control evidence — pack prefix match.
  const annexAControls: AnnexAControl[] = ANNEX_A_CATALOG.map((catalog) => {
    let evidenceCount = 0;
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? r.pack.toLowerCase() : "";
      if (!pack) continue;
      if (
        catalog.evidencePackPrefixes.some((prefix) =>
          pack.startsWith(prefix.toLowerCase()),
        )
      ) {
        evidenceCount++;
      }
    }
    const overrideApplicable = applicabilityOverrides[catalog.id];
    return {
      id: catalog.id,
      objective: catalog.objective,
      title: catalog.title,
      applicable: overrideApplicable ?? true,
      evidenceCount,
    };
  });

  return {
    schema: "vaos-iso-42001-v1",
    generatedAt,
    reportingWindow: { from, to, totalReceipts: total },
    scope,
    clause4Context: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "ISO/IEC 42001:2023 § 4: identify external and internal issues, interested parties, AIMS scope. Cite § 4.1 (context), § 4.2 (interested parties), § 4.3 (scope), § 4.4 (AIMS).",
      derived: false,
    },
    clause5Leadership: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "ISO/IEC 42001:2023 § 5: top-management commitment, AI policy, organizational roles. Cite § 5.1 (leadership and commitment), § 5.2 (AI policy), § 5.3 (organizational roles, responsibilities, and authorities).",
      derived: false,
    },
    clause6Planning: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "ISO/IEC 42001:2023 § 6: actions to address risks and opportunities, AI system impact assessments, statement of applicability. Cite § 6.1 (actions to address risks and opportunities), § 6.1.3 (statement of applicability), § 6.2 (AI objectives), § 6.3 (planning of changes).",
      derived: false,
    },
    clause7Support: {
      summary: `Clause 7.5 Documented information: the AIMS maintains ${total} cryptographically-signed receipts over the reporting window. Each receipt is a single, append-only, integrity-protected record of one AI operation. Retention window: ${retentionDays} days from issuance. Integrity mechanism: Ed25519 + ML-DSA-65 dual-signing per VAOS v2/v3 wire format; transparency-log anchoring per RFC 9162.`,
      documentedInformationCount: total,
      retentionWindowDays: retentionDays,
      integrityMechanism:
        "Ed25519 + ML-DSA-65 dual-signature; RFC 9162 transparency-log anchored",
      derived: true,
    },
    clause8Operation: {
      summary: `Clause 8 Operation: ${total} operations were processed across ${agentsObserved.size} AI agents and ${packsExercised.size} Guardian rule packs over the reporting window. Verdict distribution: ${passCount} pass / ${warnCount} warn / ${blockCount} block (block-rate ${(blockRate * 100).toFixed(2)}%). Every operation traversed the same operational controls; deviations are recorded as block verdicts and roll into Clause 10 improvement.`,
      agentsOperated: [...agentsObserved].sort(),
      packsApplied: [...packsExercised].sort(),
      verdictCounts: { pass: passCount, warn: warnCount, block: blockCount },
      blockRate,
      derived: true,
    },
    clause9Performance: {
      summary: `Clause 9 Performance evaluation: ${receiptsPerDay.toFixed(2)} operations/day average. Latency p50 ${p50 ?? "n/a"} ms, p99 ${p99 ?? "n/a"} ms. ${anomaliesDetected} anomalies detected by the receipt-anomaly module (statistical outlier detection over block-rate spikes, rule-failure drift, volume bursts, quiet periods).`,
      p50LatencyMs: p50,
      p99LatencyMs: p99,
      receiptsPerDay,
      anomaliesDetected,
      derived: true,
    },
    clause10Improvement: {
      summary: `Clause 10 Improvement: ${operatorActions.length} corrective and continual-improvement actions were taken over the reporting window. ${agentsObserved.size} distinct agents and ${packsExercised.size} distinct Guardian packs were exercised, reflecting AIMS scope evolution.`,
      operatorActions,
      distinctAgentsOverWindow: agentsObserved.size,
      distinctPacksOverWindow: packsExercised.size,
      derived: true,
    },
    annexAControls,
  };
}

/**
 * Serialize the ISO/IEC 42001 report as Markdown — auditor-readable,
 * archive-friendly. Intended to be the file you hand to your
 * certification body or external auditor.
 */
export function toMarkdown(report: Iso42001Report): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, `ISO/IEC 42001:2023 — AI Management System Report`);
  lines.push(
    `*Generated by @sovereign-matrix/iso-42001 at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*This document maps the AIMS clauses (4-10) and Annex A reference controls to receipt-derived evidence. Sections marked **OPERATOR-AUTHORED** must be completed by the AIMS owner before audit submission.*",
  );
  lines.push("");

  heading(2, "Scope");
  kv("Organization", report.scope.organizationName);
  kv("AI system role", report.scope.aiSystemRole);
  kv("Scope statement", report.scope.scopeStatement);
  if (report.scope.certificationBody) {
    kv("Certification body", report.scope.certificationBody);
  }
  if (report.scope.lastInternalAudit) {
    kv("Last internal audit", report.scope.lastInternalAudit);
  }
  if (report.scope.nextManagementReview) {
    kv("Next management review", report.scope.nextManagementReview);
  }
  lines.push("");

  heading(2, "Reporting window");
  kv("From", report.reportingWindow.from);
  kv("To", report.reportingWindow.to);
  kv("Total receipts", report.reportingWindow.totalReceipts);
  lines.push("");

  // Clauses 4-6 (operator-authored)
  for (const [label, clause] of [
    ["§ 4 Context of the organization", report.clause4Context],
    ["§ 5 Leadership", report.clause5Leadership],
    ["§ 6 Planning", report.clause6Planning],
  ] as const) {
    heading(2, label);
    lines.push(`**OPERATOR-AUTHORED** — *${clause.schemaHint}*`);
    lines.push("");
    lines.push(clause.content || "_(to be completed)_");
    lines.push("");
  }

  // Clause 7 Support
  heading(2, "§ 7 Support");
  lines.push(report.clause7Support.summary);
  lines.push("");
  kv(
    "Documented information count",
    report.clause7Support.documentedInformationCount,
  );
  kv("Retention window (days)", report.clause7Support.retentionWindowDays);
  kv("Integrity mechanism", report.clause7Support.integrityMechanism);
  lines.push("");

  // Clause 8 Operation
  heading(2, "§ 8 Operation");
  lines.push(report.clause8Operation.summary);
  lines.push("");
  kv("Pass", report.clause8Operation.verdictCounts.pass);
  kv("Warn", report.clause8Operation.verdictCounts.warn);
  kv("Block", report.clause8Operation.verdictCounts.block);
  kv("Block-rate", `${(report.clause8Operation.blockRate * 100).toFixed(2)}%`);
  lines.push("");
  heading(3, "Agents operated");
  for (const a of report.clause8Operation.agentsOperated) {
    lines.push(`- \`${a}\``);
  }
  lines.push("");
  heading(3, "Guardian rule packs applied");
  for (const p of report.clause8Operation.packsApplied) {
    lines.push(`- \`${p}\``);
  }
  lines.push("");

  // Clause 9 Performance evaluation
  heading(2, "§ 9 Performance evaluation");
  lines.push(report.clause9Performance.summary);
  lines.push("");
  kv("Receipts/day", report.clause9Performance.receiptsPerDay.toFixed(2));
  kv("p50 latency (ms)", report.clause9Performance.p50LatencyMs ?? "n/a");
  kv("p99 latency (ms)", report.clause9Performance.p99LatencyMs ?? "n/a");
  kv("Anomalies detected", report.clause9Performance.anomaliesDetected);
  lines.push("");

  // Clause 10 Improvement
  heading(2, "§ 10 Improvement");
  lines.push(report.clause10Improvement.summary);
  lines.push("");
  kv(
    "Distinct agents over window",
    report.clause10Improvement.distinctAgentsOverWindow,
  );
  kv(
    "Distinct packs over window",
    report.clause10Improvement.distinctPacksOverWindow,
  );
  if (report.clause10Improvement.operatorActions.length > 0) {
    heading(3, "Operator actions taken");
    for (const a of report.clause10Improvement.operatorActions) {
      lines.push(`- ${a}`);
    }
    lines.push("");
  }

  // Annex A reference controls
  heading(2, "Annex A — Reference controls");
  lines.push("| Control | Objective | Title | Applicable | Evidence count |");
  lines.push("|---|---|---|---|---|");
  for (const c of report.annexAControls) {
    lines.push(
      `| \`${c.id}\` | ${c.objective} | ${c.title} | ${c.applicable ? "Yes" : "No"} | ${c.evidenceCount} |`,
    );
  }
  lines.push("");

  heading(2, "Provenance");
  lines.push(
    `This report was generated by [@sovereign-matrix/iso-42001](https://www.npmjs.com/package/@sovereign-matrix/iso-42001) v0.1.0, an Apache-2.0 open-source ISO/IEC 42001:2023 AIMS exporter. Clauses 7-10 + Annex A evidence counts are derived directly from cryptographically-signed VAOS receipts; clauses 4-6 require operator narrative. Every claim is reproducible from the receipt set.`,
  );

  return lines.join("\n");
}

/**
 * Serialize as JSON — machine-readable, ingestible by GRC tooling.
 * Schema-versioned via `schema: "vaos-iso-42001-v1"`.
 */
export function toJSON(report: Iso42001Report): string {
  return JSON.stringify(report, null, 2);
}
