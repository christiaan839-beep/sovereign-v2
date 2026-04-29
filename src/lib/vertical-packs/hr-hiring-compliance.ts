/**
 * HR / HIRING COMPLIANCE PACK (R62).
 *
 * The fifth vertical product (after banking, healthcare, legal, and
 * the upcoming FedRAMP gov pack). Targets HR teams + applicant-
 * tracking-system vendors + recruiting platforms in jurisdictions
 * where AI hiring tools face explicit regulation.
 *
 * The wedge: algorithmic hiring tools are now under three
 * overlapping enforcement regimes:
 *
 *   1. EEOC + Title VII + ADEA + ADA + GINA — federal anti-
 *      discrimination law that has ALWAYS applied to algorithmic
 *      hiring decisions. EEOC's May 2023 AI guidance + the
 *      iTutorGroup $365K consent decree (2023) made enforcement
 *      explicit.
 *   2. NYC Local Law 144 — bias-audit requirement for AEDTs
 *      (Automated Employment Decision Tools), in effect July 2023.
 *   3. Colorado SB 24-205 (effective Feb 2026) — algorithmic
 *      discrimination duty-of-care for "consequential decisions"
 *      including employment.
 *
 * Why this pack exists: HR teams using AI WITHOUT this pack face
 * Section 1981 + Title VII + ADA disparate-impact lawsuits. WITH
 * this pack: every adverse decision is signed by a human, every
 * bias-audit data point is collected automatically, every
 * candidate notice is generated and tracked.
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack does NOT make hiring decisions for the customer.
 *   - HR personnel licensed/authorized in the relevant jurisdiction
 *     review and sign every adverse decision via R34 CADC.
 *   - We are NOT a consumer reporting agency under FCRA.
 *
 * Pricing: $30-150K ACV. Target: Fortune 1000 HR teams,
 * applicant-tracking-system vendors, recruiting-platform companies
 * operating in NYC / Colorado / California / EU.
 */

import type { VerticalPack } from "./types";

export const HR_HIRING_COMPLIANCE_PACK: VerticalPack = {
  id: "hr-hiring-compliance-v1",
  name: "HR & Hiring Compliance Pack",
  summary:
    "Anti-discrimination, audit-defensible AI agent infrastructure for " +
    "HR teams + applicant-tracking-system vendors + recruiting platforms. " +
    "Every adverse hiring decision is signed by an authorized HR " +
    "professional's Ed25519 key (R34 CADC); every bias-audit data point " +
    "is captured automatically (NYC Local Law 144 + Colorado SB 24-205); " +
    "every candidate notice is generated as a draft for HR sign-off. " +
    "Designed to defend against EEOC + Title VII + ADA + ADEA + GINA + " +
    "Section 1981 disparate-impact litigation.",
  version: "1.0.0",
  industry: "HR — talent acquisition, candidate screening, hiring decisions",
  targetBuyerPersona:
    "Chief People Officer, VP Talent Acquisition, Chief Diversity Officer, " +
    "Director of HR Operations, or Head of Compliance at Fortune 1000 " +
    "employers, applicant-tracking-system vendors (Workday/Greenhouse/Lever-" +
    "scale), or recruiting-platform companies operating in NYC, Colorado, " +
    "California, or the EU.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "gdpr",
    "ccpa",
    "nist-ai-rmf",
    "hitrust",
  ],

  enabledAgents: [
    "resume-parser-redacted",
    "skills-extractor-blind",
    "candidate-match-scorer",
    "interview-question-generator",
    "interview-feedback-aggregator",
    "bias-audit-data-collector",
    "adverse-action-notice-drafter",
    "ada-accommodation-tracker",
    "fcra-permissible-purpose-validator",
    "candidate-notice-generator",
    "diversity-pipeline-analyzer",
    "background-check-status-tracker",
    "regulatory-update-tracker",
    "ll144-bias-audit-input-builder",
  ],

  // HR-specific HITL rules. Each rule cites controlling authority
  // an EEOC investigator, NYC DCWP auditor, or Colorado AG would
  // recognize. Most cite multiple statutes because hiring
  // discrimination is enforceable under several overlapping regimes.
  hitlRules: [
    {
      id: "hr-no-autonomous-rejection",
      description:
        "Agents NEVER autonomously reject candidates. Every adverse " +
        "candidate decision (rejection, screening-out, ranking-as-not-" +
        "qualified) requires a hiring manager or recruiter's Ed25519 " +
        "signature (R34 CADC) before the candidate sees the outcome. " +
        "This rule exists specifically because of the iTutorGroup case " +
        "(EEOC consent decree, Jul 2023, $365K) where AI screened out " +
        "applicants over age 55 — autonomous rejection became the " +
        "ADEA-violation theory. We will not allow any deployment to " +
        "repeat that mistake.",
      trigger:
        "agent.action == 'candidate.reject.draft' OR " +
        "agent.action == 'candidate.screen_out.draft' OR " +
        "agent.action == 'candidate.adverse_decision.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "Title VII (42 USC 2000e); ADEA (29 USC 621); ADA (42 USC 12101); " +
        "Section 1981 (42 USC 1981); EEOC May 2023 AI Hiring Guidance; " +
        "iTutorGroup consent decree (2:22-cv-02565, S.D.N.Y.)",
    },
    {
      id: "hr-fcra-pre-adverse-action-notice",
      description:
        "If a hiring decision relies on a consumer report (background " +
        "check, credit report, motor vehicle record, etc.), a pre-adverse-" +
        "action notice MUST be sent to the candidate WITH a copy of the " +
        "report + their FCRA rights summary, BEFORE the adverse action " +
        "is final. Agent drafts the notice; HR signs. The 'reasonable " +
        "amount of time' (typically 5 business days per CFPB guidance) " +
        "must elapse before the final adverse-action notice goes out.",
      trigger:
        "agent.action == 'adverse_action.consumer_report.preadverse_notice.draft' OR " +
        "agent.action == 'adverse_action.consumer_report.final_notice.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FCRA 15 USC 1681b(b)(3); CFPB Compliance Bulletin 2018-01; " +
        "CA Investigative Consumer Reporting Agencies Act (Civ. Code §1786)",
    },
    {
      id: "hr-bias-audit-data-collection",
      description:
        "Every agent-driven candidate-screening decision automatically " +
        "logs the input features used (skills, location, experience), " +
        "the score produced, the demographic data category bucket " +
        "(when voluntarily disclosed by the candidate per EEOC EEO-1 " +
        "categories), and the eventual hiring outcome. This dataset " +
        "is the input feed for the annual independent bias audit " +
        "required by NYC Local Law 144 (and equivalent jurisdictions).",
      trigger: "agent.action == 'candidate.score.commit'",
      requiredApprovers: 0, // automatic logging, no HITL gate
      regulatoryCitation:
        "NYC Local Law 144 (NYC Admin. Code §20-870 et seq.); " +
        "Colorado SB 24-205 §6-1-1701 et seq.; California AB 2930 (proposed)",
    },
    {
      id: "hr-protected-class-feature-block",
      description:
        "Agents are HARD-BLOCKED from using protected-class features " +
        "as inputs to candidate scoring: race, color, religion, sex, " +
        "national origin (Title VII), age (ADEA, 40+), disability " +
        "(ADA), genetic information (GINA), pregnancy, military status. " +
        "Inferred-from-proxy fields (e.g., name → ethnicity, ZIP → " +
        "race, college → age) are also blocked. The R55 CMEK + R26 " +
        "audit chain together provide cryptographic evidence that a " +
        "feature was NOT seen by the agent.",
      trigger:
        "agent.action == 'candidate.score.draft' AND " +
        "input.contains_protected_class_feature == true",
      requiredApprovers: 1, // dual-purpose: HARD-BLOCKED if rule fires
      regulatoryCitation:
        "Title VII (42 USC 2000e-2(a)(1)); ADEA (29 USC 623(a)); " +
        "ADA (42 USC 12112); GINA (42 USC 2000ff-1); Pregnancy " +
        "Discrimination Act (42 USC 2000e(k))",
    },
    {
      id: "hr-ada-accommodation-tracking",
      description:
        "Every candidate-disclosed disability accommodation request " +
        "is tracked through the hiring pipeline. The agent NEVER " +
        "auto-decides eligibility or reasonableness. HR Director " +
        "(or designated ADA coordinator) must sign off on each " +
        "accommodation determination via R34 CADC.",
      trigger:
        "agent.action == 'accommodation.request.detected' OR " +
        "agent.action == 'accommodation.eligibility.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "ADA 42 USC 12112; 29 CFR 1630.9 (reasonable accommodation " +
        "process); EEOC ADA + AI Guidance (May 2022)",
    },
    {
      id: "hr-aedt-candidate-notice",
      description:
        "When an Automated Employment Decision Tool will be used to " +
        "evaluate a NYC-resident candidate, the candidate MUST be " +
        "notified at least 10 business days before the AEDT is used. " +
        "The notice must include the categories of data collected, " +
        "the source, and information about disability accommodations. " +
        "Agent drafts; HR posts.",
      trigger: "agent.action == 'aedt.notice.draft' OR candidate.jurisdiction == 'NY'",
      requiredApprovers: 1,
      regulatoryCitation:
        "NYC Local Law 144 of 2021; 6 RCNY §5-300 et seq. (DCWP rules)",
    },
    {
      id: "hr-colorado-impact-assessment",
      description:
        "Before deploying any agent-driven 'consequential decision' " +
        "system to candidates in Colorado, the customer must complete " +
        "an algorithmic impact assessment per SB 24-205. The pack " +
        "auto-generates a draft impact assessment from the audit " +
        "log + bias-audit data; the customer's CCO + GC sign off.",
      trigger: "agent.action == 'colorado.impact_assessment.required'",
      requiredApprovers: 2,
      regulatoryCitation:
        "Colorado SB 24-205 (Colo. Rev. Stat. §6-1-1701 et seq.); " +
        "effective Feb 1, 2026",
    },
    {
      id: "hr-eeo1-data-segregation",
      description:
        "EEO-1 demographic data (voluntarily disclosed by candidates) " +
        "is stored in a SEPARATE encrypted datastore (R55 CMEK with " +
        "a different CMK) from operational hiring data. The two are " +
        "JOINED only when generating bias-audit reports for an " +
        "independent auditor. Hiring managers see ONLY the operational " +
        "data; they cannot accidentally factor demographic data into " +
        "decisions.",
      trigger: "agent.action == 'demographic_data.access'",
      requiredApprovers: 1,
      regulatoryCitation:
        "29 CFR 1602.7 (EEO-1 reporting); EEOC OFCCP Directive 2018-05; " +
        "data-minimization principles in GDPR Art 5(1)(c)",
    },
  ],

  auditQueries: [
    {
      id: "hr-audit-eedt-bias-audit-365d",
      title: "NYC LL144 Bias-Audit Input Dataset (365 days)",
      description:
        "Returns the structured dataset an INDEPENDENT auditor needs " +
        "to compute bias metrics per NYC LL144 + Bulletin BE-2023-2: " +
        "selection rates by demographic category, average scores, " +
        "score distribution by category. The independent auditor " +
        "then publishes the public summary report.",
      audienceContext: "NYC LL144 annual bias audit; CO SB 24-205 impact assessment",
      actionPrefix: "agent.candidate.score.",
      defaultWindowDays: 365,
    },
    {
      id: "hr-audit-fcra-adverse-action-180d",
      title: "FCRA Adverse-Action Workflow (180 days)",
      description:
        "Reconstructs the FCRA pipeline for every consumer-report-" +
        "based adverse action: pre-adverse-action notice timestamp, " +
        "report copy provided, FCRA rights notice sent, time-to-" +
        "decision elapsed, final adverse-action notice signed by HR.",
      audienceContext: "FCRA / CFPB enforcement examination; private litigation",
      actionPrefix: "agent.adverse_action.",
      defaultWindowDays: 180,
    },
    {
      id: "hr-audit-eeoc-charge-response-365d",
      title: "EEOC Charge Response — Candidate Journey (365 days)",
      description:
        "Full candidate journey for a specific applicant: every " +
        "agent action that touched their record, every score " +
        "computed, every human reviewer with their R34 signature, " +
        "every adverse-action notice sent. The 'show me everything " +
        "you did about this candidate' query an EEOC investigator " +
        "asks during a charge investigation.",
      audienceContext: "EEOC charge response; OFCCP audit",
      actionPrefix: "agent.candidate.",
      defaultWindowDays: 365,
    },
    {
      id: "hr-audit-protected-class-blocks-365d",
      title: "Protected-Class Feature Block Events (365 days)",
      description:
        "Every time the platform blocked an agent from using a " +
        "protected-class feature. Demonstrates the technical " +
        "infrastructure was working (disparate-impact defense).",
      audienceContext: "Disparate-impact defense; EEOC audit",
      actionPrefix: "agent.candidate.score.protected_class_blocked",
      defaultWindowDays: 365,
    },
    {
      id: "hr-audit-ada-accommodations-365d",
      title: "ADA Accommodation Request Pipeline (365 days)",
      description:
        "Every accommodation request, the HR Director who handled " +
        "it, the determination made (granted, denied, alternative " +
        "offered), and the timestamp. Defends against ADA failure-" +
        "to-accommodate claims.",
      audienceContext: "ADA Title I enforcement; private litigation",
      actionPrefix: "agent.accommodation.",
      defaultWindowDays: 365,
    },
    {
      id: "hr-audit-colorado-impact-assessments-365d",
      title: "Colorado SB 24-205 Impact Assessments (365 days)",
      description:
        "Every algorithmic impact assessment completed for Colorado-" +
        "resident candidate workflows. Includes scope, risks " +
        "identified, mitigations implemented, sign-off chain.",
      audienceContext: "Colorado AG enforcement (effective Feb 2026)",
      actionPrefix: "agent.colorado.impact_assessment",
      defaultWindowDays: 365,
    },
    {
      id: "hr-audit-anomalies-180d",
      title: "Anomaly Events in HR Agent Fleet (180 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, ACT " +
        "revocations, disparate-impact red flags from R57 " +
        "anomaly detector. The 'has anything bad happened with " +
        "our candidate decisions' query.",
      audienceContext: "Internal audit; pre-charge risk review",
      actionPrefix: "anomaly.",
      defaultWindowDays: 180,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "EEOC charge defense by design — every adverse decision has a " +
      "named human signer (R34 CADC), defeating the 'algorithm decided' theory",
    "NYC LL144 bias-audit data collected automatically; " +
      "ll144-bias-audit-input-builder agent assembles the auditor input",
    "Colorado SB 24-205 impact assessments are templated + auto-drafted",
    "FCRA pre-adverse-action workflow enforced by HITL gate (no decisions " +
      "without notice + waiting period)",
    "ADA accommodation requests tracked end-to-end with HR Director sign-off",
    "Protected-class features HARD-BLOCKED at the agent boundary (R37 ACT " +
      "scope) — disparate-impact defense by infrastructure, not by policy",
    "Customer-managed audit-log export to YOUR S3 bucket (R45) — your HR " +
      "audit trail survives even if Sovereign vanishes",
    "Defends against the iTutorGroup theory: agents NEVER autonomously " +
      "screen out candidates",
  ],

  defaultDailyLimitCents: 15_000, // $150/day

  defaultActScopes: {
    // Read-only by default. HR agents parse, score, draft, alert,
    // analyze — but they NEVER autonomously commit adverse decisions.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.parse.*",
      "agent.score.*",
      "agent.draft.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.analyze.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 30_000,
    maxAcvUsd: 150_000,
    targetCustomerSize:
      "Fortune 1000 employers (>5000 candidates/year), applicant-tracking-" +
      "system vendors (Workday + Greenhouse + Lever scale), recruiting " +
      "platforms (Indeed/LinkedIn-affiliated tools), and any company " +
      "operating in NYC, Colorado, California, or the EU subject to " +
      "anti-discrimination regulation",
  },
};

export function getHrHiringCompliancePack(): VerticalPack {
  return HR_HIRING_COMPLIANCE_PACK;
}

export function isAgentEnabledInHrPack(agentId: string): boolean {
  return HR_HIRING_COMPLIANCE_PACK.enabledAgents.includes(agentId);
}
