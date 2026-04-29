/**
 * FEDRAMP / GOVERNMENT COMPLIANCE PACK (R53).
 *
 * The fourth vertical product. Sold to federal civilian agencies,
 * DoD program offices, federal-systems-integrators (Booz Allen, Leidos,
 * SAIC, ManTech, Northrop, Lockheed, etc.), and federal/state CIO/CISO
 * offices facing FedRAMP Moderate/High + CMMC Level 2/3 + DFARS
 * 7012 + FISMA + Section 889 obligations.
 *
 * The wedge: every federal AI deployment must satisfy:
 *   1. FedRAMP authorization (NIST SP 800-53 controls + ConMon)
 *   2. CMMC Level 2/3 for CUI handling (NIST SP 800-171)
 *   3. DFARS 252.204-7012 (incident reporting + cyber-incident
 *      damage assessment)
 *   4. FISMA Annual Assessment + ATO renewal
 *   5. Section 889 supply-chain prohibition
 *   6. Executive Order 13526 classified-info handling
 *   7. False Claims Act exposure on CMMC + DFARS attestations
 *      (the United States ex rel. Rosales DOJ enforcement track)
 *
 * Why this pack exists: federal AI deployment without this pack
 * exposes the prime contractor to FCA whistleblower suits + ATO
 * loss + Section 889-driven debarment. WITH this pack: every
 * attestation has a named human signer (R34 CADC); every CUI flow
 * is audit-chained (R26); every incident is escalated within 72h
 * to the AO and 1h within the prime; every FOIA response has GC
 * counsel sign-off.
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack does NOT process CLASSIFIED data. The HITL rules
 *     HARD-BLOCK any agent action that would touch Confidential/
 *     Secret/Top-Secret data. Classified workflows require IL5+ /
 *     classified-cloud deployment, not the commercial substrate.
 *   - We are NOT an Authorizing Official. Customer's AO authorizes.
 *   - We are NOT cleared personnel. Customer's cleared workforce
 *     handles cleared workflows.
 *
 * Pricing: $100K-$10M ACV. Target: federal civilian agencies, DoD
 * program offices, top-50 federal-systems-integrators.
 */

import type { VerticalPack } from "./types";

export const FEDRAMP_GOVERNMENT_PACK: VerticalPack = {
  id: "fedramp-government-v1",
  name: "FedRAMP & Government Compliance Pack",
  summary:
    "FedRAMP-authorized AI agent infrastructure for federal civilian + DoD " +
    "+ federal-systems-integrator workloads. Every CUI-touching agent " +
    "action is signed by an authorized federal user's Ed25519 key " +
    "(R34 CADC); every ATO/SSP section is gated by ISSO sign-off; " +
    "every CMMC attestation has a named SISM signer (False Claims Act " +
    "defense by design); every supply-chain decision passes through " +
    "Section 889 dual-approval; every security incident is auto-" +
    "escalated within FISMA / DFARS 7012 windows. CLASSIFIED data is " +
    "HARD-BLOCKED at the agent boundary — this pack is for " +
    "controlled-unclassified information (CUI) only.",
  version: "1.0.0",
  industry: "Government — federal civilian, DoD, FSI, federal/state CIO/CISO",
  targetBuyerPersona:
    "Federal CISO, Authorizing Official (AO), Information System Security " +
    "Officer (ISSO), Director of Cybersecurity, or Federal Program Manager " +
    "at federal civilian agencies (HHS, DHS, Treasury, etc.), DoD program " +
    "offices, top-50 federal-systems-integrators (Booz Allen, Leidos, SAIC, " +
    "ManTech, Northrop, Lockheed, etc.), or state CIO/CISO offices " +
    "(StateRAMP applicable).",

  complianceFrameworks: [
    "fedramp-moderate",
    "fedramp-high",
    "cmmc-level-2",
    "cmmc-level-3",
    "nist-ai-rmf",
    "soc2-type-ii",
    "iso-27001",
  ],

  enabledAgents: [
    "cui-classifier",
    "ssp-section-drafter",
    "ato-package-assembler",
    "poam-tracker",
    "conmon-evidence-collector",
    "cmmc-evidence-collector",
    "supply-chain-risk-analyst",
    "incident-response-drafter",
    "incident-72h-report-drafter",
    "foia-request-processor",
    "fisma-annual-assessment-prep",
    "stig-compliance-checker",
    "section-889-vendor-screener",
    "regulatory-update-tracker",
    "audit-trail-summarizer",
  ],

  hitlRules: [
    {
      id: "fedramp-classified-data-hard-block",
      description:
        "Agents are HARD-BLOCKED from any action that would touch " +
        "classified data (Confidential, Secret, Top Secret, SCI, SAP). " +
        "There is NO override pathway from this pack — classified " +
        "workflows require IL5+ / classified-cloud deployment with " +
        "cleared personnel. The pack is for CUI only.",
      trigger:
        "agent.action.touches_classified == true OR " +
        "input.classification IN ('CONFIDENTIAL', 'SECRET', 'TOP SECRET', 'TS/SCI', 'SAP')",
      requiredApprovers: 0, // hard block — no human override path
      regulatoryCitation:
        "Executive Order 13526 (Classified National Security Information); " +
        "32 CFR Part 2001; ICD 503; 18 USC 798 (criminal penalties)",
    },
    {
      id: "fedramp-cui-export-ao-approval",
      description:
        "Any agent action that would export CUI (Controlled " +
        "Unclassified Information) outside the FedRAMP-authorized " +
        "boundary requires the Authorizing Official's explicit Ed25519 " +
        "signature (R34 CADC). The agent flags; the AO decides. This " +
        "rule is the cross-domain leakage defense.",
      trigger:
        "agent.action LIKE 'export.cui.%' OR " +
        "agent.scope == 'cross_domain.cui_movement'",
      requiredApprovers: 1,
      regulatoryCitation:
        "32 CFR Part 2002 (CUI program); NIST SP 800-171 §3.1.3 (CUI flow); " +
        "NIST SP 800-53 AC-4 (information flow enforcement); EO 13556",
    },
    {
      id: "fedramp-ato-package-isso-signoff",
      description:
        "Any agent-drafted section of the System Security Plan (SSP), " +
        "Security Assessment Report (SAR), or Plan of Action & " +
        "Milestones (POA&M) requires the Information System Security " +
        "Officer's R34 signature before submission to the Authorizing " +
        "Official. The agent drafts; the ISSO signs. The signature " +
        "chain is the FOIA-discoverable record of who approved what " +
        "for the ATO.",
      trigger:
        "agent.action == 'ssp.section.commit' OR " +
        "agent.action == 'sar.section.commit' OR " +
        "agent.action == 'poam.entry.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "NIST SP 800-37 Rev 2 (RMF); FedRAMP SSP Template; " +
        "OMB Circular A-130",
    },
    {
      id: "fedramp-supply-chain-section-889-dual-approval",
      description:
        "Any agent-flagged supply-chain risk decision (vendor " +
        "onboarding, software-bill-of-materials review, FOCI screening, " +
        "Section 889 covered-equipment check) requires DUAL approval: " +
        "the Contracting Officer AND the SCRM lead. False Claims Act " +
        "exposure attaches to the prime contractor for inaccurate " +
        "Section 889 representations.",
      trigger:
        "agent.action == 'supply_chain.vendor.risk_assessed' OR " +
        "agent.action == 'section_889.vendor.flagged' OR " +
        "agent.action == 'foci.vendor.flagged'",
      requiredApprovers: 2,
      regulatoryCitation:
        "FAR 4.21 (Section 889 prohibition); DFARS 252.204-7019/7020/7021 " +
        "(NIST SP 800-171 attestation); 31 USC 3729 (False Claims Act); " +
        "Executive Order 14034 (foreign-controlled covered equipment)",
    },
    {
      id: "fedramp-cmmc-evidence-sism-signoff",
      description:
        "Any CMMC Level 2/3 evidence package submitted to the Cyber-AB " +
        "or to a primary contractor for SISM (Senior Information Systems " +
        "Manager) attestation requires explicit SISM Ed25519 signature " +
        "via R34 CADC. The False Claims Act exposes the prime to treble " +
        "damages + per-claim penalties for inaccurate CMMC self-" +
        "attestations (United States ex rel. Markus, U.S. ex rel. Rosales " +
        "track). The signature chain becomes the FCA defense record.",
      trigger:
        "agent.action == 'cmmc.evidence.commit' OR " +
        "agent.action == 'cmmc.self_attestation.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "31 USC 3729-3733 (False Claims Act + qui tam); " +
        "DFARS 252.204-7019/7020/7021; CMMC Final Rule (32 CFR Part 170 + " +
        "DFARS Final Rule 88 FR 76200); United States ex rel. Markus " +
        "(D. Md. 2022)",
    },
    {
      id: "fedramp-incident-72h-and-1h-reporting",
      description:
        "Detected security incidents are auto-escalated: 1 hour to the " +
        "ISSO + AO; 72 hours to DoD Cyber Crime Center (DC3) for cleared " +
        "DoD contractors per DFARS 7012; per FedRAMP ConMon, US-CERT " +
        "notification within applicable window. The agent drafts the " +
        "incident report; ISSO + AO sign before submission.",
      trigger: "agent.action == 'incident.detected'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FISMA (44 USC 3554); DFARS 252.204-7012(c) (72-hour reporting); " +
        "FedRAMP Continuous Monitoring Strategy v1.0; OMB M-22-09",
    },
    {
      id: "fedramp-foia-counsel-signoff",
      description:
        "Agent-drafted FOIA responses (initial determination, denial " +
        "letter, redaction list) require Office of General Counsel " +
        "review + R34 signature before transmission. FOIA exemptions " +
        "must be tied to a statutory citation; agent-suggested " +
        "exemption application is REVIEWED, not auto-applied.",
      trigger:
        "agent.action == 'foia.response.draft' OR " +
        "agent.action == 'foia.denial.draft' OR " +
        "agent.action == 'foia.redaction.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FOIA (5 USC 552); DOJ FOIA Improvement Act of 2016; " +
        "agency-specific FOIA regulations (e.g., 32 CFR Part 286 for DoD)",
    },
    {
      id: "fedramp-stig-deviation-aor-signoff",
      description:
        "STIG (Security Technical Implementation Guide) deviation " +
        "requests cannot be agent-auto-applied. The agent identifies " +
        "the deviation; the Authorizing Official Representative (AOR) " +
        "evaluates risk acceptance and signs off via R34 CADC. The " +
        "POA&M auto-tracks the residual risk.",
      trigger:
        "agent.action == 'stig.deviation.request' OR " +
        "agent.action == 'stig.exception.committed'",
      requiredApprovers: 1,
      regulatoryCitation:
        "DISA STIG framework; NIST SP 800-53 RA-5 (vulnerability scanning); " +
        "NIST SP 800-37 Rev 2 risk-acceptance procedures",
    },
  ],

  auditQueries: [
    {
      id: "fedramp-audit-cui-flows-365d",
      title: "CUI Flow Activity (365 days)",
      description:
        "Every agent action that touched CUI: flow direction, " +
        "destination boundary, AO sign-off chain. Required for " +
        "FedRAMP ConMon + CUI program annual report.",
      audienceContext:
        "FedRAMP Continuous Monitoring; CUI program annual; FOIA",
      actionPrefix: "agent.cui.",
      defaultWindowDays: 365,
    },
    {
      id: "fedramp-audit-ato-package-history-1095d",
      title: "ATO Package Composition + ISSO Signature History (3 years)",
      description:
        "Every SSP / SAR / POA&M section ever drafted, the ISSO who " +
        "signed each, and the AO authorization decision. Required for " +
        "ATO renewal + FOIA litigation defense.",
      audienceContext: "ATO renewal; FOIA litigation; OIG inspection",
      actionPrefix: "agent.ato.",
      defaultWindowDays: 1095, // 3 years (ATO cycle)
    },
    {
      id: "fedramp-audit-incidents-365d",
      title: "Security Incident Pipeline (365 days)",
      description:
        "Every detected incident: detection time, 1-hour ISSO/AO " +
        "notification, 72-hour DC3 report (if DoD), US-CERT escalation, " +
        "remediation. Required for FISMA annual assessment + DFARS 7012 " +
        "compliance.",
      audienceContext:
        "FISMA Annual Assessment; DFARS 7012 audit; OIG IT inspection",
      actionPrefix: "agent.incident.",
      defaultWindowDays: 365,
    },
    {
      id: "fedramp-audit-foia-pipeline-365d",
      title: "FOIA Request Pipeline (365 days)",
      description:
        "Every FOIA request received: agent-drafted determination, " +
        "GC sign-off chain, redaction-by-exemption list, response " +
        "transmission timestamp. Defends against improper-withholding " +
        "lawsuits.",
      audienceContext: "FOIA litigation; agency annual FOIA report",
      actionPrefix: "agent.foia.",
      defaultWindowDays: 365,
    },
    {
      id: "fedramp-audit-cmmc-evidence-1095d",
      title: "CMMC Evidence Provenance (3 years)",
      description:
        "Every CMMC Level 2/3 evidence artifact: who collected, " +
        "what control it covers, the SISM signature, the C3PAO " +
        "assessment record (if Level 3). The False Claims Act defense " +
        "record — proves the prime had reasonable basis for each " +
        "self-attestation.",
      audienceContext:
        "C3PAO triennial assessment; DOJ FCA defense; DCMA audit",
      actionPrefix: "agent.cmmc.",
      defaultWindowDays: 1095, // 3 years (CMMC assessment cycle)
    },
    {
      id: "fedramp-audit-supply-chain-365d",
      title: "Supply-Chain Risk Decisions (365 days)",
      description:
        "Every Section 889 vendor screening, FOCI determination, SBOM " +
        "review, and SCRM-Lead sign-off. Defends against debarment " +
        "actions + Section 889 violations.",
      audienceContext: "DCMA audit; Section 889 enforcement; debarment defense",
      actionPrefix: "agent.supply_chain.",
      defaultWindowDays: 365,
    },
    {
      id: "fedramp-audit-anomalies-365d",
      title: "Anomaly Events in Government Agent Fleet (365 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, ACT revocations, " +
        "STIG-deviation flags. The 'has anything bad happened in our " +
        "FedRAMP boundary' query.",
      audienceContext: "FedRAMP ConMon; OIG inspection; AO risk review",
      actionPrefix: "anomaly.",
      defaultWindowDays: 365,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "Classified data HARD-BLOCKED at agent boundary — no commercial-cloud " +
      "spillover risk",
    "Every ATO/SSP/POA&M section signed by ISSO via R34 CADC — FedRAMP " +
      "auditor sees the signature chain end-to-end",
    "CMMC self-attestations have named SISM signers (False Claims Act " +
      "qui-tam defense by design)",
    "Section 889 vendor screening + dual approval — DOJ debarment defense",
    "Incident response auto-escalates within FISMA / DFARS 7012 windows " +
      "(1-hour internal, 72-hour DC3)",
    "FOIA pipeline gated by GC counsel — improper-withholding defense",
    "CUI flow tracking with AO sign-off on cross-domain movement",
    "Customer-managed audit-log export to YOUR agency S3 bucket (R45) — " +
      "your audit trail is FOIA-discoverable from your OWN systems",
  ],

  defaultDailyLimitCents: 30_000, // $300/day (federal ConMon volume is real)

  defaultActScopes: {
    // Read-only by default. Government agents draft + analyze; humans
    // sign every adverse action, every attestation, every commitment.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.draft.*",
      "agent.classify.*",
      "agent.analyze.*",
      "agent.summary.*",
      "agent.alert.*",
      "agent.collect.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 100_000,
    maxAcvUsd: 10_000_000,
    targetCustomerSize:
      "Federal civilian agencies (HHS, DHS, Treasury, etc.), DoD program " +
      "offices, top-50 federal-systems-integrators (Booz Allen Hamilton, " +
      "Leidos, SAIC, ManTech, Northrop Grumman, Lockheed Martin, Raytheon, " +
      "etc.), state CIO/CISO offices (StateRAMP), and CMMC-accredited " +
      "primes handling DoD CUI. Deal sizes scale with FedRAMP boundary " +
      "size + CMMC level + agent volume.",
  },
};

export function getFedrampGovernmentPack(): VerticalPack {
  return FEDRAMP_GOVERNMENT_PACK;
}

export function isAgentEnabledInFedrampPack(agentId: string): boolean {
  return FEDRAMP_GOVERNMENT_PACK.enabledAgents.includes(agentId);
}
