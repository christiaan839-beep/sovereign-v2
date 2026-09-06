/**
 * @sovereign-matrix/eu-cra
 *
 * EU Cyber Resilience Act (CRA) — Regulation (EU) 2024/2847.
 *
 * The CRA was adopted on 23 October 2024 and entered into force on
 * 10 December 2024. Most obligations apply from 11 December 2027,
 * with vulnerability reporting obligations applying earlier
 * (11 September 2026). It applies to all "products with digital
 * elements" placed on the EU market — including AI software.
 *
 * The exporter covers Annex I (Essential cybersecurity requirements)
 * and Article 13/15 technical documentation, mapping each essential
 * requirement to receipt-derived evidence.
 *
 * Apache 2.0. Zero runtime deps beyond @sovereign-matrix/verifiable-receipts.
 */

import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
// Every receipt-derived string this module publishes goes through this.
// SECURITY.md item 4: key material must not reach an exporter's output.
import { redactKeyMaterial } from "@sovereign-matrix/verifiable-receipts";

export interface CraScope {
  /** Manufacturer (Article 13). */
  manufacturer: string;
  /** Product name. */
  productName: string;
  /** Product identifier (model, version). */
  productIdentifier: string;
  /** Product category per Annex III / IV (critical, important, or default). */
  category: "default" | "important-class-I" | "important-class-II" | "critical";
  /** Intended use. */
  intendedUse: string;
  /** ISO 8601 placed-on-market date. */
  placedOnMarketAt: string;
  /** Authorised representative in EU (if manufacturer is outside EU). */
  authorisedRepresentative?: string;
}

export type CraRequirementCategory =
  | "design"
  | "vulnerability-handling"
  | "post-market"
  | "documentation";

export interface CraRequirement {
  id: string;
  /** Annex reference, e.g. "Annex I, Part I, point (1)". */
  annexReference: string;
  category: CraRequirementCategory;
  title: string;
  requirement: string;
  evidenceCount: number;
  /** Operator-supplied compliance status. */
  status?: "compliant" | "alternative-measure" | "not-applicable" | "open";
  /** Operator note (required if status = alternative-measure). */
  note?: string;
}

export interface CraReport {
  schema: "vaos-eu-cra-v1";
  regulationVersion: "2024-2847";
  generatedAt: string;
  scope: CraScope;
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
  };
  requirements: CraRequirement[];
  /** Open findings: requirements with no evidence + no operator note. */
  findings: CraRequirement[];
  /** Cybersecurity risk assessment summary (Article 13(1)(b)). */
  riskAssessment: {
    risksIdentified: number;
    risksMitigated: number;
    residualRisks: string[];
  };
  summary: {
    totalRequirements: number;
    compliant: number;
    open: number;
    byCategory: Record<CraRequirementCategory, number>;
  };
}

export interface BuildCraOptions {
  scope: CraScope;
  receipts: ReceiptRecord[];
  /** Per-requirement compliance status (unknown ids throw). */
  implementationStatus?: Record<
    string,
    { status: CraRequirement["status"]; note?: string }
  >;
  /** Optional operator-declared residual risks per Article 13. */
  residualRisks?: string[];
}

/**
 * Annex I essential cybersecurity requirements catalog.
 *
 * Part I — Cybersecurity risk-management requirements (points 1-13)
 * Part II — Vulnerability handling requirements (points 1-8)
 *
 * Plus Article 13 technical-documentation requirements.
 */
const CRA_CATALOG: Array<{
  id: string;
  annexReference: string;
  category: CraRequirementCategory;
  title: string;
  requirement: string;
  evidencePackPrefixes: string[];
}> = [
  // Annex I Part I — Cybersecurity risk-management
  {
    id: "AI.I.1",
    annexReference: "Annex I, Part I, point (1)",
    category: "design",
    title:
      "Designed/developed to provide an appropriate level of cybersecurity",
    requirement:
      "Products with digital elements shall be designed, developed and produced in such a way that they ensure an appropriate level of cybersecurity based on the risks.",
    evidencePackPrefixes: ["owasp"],
  },
  {
    id: "AI.I.2",
    annexReference: "Annex I, Part I, point (2)",
    category: "design",
    title: "No exploitable known vulnerabilities",
    requirement:
      "Products shall be made available on the market without known exploitable vulnerabilities.",
    evidencePackPrefixes: ["owasp"],
  },
  {
    id: "AI.I.3",
    annexReference: "Annex I, Part I, point (3)(a)",
    category: "design",
    title: "Secure-by-default configuration",
    requirement:
      "Products shall be delivered with a secure-by-default configuration.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.b",
    annexReference: "Annex I, Part I, point (3)(b)",
    category: "design",
    title: "Security updates capability",
    requirement:
      "Products shall ensure that security updates can be installed, also automatically where applicable.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.c",
    annexReference: "Annex I, Part I, point (3)(c)",
    category: "design",
    title: "Protection from unauthorised access",
    requirement:
      "Ensure protection from unauthorised access by appropriate control mechanisms (authentication, identity, access management).",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.d",
    annexReference: "Annex I, Part I, point (3)(d)",
    category: "design",
    title: "Confidentiality of stored, transmitted, or processed data",
    requirement:
      "Protect the confidentiality of stored, transmitted, or otherwise processed data (encryption at rest + in transit).",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.e",
    annexReference: "Annex I, Part I, point (3)(e)",
    category: "design",
    title: "Integrity of stored, transmitted, or processed data",
    requirement:
      "Protect the integrity of stored, transmitted, or otherwise processed data, commands, programs, configurations against any manipulation or modification not authorised by the user.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.f",
    annexReference: "Annex I, Part I, point (3)(f)",
    category: "design",
    title: "Data minimisation",
    requirement:
      "Process only data that is adequate, relevant, and limited to what is necessary in relation to the intended purpose (data minimisation).",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.g",
    annexReference: "Annex I, Part I, point (3)(g)",
    category: "design",
    title: "Availability of essential and basic functions",
    requirement:
      "Protect the availability of essential and basic functions, also after an incident (mitigation/resilience).",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.h",
    annexReference: "Annex I, Part I, point (3)(h)",
    category: "design",
    title:
      "Minimise negative impact on the availability of services provided by other devices",
    requirement:
      "Minimise the negative impact of products themselves or connected devices on the availability of services provided by other devices or networks.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.i",
    annexReference: "Annex I, Part I, point (3)(i)",
    category: "design",
    title: "Minimal attack surface",
    requirement:
      "Be designed, developed and produced to limit attack surfaces, including external interfaces.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.j",
    annexReference: "Annex I, Part I, point (3)(j)",
    category: "design",
    title: "Reduce impact via mitigation techniques",
    requirement:
      "Be designed, developed and produced to reduce the impact of an incident using appropriate exploitation mitigation mechanisms and techniques.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.k",
    annexReference: "Annex I, Part I, point (3)(k)",
    category: "design",
    title: "Security-relevant information access + logging",
    requirement:
      "Provide security-related information by recording and monitoring relevant internal activity (logging mechanisms).",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.I.3.l",
    annexReference: "Annex I, Part I, point (3)(l)",
    category: "design",
    title: "Secure data deletion / portability",
    requirement:
      "Provide the possibility for users to securely and easily remove on a permanent basis all data and settings + transfer them in a structured machine-readable format.",
    evidencePackPrefixes: [],
  },

  // Annex I Part II — Vulnerability handling
  {
    id: "AI.II.1",
    annexReference: "Annex I, Part II, point (1)",
    category: "vulnerability-handling",
    title: "Identify and document vulnerabilities",
    requirement:
      "Identify and document vulnerabilities and components contained in the product, including by drawing up a software bill of materials in a commonly used and machine-readable format.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.II.2",
    annexReference: "Annex I, Part II, point (2)",
    category: "vulnerability-handling",
    title: "Address and remediate vulnerabilities without delay",
    requirement:
      "In relation to the risks posed, address and remediate vulnerabilities without delay, including by providing security updates.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.II.3",
    annexReference: "Annex I, Part II, point (3)",
    category: "vulnerability-handling",
    title: "Apply effective and regular tests/reviews",
    requirement:
      "Apply effective and regular tests and reviews of the security of the product.",
    evidencePackPrefixes: ["owasp"],
  },
  {
    id: "AI.II.4",
    annexReference: "Annex I, Part II, point (4)",
    category: "vulnerability-handling",
    title: "Public disclosure of fixed vulnerabilities",
    requirement:
      "Once a security update has been made available, share and publicly disclose information about fixed vulnerabilities (advisories).",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.II.5",
    annexReference: "Annex I, Part II, point (5)",
    category: "vulnerability-handling",
    title: "Coordinated vulnerability disclosure policy",
    requirement:
      "Put in place and enforce a policy on coordinated vulnerability disclosure.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.II.6",
    annexReference: "Annex I, Part II, point (6)",
    category: "vulnerability-handling",
    title: "Sharing of information on potential vulnerabilities",
    requirement:
      "Facilitate the sharing of information about potential vulnerabilities, including by providing a contact address for the reporting of vulnerabilities.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.II.7",
    annexReference: "Annex I, Part II, point (7)",
    category: "vulnerability-handling",
    title: "Secure update distribution",
    requirement:
      "Provide for mechanisms to securely distribute updates for products with digital elements.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.II.8",
    annexReference: "Annex I, Part II, point (8)",
    category: "vulnerability-handling",
    title: "Dissemination of security patches without delay",
    requirement:
      "Ensure that, where security patches or updates are available, they are disseminated without delay and free of charge.",
    evidencePackPrefixes: [],
  },

  // Article 14 — Post-market obligations
  {
    id: "AI.PM.1",
    annexReference: "Article 14(1)",
    category: "post-market",
    title: "Reporting actively exploited vulnerabilities to ENISA within 24h",
    requirement:
      "Manufacturer shall notify ENISA + CSIRT of any actively exploited vulnerability within 24 hours of becoming aware.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.PM.2",
    annexReference: "Article 14(3)",
    category: "post-market",
    title: "Reporting severe incidents",
    requirement:
      "Notify ENISA + CSIRT of any severe incident having an impact on the security of the product within 24 hours.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.PM.3",
    annexReference: "Article 14(6)",
    category: "post-market",
    title: "User information for vulnerabilities/incidents",
    requirement:
      "Inform users of the affected product about any incident or actively exploited vulnerability + corrective measures.",
    evidencePackPrefixes: [],
  },

  // Article 13 + Annex VII — Technical documentation
  {
    id: "AI.TD.1",
    annexReference: "Article 13(1)(a) + Annex VII",
    category: "documentation",
    title: "Technical documentation maintained",
    requirement:
      "Draw up technical documentation in accordance with Annex VII and keep it up to date.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.TD.2",
    annexReference: "Article 13(1)(b)",
    category: "documentation",
    title: "Cybersecurity risk assessment performed",
    requirement:
      "Carry out a cybersecurity risk assessment + take its outcome into account during planning, design, development, production, delivery, and maintenance.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.TD.3",
    annexReference: "Article 13(8)",
    category: "documentation",
    title: "EU Declaration of Conformity",
    requirement:
      "Draw up an EU declaration of conformity per Annex V + ensure it accompanies the product.",
    evidencePackPrefixes: [],
  },
  {
    id: "AI.TD.4",
    annexReference: "Article 13(15)",
    category: "documentation",
    title: "CE marking applied",
    requirement:
      "Affix the CE marking on the product visibly, legibly, and indelibly per Articles 30(1)-(6).",
    evidencePackPrefixes: [],
  },
];

export function buildEuCra(opts: BuildCraOptions): CraReport {
  const {
    scope,
    receipts,
    implementationStatus = {},
    residualRisks = [],
  } = opts;
  const generatedAt = new Date().toISOString();

  // Validate operator-supplied implementation status ids.
  const catalogIds = new Set(CRA_CATALOG.map((c) => c.id));
  const unknown = Object.keys(implementationStatus).filter(
    (k) => !catalogIds.has(k),
  );
  if (unknown.length > 0) {
    throw new Error(
      `buildEuCra: implementationStatus referenced unknown CRA requirement id(s): ${unknown.join(", ")}. Valid ids: ${[...catalogIds].sort().join(", ")}`,
    );
  }

  // Reporting window — earliest + latest receipt.
  const stamps = receipts
    .map((r) => r.issuedAt)
    .filter((t): t is string => typeof t === "string")
    .sort();
  const from = stamps[0] ?? generatedAt;
  const to = stamps[stamps.length - 1] ?? generatedAt;

  // Compute per-requirement.
  const requirements: CraRequirement[] = CRA_CATALOG.map((cat) => {
    let evidenceCount = 0;
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? redactKeyMaterial(r.pack).toLowerCase() : "";
      if (!pack) continue;
      if (
        cat.evidencePackPrefixes.some((p) => pack.startsWith(p.toLowerCase()))
      ) {
        evidenceCount++;
      }
    }
    const op = implementationStatus[cat.id];
    const req: CraRequirement = {
      id: cat.id,
      annexReference: cat.annexReference,
      category: cat.category,
      title: cat.title,
      requirement: cat.requirement,
      evidenceCount,
    };
    if (op?.status) req.status = op.status;
    if (op?.note) req.note = op.note;
    return req;
  });

  // Findings: requirements with no evidence + no operator note + not marked not-applicable.
  const findings = requirements.filter(
    (r) => r.evidenceCount === 0 && !r.note && r.status !== "not-applicable",
  );

  // Aggregate.
  const compliant = requirements.filter(
    (r) =>
      r.status === "compliant" ||
      r.status === "alternative-measure" ||
      r.evidenceCount > 0,
  ).length;
  const open = requirements.length - compliant;

  const byCategory: Record<CraRequirementCategory, number> = {
    design: 0,
    "vulnerability-handling": 0,
    "post-market": 0,
    documentation: 0,
  };
  for (const r of requirements) {
    if (
      r.evidenceCount > 0 ||
      r.status === "compliant" ||
      r.status === "alternative-measure"
    ) {
      byCategory[r.category]++;
    }
  }

  return {
    schema: "vaos-eu-cra-v1",
    regulationVersion: "2024-2847",
    generatedAt,
    scope,
    reportingWindow: { from, to, totalReceipts: receipts.length },
    requirements,
    findings,
    riskAssessment: {
      risksIdentified: residualRisks.length, // operator declares; we count
      risksMitigated: 0, // operator narrative; can be filled out elsewhere
      residualRisks,
    },
    summary: {
      totalRequirements: requirements.length,
      compliant,
      open,
      byCategory,
    },
  };
}

export function toMarkdown(report: CraReport): string {
  const lines: string[] = [];
  const h = (lv: number, t: string): void => {
    lines.push(`${"#".repeat(lv)} ${t}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  h(1, "EU Cyber Resilience Act — Compliance Evidence Report");
  lines.push(
    `*Generated by @sovereign-matrix/eu-cra at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*Maps each Annex I essential cybersecurity requirement + Article 13/14 technical & post-market obligations of Regulation (EU) 2024/2847 (Cyber Resilience Act) to receipt-derived evidence. Most obligations apply from 2027-12-11; vulnerability reporting applies from 2026-09-11.*",
  );
  lines.push("");

  h(2, "Product scope");
  kv("Manufacturer", report.scope.manufacturer);
  kv("Product", report.scope.productName);
  kv("Identifier", report.scope.productIdentifier);
  kv("Category", report.scope.category);
  kv("Intended use", report.scope.intendedUse);
  kv("Placed on market", report.scope.placedOnMarketAt);
  if (report.scope.authorisedRepresentative) {
    kv("EU authorised representative", report.scope.authorisedRepresentative);
  }
  lines.push("");

  h(2, "Summary");
  kv("Total requirements", report.summary.totalRequirements);
  kv("Compliant (evidence or operator-attested)", report.summary.compliant);
  kv("Open", report.summary.open);
  kv("Open findings (zero evidence + no note)", report.findings.length);
  kv("Total receipts in window", report.reportingWindow.totalReceipts);
  lines.push("");

  h(3, "Compliant by category");
  for (const [k, v] of Object.entries(report.summary.byCategory)) {
    kv(k, v);
  }
  lines.push("");

  if (report.findings.length > 0) {
    h(2, "Open findings");
    lines.push(
      "Each finding below has zero receipt evidence and no operator note. Close by either: (a) implementing the control + emitting receipts that match the relevant pack prefixes, or (b) supplying an `alternative-measure` status with a documented note.",
    );
    lines.push("");
    for (const f of report.findings) {
      lines.push(`- \`${f.id}\` — ${f.title} *(${f.annexReference})*`);
    }
    lines.push("");
  }

  // Group by category.
  const categories: CraRequirementCategory[] = [
    "design",
    "vulnerability-handling",
    "post-market",
    "documentation",
  ];
  for (const category of categories) {
    const subset = report.requirements.filter((r) => r.category === category);
    if (subset.length === 0) continue;
    h(
      2,
      category === "design"
        ? "Annex I Part I — Cybersecurity requirements"
        : category === "vulnerability-handling"
          ? "Annex I Part II — Vulnerability handling"
          : category === "post-market"
            ? "Article 14 — Post-market obligations"
            : "Article 13 + Annex VII — Technical documentation",
    );
    lines.push("| ID | Title | Annex ref | Evidence | Status |");
    lines.push("|---|---|---|---|---|");
    for (const r of subset) {
      lines.push(
        `| \`${r.id}\` | ${r.title} | ${r.annexReference} | ${r.evidenceCount} | ${r.status ?? "-"} |`,
      );
    }
    lines.push("");
  }

  if (report.riskAssessment.residualRisks.length > 0) {
    h(2, "Cybersecurity risk assessment — residual risks");
    for (const r of report.riskAssessment.residualRisks) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  h(2, "Provenance");
  lines.push(
    `Generated by [@sovereign-matrix/eu-cra](https://www.npmjs.com/package/@sovereign-matrix/eu-cra) v0.1.0 · Apache 2.0. Reproducible from the same receipts + operator input.`,
  );

  return lines.join("\n");
}

export function toJSON(report: CraReport): string {
  return JSON.stringify(report, null, 2);
}
