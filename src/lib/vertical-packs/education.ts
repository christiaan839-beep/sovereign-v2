/**
 * EDUCATION COMPLIANCE PACK (R86).
 *
 * The tenth vertical product. Targets K-12 districts, higher-ed
 * institutions, EdTech platforms, and learning-management providers
 * deploying AI agents into admissions, grading, tutoring,
 * accessibility services, and student-data analytics.
 *
 * The wedge: education faces a unique regulatory mix — FERPA
 * federally + a fast-growing patchwork of state student-data-
 * privacy laws (NY ED §2D, CA SOPIPA, CO HB 22-1244, IL SIPA, etc.)
 * + the new wave of AI-in-admissions bias requirements (NYC LL144
 * extends to K-12 admissions; CO SB 24-205 covers consequential
 * education decisions).
 *
 * Why this pack exists: AI agents are now deployed for grading
 * assistance, admissions screening, attendance tracking, and adaptive
 * tutoring — all of which touch protected student data + create
 * algorithmic-discrimination liability. The 2024 federal Department
 * of Education AI guidance + the FTC's renewed COPPA enforcement
 * (TikTok $245M 2025) make this a compliance hotspot.
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack handles student PII as a "school official" under
 *     FERPA only after a written agreement is executed (FERPA
 *     §99.31(a)(1)(i)(B)). Districts/institutions must designate
 *     Sovereign as a school official in their annual notice.
 *   - We are NOT a Title IX coordinator. Customers must designate
 *     their own per 34 CFR §106.8.
 *
 * Pricing: $20-100K ACV (lower than other verticals because
 * education budgets are smaller, but addressable to ~13K K-12
 * districts + 4K colleges + 100s of EdTech platforms).
 */

import type { VerticalPack } from "./types";

export const EDUCATION_PACK: VerticalPack = {
  id: "education-v1",
  name: "Education & Student Data Compliance Pack",
  summary:
    "Audit-defensible AI agent infrastructure for K-12 districts, higher-" +
    "education institutions, EdTech platforms, and learning-management " +
    "providers deploying agents into admissions, grading, tutoring, " +
    "accessibility services, and student-data analytics. Every student-" +
    "data access is logged immutably (FERPA §99.32 audit trail by " +
    "design); every AI-influenced grading or admissions decision is " +
    "signed by the responsible educator's Ed25519 key (R34 CADC); " +
    "every parent/student data-subject request is traced end-to-end; " +
    "AI-in-admissions decisions trigger NYC LL144 + Colorado SB 24-205 " +
    "+ federal Title VI bias-audit data collection automatically. " +
    "Built to align with FERPA, COPPA, SOPIPA, IDEA Section 504/ADA, " +
    "Title VI, Title IX, and the patchwork of state student-data laws.",
  version: "1.0.0",
  industry:
    "Education — K-12 districts, higher-ed institutions, EdTech " +
    "platforms, learning-management systems",
  targetBuyerPersona:
    "Chief Information Officer, Chief Privacy Officer, Director of Data " +
    "Governance, Title IX Coordinator, or Director of Information " +
    "Technology at K-12 districts (>10,000 students), higher-education " +
    "institutions, EdTech platforms (Canvas/Blackboard/Schoology scale), " +
    "or learning-management-system vendors handling student PII subject " +
    "to FERPA + state student-data-privacy laws.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "gdpr",
    "ccpa",
    "hitrust",
    "nist-ai-rmf",
  ],

  enabledAgents: [
    "ferpa-access-pattern-analyzer",
    "student-record-redaction-suggester",
    "grading-rubric-applier",
    "essay-feedback-drafter",
    "admissions-application-screener",
    "iep-section-504-tracker",
    "title-ix-incident-intake-recorder",
    "attendance-anomaly-detector",
    "parent-data-request-router",
    "coppa-age-verification-checker",
    "sopipa-data-sharing-validator",
    "accessibility-accommodation-tracker",
    "ai-admissions-bias-audit-input-builder",
    "audit-trail-summarizer",
    "regulatory-update-tracker",
  ],

  hitlRules: [
    {
      id: "education-grading-decisions-educator-signoff",
      description:
        "Final grading decisions are NEVER auto-committed. Agents " +
        "draft feedback, apply rubrics, surface inconsistencies — but " +
        "the responsible educator (teacher / professor / TA-of-record) " +
        "must Ed25519-sign every final grade before it posts to the " +
        "student record. Defends against 14th Amendment due-process " +
        "claims + state-by-state grading-appeal procedures.",
      trigger:
        "agent.action == 'grade.final.commit' OR " +
        "agent.action == 'grade.posting.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FERPA 20 USC §1232g(a)(2) (right to challenge inaccurate " +
        "records); state-by-state grading-appeal due process; AAC&U " +
        "academic-integrity standards",
    },
    {
      id: "education-ai-admissions-bias-audit-required",
      description:
        "Any agent that screens / scores / recommends admissions " +
        "decisions automatically triggers bias-audit data collection " +
        "across protected classes (race, sex, national origin, " +
        "disability, age). NYC LL144 applies to K-12 NYC admissions; " +
        "Colorado SB 24-205 covers consequential education decisions; " +
        "Title VI applies federally to all federally-funded schools. " +
        "The agent NEVER autonomously rejects an applicant.",
      trigger:
        "agent.action == 'admissions.application.score' OR " +
        "agent.action == 'admissions.application.screen'",
      requiredApprovers: 1,
      regulatoryCitation:
        "Title VI of the Civil Rights Act 42 USC §2000d; NYC Local " +
        "Law 144 (2021); Colorado SB 24-205; Department of Education " +
        "AI Guidance (2024); 34 CFR Part 100 (Title VI implementation)",
    },
    {
      id: "education-iep-504-compliance-officer-signoff",
      description:
        "Agent-drafted Individualized Education Programs (IEPs) under " +
        "IDEA, or Section 504 plans, require the LEA's Special Education " +
        "Director / 504 Coordinator's Ed25519 signature. Agents draft; " +
        "the responsible compliance officer signs. Defends Office for " +
        "Civil Rights complaints + IDEA-due-process hearings.",
      trigger:
        "agent.action == 'iep.draft.commit' OR " +
        "agent.action == 'section_504_plan.draft.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "IDEA 20 USC §1400 et seq.; Section 504 of the Rehabilitation " +
        "Act 29 USC §794; 34 CFR Part 300 (IDEA implementation); " +
        "34 CFR §104 (Section 504 implementation)",
    },
    {
      id: "education-title-ix-incident-intake-counsel-required",
      description:
        "Title IX incident intake (sexual harassment, sex discrimination " +
        "reports) is NEVER auto-resolved. The agent records the report; " +
        "the Title IX Coordinator + General Counsel must review and sign " +
        "every disposition before any action is taken. Defends OCR Title " +
        "IX investigations + private litigation under the 2020/2024 " +
        "regulations.",
      trigger:
        "agent.action LIKE 'title_ix.%' OR " +
        "agent.action == 'sexual_harassment.report.intake'",
      requiredApprovers: 2,
      regulatoryCitation:
        "Title IX 20 USC §1681; 34 CFR Part 106 (2020 + 2024 " +
        "amendments); OCR Title IX investigation procedures",
    },
    {
      id: "education-coppa-under-13-block",
      description:
        "If platform detects user is under 13 (per COPPA Verifiable " +
        "Parental Consent rules), agent-driven personalization, " +
        "behavioral targeting, marketing, or third-party data sharing " +
        "is HARD-BLOCKED. FTC TikTok 2025 settlement was $245M — " +
        "education is the next major COPPA enforcement frontier per " +
        "FTC AI Guidance.",
      trigger:
        "agent.action LIKE 'personalize.%' AND user.age < 13",
      requiredApprovers: 0, // hard block
      regulatoryCitation:
        "COPPA 15 USC §6501-6506; 16 CFR Part 312; FTC enforcement " +
        "(TikTok $245M 2025); FTC AI Guidance (May 2024)",
    },
    {
      id: "education-state-student-data-export-validator",
      description:
        "Any agent action exporting student PII to a third party " +
        "(EdTech vendor, contractor, researcher) is HARD-BLOCKED " +
        "until a State Student Data Privacy Act compliance check " +
        "validates: (1) the vendor agreement exists, (2) the use " +
        "is for school-purposes only, (3) state-specific notification " +
        "requirements are met. NY ED Law §2-d, CA SOPIPA, CO HB 22-1244, " +
        "IL SIPA all impose distinct requirements.",
      trigger:
        "agent.action LIKE 'export.student_data.%' OR " +
        "agent.scope == 'export.student_pii'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FERPA 20 USC §1232g; NY Education Law §2-d; California " +
        "SOPIPA (Cal. Civ. Code §22584); Colorado HB 22-1244; " +
        "Illinois SIPA (105 ILCS 85); Connecticut PA-22-25",
    },
    {
      id: "education-accessibility-accommodation-tracking",
      description:
        "Every disability accommodation request (ADA Title II for " +
        "public schools, Title III for private + EdTech platforms) " +
        "is logged with full interaction trace + accessibility " +
        "coordinator signature chain. Defends Robles-class private " +
        "litigation + OCR enforcement under Section 504/ADA.",
      trigger:
        "agent.action == 'accommodation.request.detected' OR " +
        "agent.action == 'accommodation.granted.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "ADA Title II + Title III (42 USC §12131 + 12181); " +
        "Section 504 of Rehabilitation Act; 34 CFR §104; Robles v. " +
        "Domino's (9th Cir. 2019); WCAG 2.1 AA",
    },
    {
      id: "education-attendance-truancy-counselor-required",
      description:
        "Agent-detected attendance anomalies (chronic absence patterns, " +
        "potential truancy triggers) are flagged to a school counselor " +
        "or designated administrator BEFORE any state-mandated truancy " +
        "report is filed. Wrongful truancy referrals can trigger " +
        "child-welfare investigations + state mandatory reporting laws.",
      trigger:
        "agent.action == 'truancy.report.draft' OR " +
        "agent.action == 'chronic_absence.threshold.detected'",
      requiredApprovers: 1,
      regulatoryCitation:
        "State-by-state mandatory truancy-reporting laws (CA Educ. " +
        "Code §48260, NY Educ. Law §3202, etc.); ESSA accountability " +
        "metrics 20 USC §6311(c)(4)(B)(iv)",
    },
  ],

  auditQueries: [
    {
      id: "education-audit-ferpa-access-events-1825d",
      title:
        "FERPA student-record access events + audit chain (5 years — " +
        "matches 34 CFR §99.32(a)(2) retention)",
      description:
        "Every agent action accessing a student record: who accessed, " +
        "when, what fields, the legitimate-educational-interest " +
        "justification. The FERPA §99.32(a)(2) audit trail by design.",
      audienceContext:
        "FERPA Family Policy Compliance Office investigation; OCR " +
        "audit; private FERPA litigation",
      actionPrefix: "agent.student.access.",
      defaultWindowDays: 1825,
    },
    {
      id: "education-audit-grading-decisions-1825d",
      title: "Grading decisions + educator-signoff chain (5 years)",
      description:
        "Every agent-influenced grading decision, the educator who " +
        "signed it, the rubric applied, the appeal pathway. Defends " +
        "academic-integrity disputes + 14th Amendment due-process claims.",
      audienceContext:
        "Academic appeal; 14th Amendment due-process litigation; " +
        "AAC&U accreditation review",
      actionPrefix: "agent.grade.",
      defaultWindowDays: 1825,
    },
    {
      id: "education-audit-admissions-bias-1095d",
      title:
        "AI-in-admissions bias-audit dataset (3 years — covers " +
        "extended Title VI charge windows)",
      description:
        "Every agent admissions screening/scoring decision, the " +
        "input features used, the score produced, the demographic " +
        "category bucket (when voluntarily disclosed), the eventual " +
        "outcome. Feeds NYC LL144 + CO SB 24-205 annual independent " +
        "bias audits + Title VI complaint defense.",
      audienceContext:
        "OCR Title VI investigation; NYC DCWP LL144 bias audit; " +
        "Colorado AG SB 24-205 enforcement",
      actionPrefix: "agent.admissions.",
      defaultWindowDays: 1095,
    },
    {
      id: "education-audit-iep-504-decisions-2555d",
      title:
        "IEP / Section 504 plan history + compliance officer signoffs " +
        "(7 years — matches IDEA + Section 504 retention requirements)",
      description:
        "Every IEP / 504 plan version, signature chain, parent " +
        "consent, accommodation tracking. Defends OCR + IDEA-due-" +
        "process hearings.",
      audienceContext:
        "OCR Section 504 investigation; IDEA due-process hearing; " +
        "private special-education litigation",
      actionPrefix: "agent.iep.",
      defaultWindowDays: 2555, // 7 years
    },
    {
      id: "education-audit-title-ix-incidents-2555d",
      title:
        "Title IX incident intake + Coordinator + GC signature chain " +
        "(7 years — matches recommended Title IX retention)",
      description:
        "Every Title IX report received, agent-drafted intake, " +
        "Coordinator + GC review, disposition, supportive measures. " +
        "Defends OCR Title IX investigations.",
      audienceContext: "OCR Title IX investigation; private litigation",
      actionPrefix: "agent.title_ix.",
      defaultWindowDays: 2555,
    },
    {
      id: "education-audit-state-data-exports-1825d",
      title:
        "State Student Data Privacy Act compliance for every export " +
        "(5 years)",
      description:
        "Every student PII export attempt, the state-specific compliance " +
        "validation result, the vendor agreement on file, the school-" +
        "purpose-only attestation. Defends NY ED §2-d / CA SOPIPA / " +
        "CO HB 22-1244 / IL SIPA enforcement.",
      audienceContext:
        "State AG enforcement (NY, CA, CO, IL); state DOE audits",
      actionPrefix: "agent.export.student_data.",
      defaultWindowDays: 1825,
    },
    {
      id: "education-audit-coppa-under13-blocks-365d",
      title:
        "COPPA HARD-BLOCK events for under-13 personalization attempts",
      description:
        "Every blocked personalization / behavioral-targeting attempt " +
        "for users under 13. Demonstrates the technical infrastructure " +
        "was working when challenged — the FTC TikTok-class enforcement " +
        "defense.",
      audienceContext: "FTC COPPA investigation; state AG enforcement",
      actionPrefix: "agent.coppa.under13.blocked",
      defaultWindowDays: 365,
    },
    {
      id: "education-audit-anomalies-365d",
      title: "Anomaly Events in Education Agent Fleet (365 days)",
      description:
        "Audit-chain anomalies, R73 multi-turn jailbreak attempts " +
        "(students testing AI tutors is a known attack surface), " +
        "reputation downgrades, ACT revocations.",
      audienceContext: "Internal IT review; pre-audit risk assessment",
      actionPrefix: "anomaly.",
      defaultWindowDays: 365,
    },
  ],

  slaTier: "professional",

  keyOutcomes: [
    "FERPA §99.32(a)(2) audit trail BY DESIGN — every student-record " +
      "access logged immutably with legitimate-educational-interest " +
      "justification",
    "Grading decisions ALWAYS have a named educator signer; defends " +
      "academic-appeal due-process + AAC&U accreditation review",
    "AI-in-admissions bias-audit data collected automatically — NYC " +
      "LL144 + CO SB 24-205 + federal Title VI compliance by design",
    "IEP / Section 504 compliance officer signature on every plan; " +
      "defends OCR + IDEA-due-process hearings",
    "Title IX incident intake REQUIRES Coordinator + GC dual signature; " +
      "defends 2020/2024 Title IX rule enforcement",
    "COPPA HARD-BLOCK on under-13 personalization (FTC $245M TikTok " +
      "defense by infrastructure)",
    "State Student Data Privacy Act multi-state compliance: NY ED §2-d, " +
      "CA SOPIPA, CO HB 22-1244, IL SIPA, CT PA-22-25 all checked " +
      "before exports proceed",
    "ADA Title II/III accessibility-interaction logging defends Robles-" +
      "class education-platform litigation",
  ],

  defaultDailyLimitCents: 10_000, // $100/day — education budget reality

  defaultActScopes: {
    // Read-only by default. Education agents draft, score, alert,
    // analyze, suggest — they NEVER autonomously commit grades, post
    // disciplinary records, modify IEPs, or send parent communications.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.draft.*",
      "agent.score.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.analyze.*",
      "agent.suggest.*",
      "agent.classify.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 20_000,
    maxAcvUsd: 100_000,
    targetCustomerSize:
      "K-12 school districts (>10,000 students), higher-education " +
      "institutions (4-year colleges + universities + community college " +
      "systems), EdTech platforms (Canvas, Blackboard, Schoology, " +
      "PowerSchool, Infinite Campus, Kahoot, Khan Academy scale), and " +
      "learning-management-system vendors handling student PII subject " +
      "to FERPA + state student-data-privacy laws. Pricing scales with " +
      "student count and regulatory complexity (multi-state EdTech " +
      "platforms pay top of range).",
  },
};

export function getEducationPack(): VerticalPack {
  return EDUCATION_PACK;
}

export function isAgentEnabledInEducationPack(agentId: string): boolean {
  return EDUCATION_PACK.enabledAgents.includes(agentId);
}
