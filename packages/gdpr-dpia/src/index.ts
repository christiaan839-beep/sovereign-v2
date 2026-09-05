/**
 * @sovereign-matrix/gdpr-dpia
 *
 * GDPR Article 35 Data Protection Impact Assessment (DPIA) + Article
 * 30 Records of Processing Activities (RoPA) exporter.
 *
 * Article 35 GDPR requires controllers to carry out a DPIA prior to
 * any processing "likely to result in a high risk to the rights and
 * freedoms of natural persons". The EDPB has classified large-scale
 * AI processing (including most LLM-based products that handle
 * personal data) as falling under Article 35(3)(c) — systematic
 * monitoring of publicly accessible areas + profiling — which
 * mandates a DPIA.
 *
 * Article 30 RoPA is mandatory for every controller and processor
 * (with limited exemptions). The records describe each processing
 * activity, its purpose, the categories of data, the recipients,
 * and the safeguards in place.
 *
 * The operator supplies the processing activities and their evidence
 * prefixes; this package renders them against the receipt set. A receipt
 * is a Guardian verdict on the wording of one model output, so it
 * evidences an activity's safeguards only as far as that goes.
 *
 * Output formats:
 *   - Markdown (DPO + supervisory authority readable)
 *   - JSON (machine-readable, ingestible by privacy-management platforms)
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
 * Controller / processor identity per Article 30(1)(a) GDPR.
 */
export interface ControllerIdentity {
  /** Legal name of the controller. */
  name: string;
  /** Registered address. */
  address: string;
  /** Email of the controller (or representative). */
  email: string;
  /** Data Protection Officer name (Article 37 — mandatory if you process special-category data at scale). */
  dpoName?: string;
  /** DPO email. */
  dpoEmail?: string;
  /** EU representative per Article 27 (mandatory if you're outside EU but target EU residents). */
  euRepresentative?: string;
}

/**
 * A single processing activity per Article 30(1) GDPR. The DPIA
 * report assesses the risk of each one.
 */
export interface ProcessingActivity {
  /** Stable id used to reference this activity from other records. */
  id: string;
  /** Plain-language name. */
  name: string;
  /** Article 30(1)(b) — purpose. */
  purpose: string;
  /** Article 30(1)(c) — categories of data subjects. */
  dataSubjectCategories: string[];
  /** Article 30(1)(c) — categories of personal data. */
  dataCategories: string[];
  /** Article 9 special categories (health, biometric, political, etc.) — empty if none. */
  specialCategories: string[];
  /** Article 30(1)(d) — recipients (other controllers, processors, third parties). */
  recipients: string[];
  /** Article 30(1)(e) — third-country transfers + safeguards. */
  transfers?: {
    country: string;
    safeguard: "SCCs" | "adequacy-decision" | "BCRs" | "derogation" | "none";
  }[];
  /** Article 30(1)(f) — retention period. */
  retention: string;
  /** Article 30(1)(g) — technical and organizational measures. */
  securityMeasures: string[];
  /** Legal basis under Article 6 GDPR. */
  legalBasis:
    | "consent"
    | "contract"
    | "legal-obligation"
    | "vital-interests"
    | "public-task"
    | "legitimate-interests";
  /** Required if legalBasis === "legitimate-interests". */
  legitimateInterestsAssessment?: string;
}

/**
 * The Article 35 risk-assessment result for a single processing activity.
 */
export interface ActivityRiskAssessment {
  activityId: string;
  /** Article 35(7)(b) — necessity and proportionality assessment. */
  necessityProportionality: string;
  /** Article 35(7)(c) — risks to rights and freedoms. */
  risks: RiskItem[];
  /** Article 35(7)(d) — measures envisaged to address the risks. */
  mitigations: MitigationItem[];
  /** Receipt-derived evidence count. */
  evidenceCount: number;
  /** Overall residual risk after mitigations. */
  residualRisk: "low" | "medium" | "high";
  /** Article 36 prior consultation required? (high residual risk → yes). */
  priorConsultationRequired: boolean;
}

export interface RiskItem {
  /** Plain-language risk description. */
  description: string;
  /** Likelihood per ENISA risk matrix. */
  likelihood: "negligible" | "low" | "medium" | "high";
  /** Severity per ENISA. */
  severity: "negligible" | "low" | "medium" | "high";
}

export interface MitigationItem {
  description: string;
  /** Receipts whose pack matches this mitigation contribute evidence. */
  evidencePackPrefixes?: string[];
}

/**
 * Complete DPIA + RoPA report.
 */
export interface DpiaReport {
  schema: "vaos-gdpr-dpia-v1";
  /** GDPR target version. */
  regulationVersion: "GDPR-2016-679";
  /** ISO 8601 of report generation. */
  generatedAt: string;
  /** Window the receipts in this report cover. */
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
  };
  controller: ControllerIdentity;
  /** Article 30 RoPA section — every processing activity. */
  ropa: ProcessingActivity[];
  /** Article 35 DPIA section — risk assessment per activity. */
  dpia: ActivityRiskAssessment[];
  /** Aggregate summary. */
  summary: {
    activitiesTotal: number;
    highResidualRiskActivities: number;
    priorConsultationsRequired: number;
    specialCategoriesActivities: number;
    thirdCountryTransfers: number;
    totalEvidenceReceipts: number;
  };
}

/** Options controlling how the report assembles. */
export interface BuildDpiaOptions {
  controller: ControllerIdentity;
  activities: ProcessingActivity[];
  /** Operator-supplied risk assessment per activity. */
  risks: Record<
    string,
    Omit<ActivityRiskAssessment, "activityId" | "evidenceCount">
  >;
  receipts: ReceiptRecord[];
}

/**
 * Build the DPIA + RoPA report.
 */
export function buildDpia(opts: BuildDpiaOptions): DpiaReport {
  const { controller, activities, risks, receipts } = opts;
  const generatedAt = new Date().toISOString();

  // Validate risk-assessment keys against the activities — fail loud on
  // typoed activity ids per the Wave 79 review pattern.
  const activityIds = new Set(activities.map((a) => a.id));
  const unknown = Object.keys(risks).filter((k) => !activityIds.has(k));
  if (unknown.length > 0) {
    throw new Error(
      `buildDpia: risks referenced unknown activity id(s): ${unknown.join(", ")}. Valid ids: ${[...activityIds].sort().join(", ")}`,
    );
  }

  // Reporting window.
  const sortedTimestamps = receipts
    .map((r) => r.issuedAt)
    .filter((t): t is string => typeof t === "string")
    .sort();
  const from = sortedTimestamps[0] ?? generatedAt;
  const to = sortedTimestamps[sortedTimestamps.length - 1] ?? generatedAt;

  // Per-activity risk assessment + receipt evidence count.
  const dpia: ActivityRiskAssessment[] = activities.map((a) => {
    const userRisk = risks[a.id];
    if (!userRisk) {
      // Activity declared in RoPA but no risk assessment provided —
      // emit a stub flagged "high" so the operator MUST fill it in.
      return {
        activityId: a.id,
        necessityProportionality:
          "OPERATOR-AUTHORED: state how this processing is necessary AND proportionate to the purpose.",
        risks: [
          {
            description:
              "Risk assessment not provided — activity flagged as high-risk pending operator review.",
            likelihood: "high",
            severity: "high",
          },
        ],
        mitigations: [],
        evidenceCount: 0,
        residualRisk: "high",
        priorConsultationRequired: true,
      };
    }

    // Count receipt evidence across all mitigations' pack prefixes.
    let evidenceCount = 0;
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? redactKeyMaterial(r.pack).toLowerCase() : "";
      if (!pack) continue;
      for (const m of userRisk.mitigations) {
        if (
          m.evidencePackPrefixes?.some((prefix) =>
            pack.startsWith(prefix.toLowerCase()),
          )
        ) {
          evidenceCount++;
          break; // count once per receipt
        }
      }
    }

    return {
      activityId: a.id,
      ...userRisk,
      evidenceCount,
    };
  });

  // Summary.
  const highRiskActivities = dpia.filter(
    (d) => d.residualRisk === "high",
  ).length;
  const priorConsultationsRequired = dpia.filter(
    (d) => d.priorConsultationRequired,
  ).length;
  const specialCategoriesActivities = activities.filter(
    (a) => a.specialCategories.length > 0,
  ).length;
  const thirdCountryTransfers = activities.filter(
    (a) => (a.transfers?.length ?? 0) > 0,
  ).length;
  const totalEvidenceReceipts = dpia.reduce((s, d) => s + d.evidenceCount, 0);

  return {
    schema: "vaos-gdpr-dpia-v1",
    regulationVersion: "GDPR-2016-679",
    generatedAt,
    reportingWindow: { from, to, totalReceipts: receipts.length },
    controller,
    ropa: activities,
    dpia,
    summary: {
      activitiesTotal: activities.length,
      highResidualRiskActivities: highRiskActivities,
      priorConsultationsRequired,
      specialCategoriesActivities,
      thirdCountryTransfers,
      totalEvidenceReceipts,
    },
  };
}

/**
 * Serialize as Markdown for the DPO + supervisory authority.
 */
export function toMarkdown(report: DpiaReport): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, "GDPR DPIA + RoPA Report");
  lines.push(
    `*Generated by @sovereign-matrix/gdpr-dpia at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*This document fulfils Article 30 (Records of Processing Activities) + Article 35 (Data Protection Impact Assessment) of Regulation (EU) 2016/679 (GDPR). High-residual-risk activities require prior consultation with the supervisory authority per Article 36.*",
  );
  lines.push("");

  heading(2, "Controller identity");
  kv("Name", report.controller.name);
  kv("Address", report.controller.address);
  kv("Email", report.controller.email);
  if (report.controller.dpoName) {
    kv("Data Protection Officer", report.controller.dpoName);
  }
  if (report.controller.dpoEmail) {
    kv("DPO email", report.controller.dpoEmail);
  }
  if (report.controller.euRepresentative) {
    kv("EU representative (Article 27)", report.controller.euRepresentative);
  }
  lines.push("");

  heading(2, "Reporting window");
  kv("From", report.reportingWindow.from);
  kv("To", report.reportingWindow.to);
  kv("Total receipts", report.reportingWindow.totalReceipts);
  lines.push("");

  heading(2, "Summary");
  kv("Processing activities", report.summary.activitiesTotal);
  kv(
    "High residual-risk activities",
    report.summary.highResidualRiskActivities,
  );
  kv(
    "Prior consultations required (Art. 36)",
    report.summary.priorConsultationsRequired,
  );
  kv(
    "Activities with special-category data (Art. 9)",
    report.summary.specialCategoriesActivities,
  );
  kv(
    "Activities with third-country transfers",
    report.summary.thirdCountryTransfers,
  );
  kv("Receipts evidencing mitigations", report.summary.totalEvidenceReceipts);
  lines.push("");

  // RoPA section per Article 30(1).
  heading(2, "Article 30 — Records of Processing Activities");
  for (const a of report.ropa) {
    heading(3, `${a.id} — ${a.name}`);
    kv("Purpose (Art. 30(1)(b))", a.purpose);
    kv("Data subjects (Art. 30(1)(c))", a.dataSubjectCategories.join(", "));
    kv("Data categories (Art. 30(1)(c))", a.dataCategories.join(", "));
    if (a.specialCategories.length > 0) {
      kv("Special categories (Art. 9)", a.specialCategories.join(", "));
    }
    kv("Recipients (Art. 30(1)(d))", a.recipients.join(", "));
    if (a.transfers && a.transfers.length > 0) {
      heading(4, "Third-country transfers (Art. 30(1)(e))");
      for (const t of a.transfers) {
        lines.push(`- ${t.country} — safeguard: ${t.safeguard}`);
      }
      lines.push("");
    }
    kv("Retention (Art. 30(1)(f))", a.retention);
    kv("Legal basis (Art. 6)", a.legalBasis);
    if (a.legitimateInterestsAssessment) {
      kv("Legitimate-interests assessment", a.legitimateInterestsAssessment);
    }
    heading(4, "Security measures (Art. 30(1)(g) + Art. 32)");
    for (const m of a.securityMeasures) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  // DPIA section per Article 35.
  heading(2, "Article 35 — Data Protection Impact Assessment");
  for (const d of report.dpia) {
    const activity = report.ropa.find((a) => a.id === d.activityId);
    heading(3, `${d.activityId} — ${activity?.name ?? "(unknown)"}`);
    lines.push(
      `**Residual risk: ${d.residualRisk.toUpperCase()}** · prior consultation required: ${d.priorConsultationRequired ? "YES" : "no"}`,
    );
    lines.push("");
    heading(4, "Necessity and proportionality (Art. 35(7)(b))");
    lines.push(d.necessityProportionality);
    lines.push("");
    heading(4, "Risks to rights and freedoms (Art. 35(7)(c))");
    for (const r of d.risks) {
      lines.push(
        `- **${r.description}** — likelihood: ${r.likelihood}, severity: ${r.severity}`,
      );
    }
    lines.push("");
    heading(4, "Mitigations envisaged (Art. 35(7)(d))");
    for (const m of d.mitigations) {
      lines.push(`- ${m.description}`);
    }
    lines.push("");
    kv("Receipts evidencing mitigations", d.evidenceCount);
    lines.push("");
  }

  heading(2, "Provenance");
  lines.push(
    `This report was generated by [@sovereign-matrix/gdpr-dpia](https://www.npmjs.com/package/@sovereign-matrix/gdpr-dpia) v0.1.0, an Apache-2.0 OSS GDPR DPIA + RoPA exporter. Mitigation-evidence counts are derived directly from cryptographically-signed VAOS receipts; every number is reproducible by your supervisory authority against the same receipt set.`,
  );

  return lines.join("\n");
}

/**
 * Serialize as JSON for ingestion by privacy-management platforms.
 */
export function toJSON(report: DpiaReport): string {
  return JSON.stringify(report, null, 2);
}
