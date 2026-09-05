/**
 * @sovereign-matrix/hipaa-security
 *
 * HIPAA Security Rule (45 CFR § 164.308-318) evidence-binder
 * exporter. The Security Rule is the part of HIPAA that covers
 * electronic protected health information (ePHI). It mandates three
 * categories of safeguards:
 *
 *   Administrative  (§ 164.308) — workforce, training, policies,
 *                                 risk analysis, contingency plans
 *   Physical        (§ 164.310) — facility access, workstation use,
 *                                 device + media controls
 *   Technical       (§ 164.312) — access control, audit controls,
 *                                 integrity, transmission security
 *
 * Plus § 164.314 (organizational) and § 164.316 (policies + documents).
 *
 * Each safeguard has implementation specifications classified as
 * REQUIRED (must implement) or ADDRESSABLE (must implement OR
 * document why an alternative is appropriate).
 *
 * This package consumes VAOS receipts and renders the implementation-
 * specification table in Markdown and JSON, marking each specification
 * evidenced or unevidenced.
 *
 * ## What a receipt can evidence here
 *
 * A receipt is a Guardian verdict on the wording of one model output (see
 * the module docstring of `packs.ts`). It is signed, timestamped and
 * re-verifiable, so it is good evidence of what it actually records — and
 * that is a narrow thing. The Security Rule governs workforce clearance, facility access,
 * workstation use, device disposal and business-associate contracts. A
 * verdict on a model's wording evidences none of those. One of the 52
 * implementation specifications — Risk Analysis — declares a reachable pack.
 *
 * So this binder is a partial input to a HIPAA Security Rule assessment, not a coverage claim
 * for it. Controls the receipts cannot reach carry no prefix mapping and
 * report as unevidenced, which is the honest reading and the one an auditor
 * would reach anyway.
 *
 * Output formats:
 *   - Markdown (auditor-readable, archive-friendly)
 *   - JSON (machine-readable)
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
 * Covered entity / business associate scope per the Security Rule.
 */
export interface HipaaScope {
  /** Legal name of the covered entity OR business associate. */
  organizationName: string;
  /** Role: covered entity, business associate, or both. */
  organizationType: "covered-entity" | "business-associate" | "both";
  /** What kind of ePHI is processed (free-text). */
  ephiCategoriesDescription: string;
  /** Audit period start, ISO 8601. */
  auditPeriodStart: string;
  /** Audit period end, ISO 8601. */
  auditPeriodEnd: string;
  /** Security Official per § 164.308(a)(2). */
  securityOfficial?: string;
  /** Privacy Official per § 164.530(a). */
  privacyOfficial?: string;
}

/**
 * A single implementation specification.
 */
export interface HipaaSpecification {
  /** Citation, e.g. "164.308(a)(1)(ii)(A)". */
  id: string;
  /** Standard parent, e.g. "164.308(a)(1) Security Management Process". */
  standard: string;
  /** Category. */
  category:
    | "administrative"
    | "physical"
    | "technical"
    | "organizational"
    | "policies";
  /** Short title from the rule. */
  title: string;
  /** What the rule requires. */
  requirement: string;
  /** REQUIRED → must implement. ADDRESSABLE → must implement OR document why an alternative is appropriate. */
  classification: "required" | "addressable";
  /** Receipt-derived evidence count. */
  evidenceCount: number;
  /** Operator-supplied implementation note (for ADDRESSABLE alternatives). */
  implementationNote?: string;
  /** Status: implemented / alternative-implemented / not-implemented / not-applicable. */
  status?:
    | "implemented"
    | "alternative-implemented"
    | "not-implemented"
    | "not-applicable";
}

/**
 * Structured HIPAA Security Rule evidence report.
 */
export interface HipaaReport {
  schema: "vaos-hipaa-security-v1";
  ruleVersion: "45-CFR-164";
  generatedAt: string;
  scope: HipaaScope;
  reportingWindow: {
    from: string;
    to: string;
    totalReceipts: number;
    durationDays: number;
  };
  specifications: HipaaSpecification[];
  /** Specifications classified REQUIRED with no evidence — these are findings. */
  findings: HipaaSpecification[];
  summary: {
    requiredTotal: number;
    requiredEvidenced: number;
    addressableTotal: number;
    addressableEvidenced: number;
    byCategory: Record<HipaaSpecification["category"], number>;
  };
}

/** Options. */
export interface BuildHipaaOptions {
  scope: HipaaScope;
  receipts: ReceiptRecord[];
  /**
   * Operator status + implementation note per specification id.
   * Unknown ids throw (fail-loud per Wave 79 review pattern).
   */
  implementationStatus?: Record<
    string,
    {
      status: HipaaSpecification["status"];
      note?: string;
    }
  >;
}

/**
 * Canonical HIPAA Security Rule catalog. Ships every implementation
 * specification across § 164.308 / .310 / .312 / .314 / .316.
 */
const HIPAA_CATALOG: Array<{
  id: string;
  standard: string;
  category: HipaaSpecification["category"];
  title: string;
  requirement: string;
  classification: HipaaSpecification["classification"];
  evidencePackPrefixes: string[];
}> = [
  // ── § 164.308 Administrative safeguards ──────────────────────────
  {
    id: "164.308(a)(1)(i)",
    standard: "164.308(a)(1) Security Management Process",
    category: "administrative",
    title: "Security Management Process — Standard",
    requirement:
      "Implement policies and procedures to prevent, detect, contain, and correct security violations.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(1)(ii)(A)",
    standard: "164.308(a)(1) Security Management Process",
    category: "administrative",
    title: "Risk Analysis",
    requirement:
      "Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI.",
    classification: "required",
    evidencePackPrefixes: ["owasp"],
  },
  {
    id: "164.308(a)(1)(ii)(B)",
    standard: "164.308(a)(1) Security Management Process",
    category: "administrative",
    title: "Risk Management",
    requirement:
      "Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(1)(ii)(C)",
    standard: "164.308(a)(1) Security Management Process",
    category: "administrative",
    title: "Sanction Policy",
    requirement:
      "Apply appropriate sanctions against workforce members who fail to comply with the security policies and procedures.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(1)(ii)(D)",
    standard: "164.308(a)(1) Security Management Process",
    category: "administrative",
    title: "Information System Activity Review",
    requirement:
      "Implement procedures to regularly review records of information system activity (audit logs, access reports, security incident tracking).",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(2)",
    standard: "164.308(a)(2) Assigned Security Responsibility",
    category: "administrative",
    title: "Assigned Security Responsibility",
    requirement:
      "Identify the security official who is responsible for the development and implementation of the policies and procedures.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(3)(i)",
    standard: "164.308(a)(3) Workforce Security",
    category: "administrative",
    title: "Workforce Security — Standard",
    requirement:
      "Ensure all members of the workforce have appropriate access to ePHI and prevent unauthorized access.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(3)(ii)(A)",
    standard: "164.308(a)(3) Workforce Security",
    category: "administrative",
    title: "Authorization and/or Supervision",
    requirement:
      "Implement procedures for the authorization and/or supervision of workforce members who work with ePHI.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(3)(ii)(B)",
    standard: "164.308(a)(3) Workforce Security",
    category: "administrative",
    title: "Workforce Clearance Procedure",
    requirement:
      "Implement procedures to determine that the access of a workforce member to ePHI is appropriate.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(3)(ii)(C)",
    standard: "164.308(a)(3) Workforce Security",
    category: "administrative",
    title: "Termination Procedures",
    requirement:
      "Implement procedures for terminating access to ePHI when a workforce member's employment ends.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(4)(i)",
    standard: "164.308(a)(4) Information Access Management",
    category: "administrative",
    title: "Information Access Management — Standard",
    requirement:
      "Implement policies and procedures for authorizing access to ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(4)(ii)(B)",
    standard: "164.308(a)(4) Information Access Management",
    category: "administrative",
    title: "Access Authorization",
    requirement:
      "Implement policies and procedures for granting access to ePHI through access to a workstation, transaction, program, process, or other mechanism.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(4)(ii)(C)",
    standard: "164.308(a)(4) Information Access Management",
    category: "administrative",
    title: "Access Establishment and Modification",
    requirement:
      "Implement policies and procedures that establish, document, review, and modify a user's right of access.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(5)(i)",
    standard: "164.308(a)(5) Security Awareness and Training",
    category: "administrative",
    title: "Security Awareness and Training — Standard",
    requirement:
      "Implement a security awareness and training program for all members of the workforce.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(5)(ii)(A)",
    standard: "164.308(a)(5) Security Awareness and Training",
    category: "administrative",
    title: "Security Reminders",
    requirement: "Periodic security updates.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(5)(ii)(B)",
    standard: "164.308(a)(5) Security Awareness and Training",
    category: "administrative",
    title: "Protection from Malicious Software",
    requirement:
      "Procedures for guarding against, detecting, and reporting malicious software.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(5)(ii)(C)",
    standard: "164.308(a)(5) Security Awareness and Training",
    category: "administrative",
    title: "Log-in Monitoring",
    requirement:
      "Procedures for monitoring log-in attempts and reporting discrepancies.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(5)(ii)(D)",
    standard: "164.308(a)(5) Security Awareness and Training",
    category: "administrative",
    title: "Password Management",
    requirement:
      "Procedures for creating, changing, and safeguarding passwords.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(6)(i)",
    standard: "164.308(a)(6) Security Incident Procedures",
    category: "administrative",
    title: "Security Incident Procedures — Standard",
    requirement:
      "Implement policies and procedures to address security incidents.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(6)(ii)",
    standard: "164.308(a)(6) Security Incident Procedures",
    category: "administrative",
    title: "Response and Reporting",
    requirement:
      "Identify and respond to suspected or known security incidents; mitigate, to the extent practicable, harmful effects.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(7)(i)",
    standard: "164.308(a)(7) Contingency Plan",
    category: "administrative",
    title: "Contingency Plan — Standard",
    requirement:
      "Establish policies and procedures for responding to an emergency or other occurrence that damages systems containing ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(7)(ii)(A)",
    standard: "164.308(a)(7) Contingency Plan",
    category: "administrative",
    title: "Data Backup Plan",
    requirement:
      "Establish procedures to create and maintain retrievable exact copies of ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(7)(ii)(B)",
    standard: "164.308(a)(7) Contingency Plan",
    category: "administrative",
    title: "Disaster Recovery Plan",
    requirement: "Establish procedures to restore any loss of data.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(7)(ii)(C)",
    standard: "164.308(a)(7) Contingency Plan",
    category: "administrative",
    title: "Emergency Mode Operation Plan",
    requirement:
      "Establish procedures to enable continuation of critical business processes during emergency mode.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(7)(ii)(D)",
    standard: "164.308(a)(7) Contingency Plan",
    category: "administrative",
    title: "Testing and Revision Procedures",
    requirement:
      "Implement procedures for periodic testing and revision of contingency plans.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.308(a)(8)",
    standard: "164.308(a)(8) Evaluation",
    category: "administrative",
    title: "Evaluation",
    requirement:
      "Perform a periodic technical and nontechnical evaluation of the security safeguards.",
    classification: "required",
    evidencePackPrefixes: [],
  },

  // ── § 164.310 Physical safeguards ────────────────────────────────
  {
    id: "164.310(a)(1)",
    standard: "164.310(a)(1) Facility Access Controls",
    category: "physical",
    title: "Facility Access Controls — Standard",
    requirement:
      "Implement policies and procedures to limit physical access to electronic information systems.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.310(a)(2)(ii)",
    standard: "164.310(a)(1) Facility Access Controls",
    category: "physical",
    title: "Facility Security Plan",
    requirement:
      "Implement policies to safeguard facility and equipment from unauthorized physical access.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.310(b)",
    standard: "164.310(b) Workstation Use",
    category: "physical",
    title: "Workstation Use",
    requirement:
      "Implement policies and procedures that specify the proper functions to be performed by workstations.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.310(c)",
    standard: "164.310(c) Workstation Security",
    category: "physical",
    title: "Workstation Security",
    requirement:
      "Implement physical safeguards for all workstations that access ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.310(d)(1)",
    standard: "164.310(d)(1) Device and Media Controls",
    category: "physical",
    title: "Device and Media Controls — Standard",
    requirement:
      "Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.310(d)(2)(i)",
    standard: "164.310(d)(1) Device and Media Controls",
    category: "physical",
    title: "Disposal",
    requirement:
      "Implement policies and procedures to address the final disposition of ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.310(d)(2)(ii)",
    standard: "164.310(d)(1) Device and Media Controls",
    category: "physical",
    title: "Media Re-use",
    requirement:
      "Implement procedures for removal of ePHI before media is made available for re-use.",
    classification: "required",
    evidencePackPrefixes: [],
  },

  // ── § 164.312 Technical safeguards ───────────────────────────────
  {
    id: "164.312(a)(1)",
    standard: "164.312(a)(1) Access Control",
    category: "technical",
    title: "Access Control — Standard",
    requirement:
      "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(a)(2)(i)",
    standard: "164.312(a)(1) Access Control",
    category: "technical",
    title: "Unique User Identification",
    requirement:
      "Assign a unique name and/or number for identifying and tracking user identity.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(a)(2)(ii)",
    standard: "164.312(a)(1) Access Control",
    category: "technical",
    title: "Emergency Access Procedure",
    requirement:
      "Establish procedures for obtaining necessary ePHI during an emergency.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(a)(2)(iii)",
    standard: "164.312(a)(1) Access Control",
    category: "technical",
    title: "Automatic Logoff",
    requirement:
      "Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(a)(2)(iv)",
    standard: "164.312(a)(1) Access Control",
    category: "technical",
    title: "Encryption and Decryption",
    requirement: "Implement a mechanism to encrypt and decrypt ePHI.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(b)",
    standard: "164.312(b) Audit Controls",
    category: "technical",
    title: "Audit Controls",
    requirement:
      "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(c)(1)",
    standard: "164.312(c)(1) Integrity",
    category: "technical",
    title: "Integrity — Standard",
    requirement:
      "Implement policies and procedures to protect ePHI from improper alteration or destruction.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(c)(2)",
    standard: "164.312(c)(1) Integrity",
    category: "technical",
    title: "Mechanism to Authenticate ePHI",
    requirement:
      "Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(d)",
    standard: "164.312(d) Person or Entity Authentication",
    category: "technical",
    title: "Person or Entity Authentication",
    requirement:
      "Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(e)(1)",
    standard: "164.312(e)(1) Transmission Security",
    category: "technical",
    title: "Transmission Security — Standard",
    requirement:
      "Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(e)(2)(i)",
    standard: "164.312(e)(1) Transmission Security",
    category: "technical",
    title: "Integrity Controls",
    requirement:
      "Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection until disposed of.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.312(e)(2)(ii)",
    standard: "164.312(e)(1) Transmission Security",
    category: "technical",
    title: "Encryption",
    requirement:
      "Implement a mechanism to encrypt ePHI whenever deemed appropriate.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },

  // ── § 164.314 Organizational requirements ────────────────────────
  {
    id: "164.314(a)(1)",
    standard: "164.314(a)(1) Business Associate Contracts",
    category: "organizational",
    title: "Business Associate Contracts",
    requirement:
      "Have a contract or other arrangement that meets the applicable requirements with each business associate.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.314(b)(1)",
    standard: "164.314(b)(1) Requirements for Group Health Plans",
    category: "organizational",
    title: "Requirements for Group Health Plans",
    requirement:
      "Group health plans must ensure plan documents provide that the sponsor will reasonably and appropriately safeguard ePHI.",
    classification: "required",
    evidencePackPrefixes: [],
  },

  // ── § 164.316 Policies and procedures + documentation ────────────
  {
    id: "164.316(a)",
    standard: "164.316(a) Policies and Procedures",
    category: "policies",
    title: "Policies and Procedures",
    requirement:
      "Implement reasonable and appropriate policies and procedures to comply with the standards.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.316(b)(1)",
    standard: "164.316(b)(1) Documentation",
    category: "policies",
    title: "Documentation — Standard",
    requirement:
      "Maintain the policies and procedures in written (which may be electronic) form, and document any action, activity, or assessment required to be documented.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.316(b)(2)(i)",
    standard: "164.316(b)(1) Documentation",
    category: "policies",
    title: "Time Limit",
    requirement:
      "Retain the documentation for 6 years from the date of its creation or the date when it last was in effect, whichever is later.",
    classification: "required",
    evidencePackPrefixes: [],
  },
  {
    id: "164.316(b)(2)(ii)",
    standard: "164.316(b)(1) Documentation",
    category: "policies",
    title: "Availability",
    requirement:
      "Make documentation available to those persons responsible for implementing the procedures.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
  {
    id: "164.316(b)(2)(iii)",
    standard: "164.316(b)(1) Documentation",
    category: "policies",
    title: "Updates",
    requirement: "Review documentation periodically and update as needed.",
    classification: "addressable",
    evidencePackPrefixes: [],
  },
];

/**
 * Build the HIPAA Security Rule evidence binder.
 */
export function buildHipaaSecurity(opts: BuildHipaaOptions): HipaaReport {
  const { scope, receipts, implementationStatus = {} } = opts;
  const generatedAt = new Date().toISOString();

  // Validate operator implementation-status keys.
  const catalogIds = new Set(HIPAA_CATALOG.map((c) => c.id));
  const unknown = Object.keys(implementationStatus).filter(
    (k) => !catalogIds.has(k),
  );
  if (unknown.length > 0) {
    throw new Error(
      `buildHipaaSecurity: implementationStatus referenced unknown specification id(s): ${unknown.join(", ")}. Valid ids: ${[...catalogIds].sort().join(", ")}`,
    );
  }

  const fromMs = Date.parse(scope.auditPeriodStart);
  const toMs = Date.parse(scope.auditPeriodEnd);
  const durationDays = Math.max(
    1,
    Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? Math.round((toMs - fromMs) / (24 * 3600 * 1000))
      : 1,
  );

  // Per-specification evidence count.
  const specifications: HipaaSpecification[] = HIPAA_CATALOG.map((cat) => {
    let evidenceCount = 0;
    for (const r of receipts) {
      const pack = typeof r.pack === "string" ? redactKeyMaterial(r.pack).toLowerCase() : "";
      if (!pack) continue;
      if (
        cat.evidencePackPrefixes.some((prefix) =>
          pack.startsWith(prefix.toLowerCase()),
        )
      ) {
        evidenceCount++;
      }
    }
    const op = implementationStatus[cat.id];
    const spec: HipaaSpecification = {
      id: cat.id,
      standard: cat.standard,
      category: cat.category,
      title: cat.title,
      requirement: cat.requirement,
      classification: cat.classification,
      evidenceCount,
    };
    if (op?.status) spec.status = op.status;
    if (op?.note) spec.implementationNote = op.note;
    return spec;
  });

  // Findings: REQUIRED specs with no evidence + no operator note.
  const findings = specifications.filter(
    (s) =>
      s.classification === "required" &&
      s.evidenceCount === 0 &&
      !s.implementationNote &&
      s.status !== "not-applicable",
  );

  // Summary.
  const requiredSpecs = specifications.filter(
    (s) => s.classification === "required",
  );
  const addressableSpecs = specifications.filter(
    (s) => s.classification === "addressable",
  );
  const requiredEvidenced = requiredSpecs.filter(
    (s) => s.evidenceCount > 0,
  ).length;
  const addressableEvidenced = addressableSpecs.filter(
    (s) => s.evidenceCount > 0,
  ).length;

  const byCategory: Record<HipaaSpecification["category"], number> = {
    administrative: 0,
    physical: 0,
    technical: 0,
    organizational: 0,
    policies: 0,
  };
  for (const s of specifications) {
    if (s.evidenceCount > 0) byCategory[s.category]++;
  }

  return {
    schema: "vaos-hipaa-security-v1",
    ruleVersion: "45-CFR-164",
    generatedAt,
    scope,
    reportingWindow: {
      from: scope.auditPeriodStart,
      to: scope.auditPeriodEnd,
      totalReceipts: receipts.length,
      durationDays,
    },
    specifications,
    findings,
    summary: {
      requiredTotal: requiredSpecs.length,
      requiredEvidenced,
      addressableTotal: addressableSpecs.length,
      addressableEvidenced,
      byCategory,
    },
  };
}

/** Serialize as Markdown for the OCR auditor. */
export function toMarkdown(report: HipaaReport): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, "HIPAA Security Rule Evidence Binder");
  lines.push(
    `*Generated by @sovereign-matrix/hipaa-security at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*This binder maps each implementation specification of the HIPAA Security Rule (45 CFR Part 164 Subpart C) to receipt-derived evidence. Required specifications must be implemented; addressable specifications must be implemented OR documented with an appropriate alternative.*",
  );
  lines.push("");

  heading(2, "Scope");
  kv("Organization", report.scope.organizationName);
  kv("Type", report.scope.organizationType);
  kv("ePHI categories", report.scope.ephiCategoriesDescription);
  kv(
    "Audit period",
    `${report.scope.auditPeriodStart} → ${report.scope.auditPeriodEnd}`,
  );
  kv("Duration", `${report.reportingWindow.durationDays} days`);
  if (report.scope.securityOfficial) {
    kv("Security Official (§ 164.308(a)(2))", report.scope.securityOfficial);
  }
  if (report.scope.privacyOfficial) {
    kv("Privacy Official (§ 164.530(a))", report.scope.privacyOfficial);
  }
  lines.push("");

  heading(2, "Summary");
  kv(
    "Required specifications evidenced",
    `${report.summary.requiredEvidenced} / ${report.summary.requiredTotal}`,
  );
  kv(
    "Addressable specifications evidenced",
    `${report.summary.addressableEvidenced} / ${report.summary.addressableTotal}`,
  );
  kv("Open findings", report.findings.length);
  kv("Total receipts", report.reportingWindow.totalReceipts);
  lines.push("");
  heading(3, "By category");
  for (const [k, v] of Object.entries(report.summary.byCategory)) {
    kv(k, `${v} specifications evidenced`);
  }
  lines.push("");

  if (report.findings.length > 0) {
    heading(2, "Open findings — REQUIRED specifications without evidence");
    for (const f of report.findings) {
      lines.push(`- \`${f.id}\` — ${f.title} (${f.standard})`);
    }
    lines.push("");
    lines.push(
      "Each open finding must be addressed with either: (a) implementation + receipt evidence, or (b) a documented alternative implementation per § 164.306(d).",
    );
    lines.push("");
  }

  // Group by category for the binder.
  const categories: HipaaSpecification["category"][] = [
    "administrative",
    "physical",
    "technical",
    "organizational",
    "policies",
  ];
  for (const category of categories) {
    const subset = report.specifications.filter((s) => s.category === category);
    if (subset.length === 0) continue;
    heading(
      2,
      category === "administrative"
        ? "§ 164.308 Administrative safeguards"
        : category === "physical"
          ? "§ 164.310 Physical safeguards"
          : category === "technical"
            ? "§ 164.312 Technical safeguards"
            : category === "organizational"
              ? "§ 164.314 Organizational requirements"
              : "§ 164.316 Policies + Documentation",
    );
    lines.push("| ID | Title | Class | Evidence | Status |");
    lines.push("|---|---|---|---|---|");
    for (const s of subset) {
      lines.push(
        `| \`${s.id}\` | ${s.title} | ${s.classification.toUpperCase()} | ${s.evidenceCount} | ${s.status ?? "-"} |`,
      );
    }
    lines.push("");
  }

  heading(2, "Provenance");
  lines.push(
    `This binder was generated by [@sovereign-matrix/hipaa-security](https://www.npmjs.com/package/@sovereign-matrix/hipaa-security) v0.1.0, an Apache-2.0 OSS HIPAA Security Rule evidence-binder exporter. Each evidence count is derived from cryptographically-signed VAOS receipts — reproducible by HHS OCR auditors against the same receipt set.`,
  );

  return lines.join("\n");
}

/** Serialize as JSON. */
export function toJSON(report: HipaaReport): string {
  return JSON.stringify(report, null, 2);
}
