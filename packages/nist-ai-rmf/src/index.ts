/**
 * @sovereign-matrix/nist-ai-rmf
 *
 * NIST AI Risk Management Framework 1.0 profile exporter.
 *
 * The NIST AI RMF (Artificial Intelligence Risk Management Framework
 * 1.0, NIST AI 100-1, published January 2023) is the de-facto US
 * federal procurement standard for AI risk management. The framework
 * is organized around four functions:
 *
 *   GOVERN   — policies, processes, accountability that cultivate the
 *              culture of risk management across the AI lifecycle
 *   MAP      — identify the context and the risks that exist in that
 *              context
 *   MEASURE  — quantitative + qualitative assessment of identified risks
 *   MANAGE   — risk treatment, monitoring, and continuous improvement
 *
 * Each function is decomposed into a set of categories (e.g.
 * GOVERN-1, GOVERN-2, ...) and subcategories (e.g. GOVERN-1.1) with
 * specific outcomes. The framework also defines four characteristics
 * of trustworthy AI: valid and reliable, safe, secure and resilient,
 * accountable and transparent, explainable and interpretable, privacy-
 * enhanced, fair (with bias managed).
 *
 * This package consumes a set of VAOS Guardian receipts and emits a
 * Profile-style report mapping evidence to each subcategory. Closed-
 * source GRC vendors ship the equivalent for $50K-200K+/year; this is
 * the Apache-2.0 open-source reference implementation.
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
 * Profile-level descriptors that no receipt set can supply — the
 * operator fills these once per AI use case and they roll into every
 * generated report.
 */
export interface RmfProfileScope {
  /** Human-readable name of the AI system or use case. */
  systemName: string;
  /** AI lifecycle stage per NIST AI RMF Appendix B: design / development / deployment / operation / monitoring / decommissioning. */
  lifecycleStage:
    | "design"
    | "development"
    | "deployment"
    | "operation"
    | "monitoring"
    | "decommissioning";
  /** Organizational role per NIST AI RMF: AI Actor function (operator / acquirer / end-user / etc). */
  organizationalRole: string;
  /** Profile type: current state, target state, or both. */
  profileType: "current" | "target" | "current-and-target";
  /** Intended use of the AI system (1-paragraph free-text). */
  intendedUse: string;
  /** Risk tolerance per § 5: low / medium / high. */
  riskTolerance: "low" | "medium" | "high";
}

/**
 * NIST AI RMF subcategory with receipt-derived evidence. Each entry
 * tracks (a) the canonical id (e.g. GOVERN-1.1), (b) which characteristic
 * of trustworthy AI it most directly maps to, (c) the number of receipts
 * that evidence the outcome.
 */
export interface RmfSubcategory {
  /** Canonical id, e.g. "GOVERN-1.1". */
  id: string;
  /** Parent function: GOVERN | MAP | MEASURE | MANAGE. */
  function: RmfFunction;
  /** Parent category id, e.g. "GOVERN-1". */
  category: string;
  /** Outcome description from NIST AI RMF. */
  outcome: string;
  /** Receipt-derived evidence count. */
  evidenceCount: number;
  /** Which trustworthy-AI characteristic this subcategory primarily supports. */
  characteristic: TrustworthyAiCharacteristic;
  /** Operator's self-assessment of maturity: 0 = not implemented, 4 = optimized. */
  maturityLevel?: 0 | 1 | 2 | 3 | 4;
}

export type RmfFunction = "GOVERN" | "MAP" | "MEASURE" | "MANAGE";

export type TrustworthyAiCharacteristic =
  | "valid-and-reliable"
  | "safe"
  | "secure-and-resilient"
  | "accountable-and-transparent"
  | "explainable-and-interpretable"
  | "privacy-enhanced"
  | "fair-with-bias-managed";

/**
 * Structured NIST AI RMF profile report.
 */
export interface RmfReport {
  /** Schema version. Verifiers MUST tolerate additive fields. */
  schema: "vaos-nist-ai-rmf-v1";
  /** Framework version this report targets. */
  frameworkVersion: "1.0";
  /** ISO 8601 of report generation. */
  generatedAt: string;
  /** Window the receipts in this report cover. */
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
  };
  /** Operator-supplied scope. */
  scope: RmfProfileScope;

  /** GOVERN function summary. */
  govern: FunctionSummary;
  /** MAP function summary. */
  map: FunctionSummary;
  /** MEASURE function summary. */
  measure: FunctionSummary;
  /** MANAGE function summary. */
  manage: FunctionSummary;

  /** All subcategories with evidence counts. */
  subcategories: RmfSubcategory[];

  /** Coverage statistics. */
  coverage: {
    subcategoriesWithEvidence: number;
    subcategoriesWithoutEvidence: number;
    coverageRate: number;
    byFunction: Record<RmfFunction, number>;
    byCharacteristic: Record<TrustworthyAiCharacteristic, number>;
  };
}

/**
 * Per-function summary. Derived from receipts that match the
 * function's subcategories.
 */
export interface FunctionSummary {
  /** Function id. */
  function: RmfFunction;
  /** One-paragraph narrative summary. */
  summary: string;
  /** Total subcategories under this function. */
  subcategoryCount: number;
  /** Subcategories with at least one receipt of evidence. */
  evidenced: number;
  /** Total receipts attributable to this function. */
  totalReceipts: number;
  /** Operator-authored narrative content (optional). */
  operatorNarrative?: string;
}

/**
 * Options controlling how the receipt set rolls into the report.
 */
export interface BuildRmfOptions {
  scope: RmfProfileScope;
  receipts: ReceiptRecord[];
  /**
   * Optional maturity-level overrides per subcategory id. Operator's
   * self-assessment on the 0-4 scale per § 5.4 of NIST AI RMF Playbook.
   * Unknown ids throw — fail-loud per Wave 79 review pattern.
   */
  maturityOverrides?: Record<string, 0 | 1 | 2 | 3 | 4>;
  /** Operator-authored narrative content for each function. */
  functionNarratives?: Partial<Record<RmfFunction, string>>;
}

/**
 * Canonical NIST AI RMF subcategory catalog. The framework defines
 * ~70 subcategories across 4 functions. This catalog ships the
 * highest-frequency ~50 that map cleanly to receipt-derived evidence.
 *
 * Each entry maps to one or more Guardian-pack prefixes — when a
 * receipt's `pack` field starts with one of `evidencePackPrefixes`,
 * the subcategory's evidenceCount increments. Pack prefixes match
 * case-insensitively.
 */
const RMF_SUBCATEGORY_CATALOG: Array<{
  id: string;
  function: RmfFunction;
  category: string;
  outcome: string;
  characteristic: TrustworthyAiCharacteristic;
  evidencePackPrefixes: string[];
}> = [
  // ── GOVERN ───────────────────────────────────────────────────────
  {
    id: "GOVERN-1.1",
    function: "GOVERN",
    category: "GOVERN-1",
    outcome:
      "Legal and regulatory requirements involving AI are understood, managed, and documented.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "euaiact", "eu-ai-act", "iso42001"],
  },
  {
    id: "GOVERN-1.2",
    function: "GOVERN",
    category: "GOVERN-1",
    outcome:
      "The characteristics of trustworthy AI are integrated into organizational policies.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001"],
  },
  {
    id: "GOVERN-1.3",
    function: "GOVERN",
    category: "GOVERN-1",
    outcome:
      "Processes, procedures, and practices for AI risks are defined and documented.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001"],
  },
  {
    id: "GOVERN-2.1",
    function: "GOVERN",
    category: "GOVERN-2",
    outcome:
      "Roles and responsibilities related to AI risks are documented and communicated.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001"],
  },
  {
    id: "GOVERN-3.2",
    function: "GOVERN",
    category: "GOVERN-3",
    outcome:
      "Policies and procedures are in place to define and differentiate roles for human-AI configurations.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "human-in-loop"],
  },
  {
    id: "GOVERN-4.1",
    function: "GOVERN",
    category: "GOVERN-4",
    outcome:
      "Organizational practices are in place to foster a critical thinking and safety-first mindset.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "GOVERN-4.2",
    function: "GOVERN",
    category: "GOVERN-4",
    outcome:
      "Organizational teams document the risks and potential impacts of the AI technology they design.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001", "euaiact", "eu-ai-act"],
  },
  {
    id: "GOVERN-5.1",
    function: "GOVERN",
    category: "GOVERN-5",
    outcome:
      "Mechanisms are in place to collect, consider, and prioritize input from AI actors.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "GOVERN-6.1",
    function: "GOVERN",
    category: "GOVERN-6",
    outcome:
      "Policies and procedures are in place to address AI risks and benefits arising from third-party software and data.",
    characteristic: "secure-and-resilient",
    evidencePackPrefixes: ["nist-ai-rmf", "supply-chain", "owasp"],
  },

  // ── MAP ──────────────────────────────────────────────────────────
  {
    id: "MAP-1.1",
    function: "MAP",
    category: "MAP-1",
    outcome:
      "Intended purposes, potentially beneficial uses, context-specific laws, norms and expectations are understood and documented.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001", "euaiact", "eu-ai-act"],
  },
  {
    id: "MAP-1.5",
    function: "MAP",
    category: "MAP-1",
    outcome: "Organizational risk tolerances are determined and documented.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001"],
  },
  {
    id: "MAP-2.1",
    function: "MAP",
    category: "MAP-2",
    outcome:
      "The specific task and the methods used to implement the task are defined.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MAP-2.2",
    function: "MAP",
    category: "MAP-2",
    outcome:
      "Information about the AI system's knowledge limits and how outputs may be utilized is documented.",
    characteristic: "explainable-and-interpretable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MAP-3.1",
    function: "MAP",
    category: "MAP-3",
    outcome:
      "Potential benefits of intended AI system functionality and performance are examined and documented.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MAP-3.4",
    function: "MAP",
    category: "MAP-3",
    outcome:
      "Processes for operator and practitioner proficiency with AI system performance and trustworthiness are defined.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MAP-4.1",
    function: "MAP",
    category: "MAP-4",
    outcome:
      "Approaches for mapping AI technology and legal risks of components are defined.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MAP-5.1",
    function: "MAP",
    category: "MAP-5",
    outcome:
      "Likelihood and magnitude of each identified impact (positive and negative) are identified.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf", "owasp"],
  },

  // ── MEASURE ──────────────────────────────────────────────────────
  {
    id: "MEASURE-1.1",
    function: "MEASURE",
    category: "MEASURE-1",
    outcome: "Approaches and metrics for measurement of AI risks are selected.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-2.1",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "Test sets, metrics, and details about the tools used during test, evaluation, validation, and verification are documented.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf", "owasp", "red-team"],
  },
  {
    id: "MEASURE-2.2",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "Evaluations involving human subjects meet applicable requirements and are representative of the relevant population.",
    characteristic: "fair-with-bias-managed",
    evidencePackPrefixes: ["nist-ai-rmf", "fairness"],
  },
  {
    id: "MEASURE-2.3",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "AI system performance or assurance criteria are measured qualitatively or quantitatively.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-2.4",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "The functionality and behavior of the AI system are monitored when in production.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001"],
  },
  {
    id: "MEASURE-2.5",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "The AI system to be deployed is demonstrated to be valid and reliable.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-2.6",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome: "The AI system is evaluated regularly for safety risks.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf", "owasp"],
  },
  {
    id: "MEASURE-2.7",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome: "AI system security and resilience are evaluated and documented.",
    characteristic: "secure-and-resilient",
    evidencePackPrefixes: ["nist-ai-rmf", "owasp", "red-team"],
  },
  {
    id: "MEASURE-2.8",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "Risks associated with transparency and accountability are measured.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-2.9",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "The AI model is explained, validated, and documented, and AI system output is interpreted within its context.",
    characteristic: "explainable-and-interpretable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-2.10",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome: "Privacy risk of the AI system is examined and documented.",
    characteristic: "privacy-enhanced",
    evidencePackPrefixes: ["nist-ai-rmf", "gdpr", "popia", "hipaa"],
  },
  {
    id: "MEASURE-2.11",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "Fairness and bias — as identified in MAP function — are evaluated and results are documented.",
    characteristic: "fair-with-bias-managed",
    evidencePackPrefixes: ["nist-ai-rmf", "fairness"],
  },
  {
    id: "MEASURE-2.12",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "Environmental impact and sustainability of AI model training and management activities are assessed and documented.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-2.13",
    function: "MEASURE",
    category: "MEASURE-2",
    outcome:
      "Effectiveness of the employed TEVV metrics and processes is evaluated.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-3.1",
    function: "MEASURE",
    category: "MEASURE-3",
    outcome:
      "Approaches, personnel, and documentation are in place to regularly identify and track existing, unanticipated, and emergent AI risks.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-3.2",
    function: "MEASURE",
    category: "MEASURE-3",
    outcome:
      "Risk tracking approaches are considered for settings where AI risks are difficult to assess using currently available measurement techniques.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-3.3",
    function: "MEASURE",
    category: "MEASURE-3",
    outcome:
      "Feedback processes for end users and impacted communities to report problems and appeal system outcomes are established and integrated into AI system evaluation metrics.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-4.1",
    function: "MEASURE",
    category: "MEASURE-4",
    outcome:
      "Measurement approaches for identifying AI risks are connected to deployment context(s) and informed through consultation with domain experts and other end users.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-4.2",
    function: "MEASURE",
    category: "MEASURE-4",
    outcome:
      "Measurement results regarding AI system trustworthiness in deployment context(s) and across the AI lifecycle are informed by input from domain experts and relevant AI actors to validate whether the system is performing consistently.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MEASURE-4.3",
    function: "MEASURE",
    category: "MEASURE-4",
    outcome:
      "Measurable performance improvements or declines based on consultations with relevant AI actors, including affected communities, and field data are identified and documented.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },

  // ── MANAGE ───────────────────────────────────────────────────────
  {
    id: "MANAGE-1.1",
    function: "MANAGE",
    category: "MANAGE-1",
    outcome:
      "A determination is made as to whether the AI system achieves its intended purposes and stated objectives and whether its development or deployment should proceed.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-1.2",
    function: "MANAGE",
    category: "MANAGE-1",
    outcome:
      "Treatment of documented AI risks is prioritized based on impact, likelihood, and available resources or methods.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-1.3",
    function: "MANAGE",
    category: "MANAGE-1",
    outcome:
      "Responses to the AI risks deemed high priority, as identified by the MAP function, are developed, planned, and documented.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-1.4",
    function: "MANAGE",
    category: "MANAGE-1",
    outcome:
      "Negative residual risks (defined as risks remaining after risk treatment) to both downstream acquirers of AI systems and end users are documented.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-2.1",
    function: "MANAGE",
    category: "MANAGE-2",
    outcome: "Resources required to manage AI risks are taken into account.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-2.2",
    function: "MANAGE",
    category: "MANAGE-2",
    outcome:
      "Mechanisms are in place and applied to sustain the value of deployed AI systems.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-2.3",
    function: "MANAGE",
    category: "MANAGE-2",
    outcome:
      "Procedures are followed to respond to and recover from a previously unknown risk when it is identified.",
    characteristic: "secure-and-resilient",
    evidencePackPrefixes: ["nist-ai-rmf", "incident-response"],
  },
  {
    id: "MANAGE-2.4",
    function: "MANAGE",
    category: "MANAGE-2",
    outcome:
      "Mechanisms are in place and applied, and responsibilities are assigned and understood, to supersede, disengage, or deactivate AI systems that demonstrate performance or outcomes inconsistent with intended use.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf", "kill-switch"],
  },
  {
    id: "MANAGE-3.1",
    function: "MANAGE",
    category: "MANAGE-3",
    outcome:
      "AI risks and benefits from third-party resources are regularly monitored.",
    characteristic: "secure-and-resilient",
    evidencePackPrefixes: ["nist-ai-rmf", "supply-chain"],
  },
  {
    id: "MANAGE-3.2",
    function: "MANAGE",
    category: "MANAGE-3",
    outcome:
      "Pre-trained models which are used for development are monitored as part of AI system regular monitoring and maintenance.",
    characteristic: "secure-and-resilient",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-4.1",
    function: "MANAGE",
    category: "MANAGE-4",
    outcome:
      "Post-deployment AI system monitoring plans are implemented, including mechanisms for capturing and evaluating input from users and other relevant AI actors.",
    characteristic: "safe",
    evidencePackPrefixes: ["nist-ai-rmf", "iso42001"],
  },
  {
    id: "MANAGE-4.2",
    function: "MANAGE",
    category: "MANAGE-4",
    outcome:
      "Measurable activities for continual improvements are integrated into AI system updates and include regular engagement with interested parties.",
    characteristic: "valid-and-reliable",
    evidencePackPrefixes: ["nist-ai-rmf"],
  },
  {
    id: "MANAGE-4.3",
    function: "MANAGE",
    category: "MANAGE-4",
    outcome:
      "Incidents and errors are communicated to relevant AI actors including affected communities.",
    characteristic: "accountable-and-transparent",
    evidencePackPrefixes: ["nist-ai-rmf", "incident-response"],
  },
];

/**
 * Build the structured NIST AI RMF profile report from a receipt set.
 */
export function buildNistAiRmf(opts: BuildRmfOptions): RmfReport {
  const {
    scope,
    receipts,
    maturityOverrides = {},
    functionNarratives = {},
  } = opts;
  const generatedAt = new Date().toISOString();

  // Validate maturity override keys against the canonical catalog.
  // Per Wave 79 review pattern — fail loud on unknown ids so the
  // operator sees their typo before the regulator does.
  const catalogIds = new Set(RMF_SUBCATEGORY_CATALOG.map((c) => c.id));
  const unknown = Object.keys(maturityOverrides).filter(
    (k) => !catalogIds.has(k),
  );
  if (unknown.length > 0) {
    throw new Error(
      `buildNistAiRmf: maturityOverrides referenced unknown subcategory id(s): ${unknown.join(", ")}. Valid ids: ${[...catalogIds].sort().join(", ")}`,
    );
  }

  // Reporting window.
  const sortedTimestamps = receipts
    .map((r) => r.issuedAt)
    .filter((t): t is string => typeof t === "string")
    .sort();
  const from = sortedTimestamps[0] ?? generatedAt;
  const to = sortedTimestamps[sortedTimestamps.length - 1] ?? generatedAt;

  // Per-subcategory evidence count via pack-prefix match.
  const subcategories: RmfSubcategory[] = RMF_SUBCATEGORY_CATALOG.map((cat) => {
    let evidenceCount = 0;
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? r.pack.toLowerCase() : "";
      if (!pack) continue;
      if (
        cat.evidencePackPrefixes.some((prefix) =>
          pack.startsWith(prefix.toLowerCase()),
        )
      ) {
        evidenceCount++;
      }
    }
    const sub: RmfSubcategory = {
      id: cat.id,
      function: cat.function,
      category: cat.category,
      outcome: cat.outcome,
      evidenceCount,
      characteristic: cat.characteristic,
    };
    if (maturityOverrides[cat.id] !== undefined) {
      sub.maturityLevel = maturityOverrides[cat.id];
    }
    return sub;
  });

  // Per-function summary.
  const buildFunctionSummary = (fn: RmfFunction): FunctionSummary => {
    const subs = subcategories.filter((s) => s.function === fn);
    const evidenced = subs.filter((s) => s.evidenceCount > 0).length;
    const totalReceipts = subs.reduce((sum, s) => sum + s.evidenceCount, 0);
    const summary = `${fn}: ${evidenced} of ${subs.length} subcategories have receipt-derived evidence over the reporting window. ${totalReceipts} receipts attributable to this function (a single receipt can evidence multiple subcategories via shared pack tags).`;
    const result: FunctionSummary = {
      function: fn,
      summary,
      subcategoryCount: subs.length,
      evidenced,
      totalReceipts,
    };
    if (functionNarratives[fn]) {
      result.operatorNarrative = functionNarratives[fn]!;
    }
    return result;
  };

  // Coverage stats.
  const subcategoriesWithEvidence = subcategories.filter(
    (s) => s.evidenceCount > 0,
  ).length;
  const subcategoriesWithoutEvidence =
    subcategories.length - subcategoriesWithEvidence;
  const coverageRate =
    subcategories.length > 0
      ? subcategoriesWithEvidence / subcategories.length
      : 0;

  const byFunction: Record<RmfFunction, number> = {
    GOVERN: 0,
    MAP: 0,
    MEASURE: 0,
    MANAGE: 0,
  };
  const byCharacteristic: Record<TrustworthyAiCharacteristic, number> = {
    "valid-and-reliable": 0,
    safe: 0,
    "secure-and-resilient": 0,
    "accountable-and-transparent": 0,
    "explainable-and-interpretable": 0,
    "privacy-enhanced": 0,
    "fair-with-bias-managed": 0,
  };
  for (const s of subcategories) {
    if (s.evidenceCount > 0) {
      byFunction[s.function]++;
      byCharacteristic[s.characteristic]++;
    }
  }

  return {
    schema: "vaos-nist-ai-rmf-v1",
    frameworkVersion: "1.0",
    generatedAt,
    reportingWindow: { from, to, totalReceipts: receipts.length },
    scope,
    govern: buildFunctionSummary("GOVERN"),
    map: buildFunctionSummary("MAP"),
    measure: buildFunctionSummary("MEASURE"),
    manage: buildFunctionSummary("MANAGE"),
    subcategories,
    coverage: {
      subcategoriesWithEvidence,
      subcategoriesWithoutEvidence,
      coverageRate,
      byFunction,
      byCharacteristic,
    },
  };
}

/**
 * Serialize the report as Markdown — auditor-readable, archive-friendly.
 */
export function toMarkdown(report: RmfReport): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, "NIST AI Risk Management Framework 1.0 — Profile Report");
  lines.push(
    `*Generated by @sovereign-matrix/nist-ai-rmf at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    `*This report maps the NIST AI RMF 1.0 (NIST AI 100-1, January 2023) functions (GOVERN, MAP, MEASURE, MANAGE) and subcategories to receipt-derived evidence. Profile type: **${report.scope.profileType}**.*`,
  );
  lines.push("");

  heading(2, "Scope");
  kv("System", report.scope.systemName);
  kv("Lifecycle stage", report.scope.lifecycleStage);
  kv("Organizational role", report.scope.organizationalRole);
  kv("Profile type", report.scope.profileType);
  kv("Risk tolerance", report.scope.riskTolerance);
  kv("Intended use", report.scope.intendedUse);
  lines.push("");

  heading(2, "Reporting window");
  kv("From", report.reportingWindow.from);
  kv("To", report.reportingWindow.to);
  kv("Total receipts", report.reportingWindow.totalReceipts);
  lines.push("");

  heading(2, "Coverage summary");
  kv(
    "Subcategories with evidence",
    `${report.coverage.subcategoriesWithEvidence} / ${report.subcategories.length}`,
  );
  kv("Coverage rate", `${(report.coverage.coverageRate * 100).toFixed(1)}%`);
  lines.push("");
  heading(3, "By function");
  for (const fn of ["GOVERN", "MAP", "MEASURE", "MANAGE"] as RmfFunction[]) {
    kv(fn, `${report.coverage.byFunction[fn]} subcategories evidenced`);
  }
  lines.push("");

  heading(3, "By trustworthy-AI characteristic");
  for (const [k, v] of Object.entries(report.coverage.byCharacteristic)) {
    kv(k, `${v} subcategories evidenced`);
  }
  lines.push("");

  // Each function section.
  for (const fn of ["GOVERN", "MAP", "MEASURE", "MANAGE"] as RmfFunction[]) {
    const summary =
      fn === "GOVERN"
        ? report.govern
        : fn === "MAP"
          ? report.map
          : fn === "MEASURE"
            ? report.measure
            : report.manage;
    heading(2, `${fn} function`);
    lines.push(summary.summary);
    lines.push("");
    if (summary.operatorNarrative) {
      heading(3, "Operator narrative");
      lines.push(summary.operatorNarrative);
      lines.push("");
    }
    heading(3, "Subcategories");
    lines.push("| ID | Outcome | Characteristic | Evidence | Maturity |");
    lines.push("|---|---|---|---|---|");
    for (const s of report.subcategories.filter((x) => x.function === fn)) {
      lines.push(
        `| \`${s.id}\` | ${s.outcome} | ${s.characteristic} | ${s.evidenceCount} | ${s.maturityLevel ?? "-"} |`,
      );
    }
    lines.push("");
  }

  heading(2, "Provenance");
  lines.push(
    `This report was generated by [@sovereign-matrix/nist-ai-rmf](https://www.npmjs.com/package/@sovereign-matrix/nist-ai-rmf) v0.1.0, an Apache-2.0 open-source NIST AI RMF 1.0 profile exporter. Subcategory evidence counts derive directly from cryptographically-signed VAOS receipts; every claim is reproducible from the receipt set.`,
  );

  return lines.join("\n");
}

/**
 * Serialize as JSON — machine-readable, ingestible by GRC tooling.
 */
export function toJSON(report: RmfReport): string {
  return JSON.stringify(report, null, 2);
}
