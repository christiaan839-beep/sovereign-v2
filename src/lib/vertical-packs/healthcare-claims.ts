/**
 * HEALTHCARE CLAIMS COMPLIANCE PACK (R49).
 *
 * The second vertical product. Sold to hospital systems, health
 * insurance plans, ACOs, healthcare admin services, and pharma
 * clinical operations whose compliance officers face HIPAA / OCR
 * audits, FDA 21 CFR Part 11 inspections, and OIG investigations.
 *
 * The wedge: this pack maps every primitive in our trust stack
 * (R26 audit, R34 CADC, R37 ACTs, R38 KYA, R44 reliability, R45
 * audit-export) to specific HIPAA Security Rule, HITECH Act,
 * FDA 21 CFR Part 11, and OIG self-disclosure-protocol controls.
 *
 * Why healthcare second (after banking):
 *   - Same buyer profile (Chief Compliance / Privacy Officer)
 *   - Larger deal sizes ($50K-$300K vs $25K-$150K)
 *   - Stronger regulatory pressure (UHC denial scandal + OCR
 *     enforcement actions in 2024-2025 drove $15M+ in fines)
 *   - HIPAA §164.312 audit controls are MANDATORY by federal law
 *     — not "nice to have"
 *   - The trust stack is a 1:1 fit for HIPAA technical safeguards
 *
 * Pricing: $50-300K ACV. Target: hospital systems (1000+ beds),
 * mid-to-large health insurance plans, ACOs, healthcare admin
 * services, pharma clinical operations.
 */

import type { VerticalPack } from "./types";

export const HEALTHCARE_CLAIMS_PACK: VerticalPack = {
  id: "healthcare-claims-v1",
  name: "Healthcare Claims & Compliance Pack",
  summary:
    "Audit-defensible AI agent infrastructure for hospital systems, health " +
    "insurance plans, ACOs, healthcare admin services, and pharma clinical " +
    "operations. Every PHI-touching agent action is Ed25519-signed, " +
    "hash-chained, HITL-gated above policy thresholds, and OCR-audit-ready " +
    "by default. Covers HIPAA Security Rule, HITECH breach-notification, " +
    "FDA 21 CFR Part 11 e-records, and OIG self-disclosure protocol.",
  version: "1.0.0",
  industry: "Healthcare — claims, prior-auth, clinical operations, billing",
  targetBuyerPersona:
    "Chief Compliance Officer, Chief Privacy Officer, VP Revenue Cycle " +
    "Management, or Director of Clinical Operations at hospital systems " +
    "(1000+ beds), health plans (>100K members), ACOs, healthcare admin " +
    "services, or pharma clinical-operations teams subject to FDA " +
    "21 CFR Part 11.",

  complianceFrameworks: [
    "soc2-type-ii",
    "hipaa",
    "nist-ai-rmf",
    "gdpr",
    "ccpa",
    "hitrust",
    "iso-27001",
  ],

  // Curated agent allowlist — only agents that make sense in a
  // healthcare compliance + revenue-cycle surface. NO marketing
  // / general-purpose / open-internet agents.
  enabledAgents: [
    "claims-eligibility-checker",
    "prior-authorization-drafter",
    "denial-appeal-drafter",
    "billing-code-auditor",
    "hipaa-breach-detector",
    "phi-access-pattern-analyst",
    "ocr-readiness-scorecard",
    "fda-21cfr-part11-validator",
    "clinical-trial-data-integrity-checker",
    "oig-self-audit-runner",
    "policy-document-summarizer",
    "audit-trail-summarizer",
    "regulatory-update-tracker",
    "vendor-baa-tracker",
  ],

  // Healthcare-specific HITL rules layered on platform defaults.
  // Each rule cites the regulatory authority an OCR investigator
  // would recognize.
  hitlRules: [
    {
      id: "healthcare-phi-export-dual-approval",
      description:
        "Any agent action that exports PHI (Protected Health Information) " +
        "to an external system requires DUAL approval: a Privacy Officer " +
        "AND the data steward / department owner. The agent NEVER moves " +
        "PHI off-platform autonomously.",
      trigger:
        "agent.action LIKE 'export.phi.%' OR " +
        "agent.scope == 'export.patient_data'",
      requiredApprovers: 2,
      regulatoryCitation:
        "HIPAA §164.312(a)(1) Access Control; §164.312(e)(1) Transmission Security; " +
        "HITECH §13407",
    },
    {
      id: "healthcare-prior-auth-denial-physician-signoff",
      description:
        "Any agent draft of a prior-authorization DENIAL requires explicit " +
        "physician sign-off (R34 CADC) BEFORE the denial is communicated " +
        "to the patient or provider. This rule exists specifically because " +
        "of the 2024 UnitedHealthcare class-action ($90M settlement) over " +
        "AI-driven denials with no human review. We will not let any " +
        "deployment repeat that mistake.",
      trigger:
        "agent.action == 'prior_auth.denial.draft' OR " +
        "agent.action == 'claim.denial.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "ERISA §503; CMS Medicare Coverage Decision rules; " +
        "state-by-state utilization-review statutes",
    },
    {
      id: "healthcare-breach-notification-dual-approval",
      description:
        "Any agent-drafted HIPAA breach notification (>500 individuals) " +
        "requires DUAL approval: Privacy Officer AND General Counsel " +
        "before notification is sent to HHS, the affected individuals, " +
        "or the media. Notification timing affects whether the breach " +
        "is treated as wilful neglect under HITECH.",
      trigger: "agent.action == 'breach.notification.draft'",
      requiredApprovers: 2,
      regulatoryCitation:
        "HITECH Breach Notification Rule (45 CFR §164.404-410); " +
        "HHS OCR enforcement guidance",
    },
    {
      id: "healthcare-fda-submission-qa-signoff",
      description:
        "Any agent draft of an FDA submission (21 CFR Part 11 e-records, " +
        "IND/NDA components, clinical trial data, AE reports) requires " +
        "QA Director sign-off. The R34 CADC signature is the predicate " +
        "rule's '21 CFR §11.50 signed electronic records' satisfier.",
      trigger:
        "agent.action LIKE 'fda.%' OR " +
        "agent.action LIKE 'clinical_trial.submission.%'",
      requiredApprovers: 1,
      regulatoryCitation: "FDA 21 CFR Part 11.10, 11.50, 11.70",
    },
    {
      id: "healthcare-patient-comm-ethics-review",
      description:
        "Any agent-drafted communication TO a patient (not provider) " +
        "involving diagnostic, prognostic, or treatment-recommendation " +
        "content requires medical ethics / clinical leadership review " +
        "before delivery.",
      trigger: "agent.action LIKE 'patient.communication.%'",
      requiredApprovers: 1,
      regulatoryCitation:
        "Joint Commission patient-rights standards; AMA Code of Medical Ethics",
    },
    {
      id: "healthcare-vendor-baa-required-before-data-share",
      description:
        "Agent-detected data-sharing relationships with new vendors are " +
        "BLOCKED until a Business Associate Agreement (BAA) is executed. " +
        "This is a hard gate, not a warning.",
      trigger: "agent.action == 'vendor.data_share.detected'",
      requiredApprovers: 1,
      regulatoryCitation: "HIPAA §164.308(b); HITECH §13408",
    },
  ],

  // Canned audit queries an OCR / OIG / FDA investigator actually
  // requests, mapped to the action prefixes the agents emit.
  auditQueries: [
    {
      id: "healthcare-audit-phi-access-30d",
      title: "Every agent action accessing PHI (last 30 days)",
      description:
        "Returns the full audit log of any agent action where the " +
        "resource was a PHI record. Used in OCR security investigations " +
        "+ HIPAA §164.308(a)(1)(ii)(D) information system activity reviews.",
      audienceContext: "OCR investigation; HIPAA §164.308(a)(1)(ii)(D)",
      actionPrefix: "agent.phi.",
      defaultWindowDays: 30,
    },
    {
      id: "healthcare-audit-breach-detection-90d",
      title: "Breach-detection chain: detection → assessment → notification",
      description:
        "Reconstructs the full HITECH breach-notification pipeline: when " +
        "the agent detected a potential breach, who assessed it, what was " +
        "concluded, when notification was sent. Demonstrates compliance " +
        "with the 60-day notification window under HITECH.",
      audienceContext: "HITECH breach response; OCR audit",
      actionPrefix: "agent.breach.",
      defaultWindowDays: 90,
    },
    {
      id: "healthcare-audit-denials-with-signoff-180d",
      title: "Prior-auth denials + physician sign-off chain (180 days)",
      description:
        "Every agent-drafted denial, who reviewed it, who signed off, " +
        "with which CADC key. Demonstrates that AI did NOT autonomously " +
        "deny care — the UHC-class-action defense.",
      audienceContext: "ERISA §503 audit; state utilization-review board",
      actionPrefix: "agent.prior_auth.",
      defaultWindowDays: 180,
    },
    {
      id: "healthcare-audit-fda-submissions-365d",
      title: "FDA submission artifacts + QA sign-off chain (365 days)",
      description:
        "Every agent-drafted FDA submission component, the QA reviewer " +
        "and signature, the predicate rule citation, the 21 CFR Part 11 " +
        "e-records integrity proof.",
      audienceContext: "FDA inspection (21 CFR Part 11)",
      actionPrefix: "agent.fda.",
      defaultWindowDays: 365,
    },
    {
      id: "healthcare-audit-vendor-baa-status-365d",
      title: "Vendor data-sharing relationships and BAA execution status",
      description:
        "Every agent-detected vendor data-sharing event and whether a " +
        "BAA was executed beforehand. Demonstrates §164.308(b) compliance.",
      audienceContext: "OCR audit (BAA enforcement)",
      actionPrefix: "agent.vendor.",
      defaultWindowDays: 365,
    },
    {
      id: "healthcare-audit-anomalies-180d",
      title: "Anomaly events in the agent fleet (last 180 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, capability-token " +
        "revocations. The 'has anything bad happened with PHI' query.",
      audienceContext: "HIPAA §164.308 admin safeguards review",
      actionPrefix: "anomaly.",
      defaultWindowDays: 180,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "OCR audit response time reduced from weeks to hours via canned audit queries",
    "Every PHI-touching agent action signed by the privacy officer's Ed25519 key (R34 CADC)",
    "Audit chain hash-verified every 6h; tampering surfaces immediately (HIPAA §164.312(c))",
    "Customer-managed audit-log export to YOUR S3 bucket (R45) — even if Sovereign vanishes, your HIPAA audit trail survives",
    "Insurable agent-action liability via R46 underwriting — first AI agent insurance for healthcare context",
    "FDA 21 CFR Part 11 §11.50 satisfied: every e-record signed, every signature linked to a specific identified user",
    "UHC-style class-action defense: agents NEVER autonomously deny care — physician sign-off is a hard gate",
    "BAA enforcement: vendor data-sharing is BLOCKED until a BAA is executed (not warned, blocked)",
    "Prior-auth denial pipeline reconstructable end-to-end: who-when-why for every denied claim",
  ],

  // Healthcare admin agents have legitimate higher volume than banking
  // compliance (a hospital processes 100K+ claims/day vs a bank's
  // smaller examination scope). Default cap reflects that.
  defaultDailyLimitCents: 20_000, // $200/day — reflects healthcare admin volume

  defaultActScopes: {
    // Read-only by default. PHI is too sensitive to allow autonomous
    // mutation — every state change goes through HITL.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.draft.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.analyze.*",
      "agent.eligibility.check.*",
      "agent.code.audit.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 50_000,
    maxAcvUsd: 300_000,
    targetCustomerSize:
      "Hospital systems (1000+ beds), health insurance plans (>100K members), " +
      "ACOs (>50 participating providers), healthcare admin service organizations, " +
      "pharma clinical-operations teams subject to FDA 21 CFR Part 11",
  },
};

/**
 * Pure helpers. Used by the public endpoint + the inspector.
 */

export function getHealthcareClaimsPack(): VerticalPack {
  return HEALTHCARE_CLAIMS_PACK;
}

export function isAgentEnabledInHealthcarePack(agentId: string): boolean {
  return HEALTHCARE_CLAIMS_PACK.enabledAgents.includes(agentId);
}
