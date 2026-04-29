/**
 * BANKING COMPLIANCE VERTICAL PACK (R47).
 *
 * The first product. Sold to community banks, credit unions, RIAs,
 * and fintechs whose compliance officers face OCC / SEC / FINRA /
 * FFIEC examinations.
 *
 * The wedge: this pack maps every primitive in our trust stack
 * (R26 audit, R34 CADC, R37 ACTs, R38 KYA, R44 reliability, R45
 * audit-export) to specific OCC Handbook / FFIEC IT Handbook /
 * SEC Rule 17a-4 / FINRA 3110 controls.
 *
 * What the pack actually does for a customer:
 *
 *   1. Curates the agent surface to compliance-relevant agents only
 *      (no marketing automation, no spam tools — the surface itself
 *      is examination-defensible).
 *   2. Forces HITL approval on any decision that touches sensitive
 *      financial data or could trigger a SAR/CTR filing.
 *   3. Pre-configures ACT scopes to "read-only" by default — agents
 *      can analyze, alert, and draft, but cannot transact.
 *   4. Ships pre-built examination queries: "show me every agent
 *      decision in the last 30 days that touched account data" is
 *      one click, not a SQL session.
 *   5. Maps to the controls examiners actually cite — so when the
 *      OCC examiner asks "how do you satisfy 12 CFR 30 Appendix B,
 *      Part III(C)(1)(d)" the answer is a file path + a query.
 *
 * Pricing: $25-150K ACV. Target: community banks ($1-10B AUM),
 * credit unions, mid-market RIAs, fintech compliance teams.
 */

import type { VerticalPack } from "./types";

export const BANKING_COMPLIANCE_PACK: VerticalPack = {
  id: "banking-compliance-v1",
  name: "Banking Compliance Pack",
  summary:
    "Examination-ready AI agent infrastructure for community banks, credit " +
    "unions, RIAs, and fintech compliance teams. Every agent action is " +
    "Ed25519-signed, hash-chained, HITL-gated above policy thresholds, and " +
    "auditable down to the byte by examiners.",
  version: "1.0.0",
  industry: "Financial services — depository + investment compliance",
  targetBuyerPersona:
    "Chief Compliance Officer, BSA Officer, or VP of Risk at community banks " +
    "($1-10B AUM), credit unions, mid-market RIAs, or fintechs preparing for " +
    "OCC / SEC / FINRA / FFIEC examinations.",

  complianceFrameworks: [
    "soc2-type-ii",
    "occ-handbook",
    "ffiec-it-handbook",
    "sec-rule-17a-4",
    "finra-3110",
    "nist-ai-rmf",
    "iso-27001",
  ],

  // Curated agent allowlist — only agents that make sense in a
  // bank's compliance surface. NO sales / marketing agents.
  enabledAgents: [
    "compliance-monitor",
    "transaction-pattern-analyst",
    "regulatory-update-tracker",
    "policy-drift-detector",
    "kyc-document-reviewer",
    "aml-pattern-detector",
    "sar-draft-assistant",
    "ctr-draft-assistant",
    "vendor-risk-analyst",
    "examination-readiness-scorecard",
    "audit-trail-summarizer",
    "policy-document-summarizer",
    "regulatory-filing-quality-checker",
  ],

  // Banking-specific HITL rules layered on platform defaults.
  hitlRules: [
    {
      id: "banking-sar-ctr-must-be-human-approved",
      description:
        "Any agent draft of a Suspicious Activity Report (SAR) or " +
        "Currency Transaction Report (CTR) requires Compliance Officer " +
        "approval before submission. The agent NEVER files autonomously.",
      trigger:
        "agent.action == 'sar.draft' OR agent.action == 'ctr.draft' OR " +
        "agent.action == 'fincen.submit'",
      requiredApprovers: 1,
      regulatoryCitation: "31 CFR 1020.320 (BSA reporting requirements)",
    },
    {
      id: "banking-customer-data-export-dual-approval",
      description:
        "Any agent action exporting customer NPI (non-public personal " +
        "information) to an external system requires DUAL approval: a " +
        "compliance officer AND the data owner.",
      trigger:
        "agent.scope == 'export.customer_data' OR " +
        "agent.action LIKE 'export.npi.%'",
      requiredApprovers: 2,
      regulatoryCitation:
        "GLBA Safeguards Rule (16 CFR 314); FFIEC IT Handbook " +
        "(Information Security Booklet, IV.D)",
    },
    {
      id: "banking-policy-change-detection-alerts",
      description:
        "Agent-detected drift in regulatory policy (e.g., a new OCC " +
        "bulletin) triggers HITL review by the BSA Officer within 5 " +
        "business days.",
      trigger: "agent.action == 'policy.drift.detected'",
      requiredApprovers: 1,
      regulatoryCitation: "OCC Handbook — Compliance Management Systems",
    },
    {
      id: "banking-vendor-onboarding-must-be-reviewed",
      description:
        "Agent-generated vendor risk assessments cannot trigger automatic " +
        "onboarding. Compliance must approve before procurement proceeds.",
      trigger: "agent.action == 'vendor.risk_score_complete'",
      requiredApprovers: 1,
      regulatoryCitation:
        "OCC Bulletin 2013-29 (Third-Party Risk Management); 12 CFR 30",
    },
    {
      id: "banking-examination-response-cant-go-out-without-cco",
      description:
        "Any agent-drafted response to an OCC, SEC, FINRA, or FFIEC " +
        "examination request is held until the Chief Compliance Officer " +
        "personally signs (R34 CADC).",
      trigger: "agent.action == 'examination.response.draft'",
      requiredApprovers: 1,
      regulatoryCitation: "12 USC 1820 (examination authority)",
    },
  ],

  // Canned audit queries an examiner actually requests.
  auditQueries: [
    {
      id: "banking-audit-customer-data-touches-30d",
      title: "Every agent action touching customer data (last 30 days)",
      description:
        "Returns the full audit log of any agent action where the " +
        "resource was a customer record. Used in OCC information-security " +
        "reviews.",
      audienceContext: "OCC IT examination, SOC 2 CC6.1",
      actionPrefix: "agent.customer.",
      defaultWindowDays: 30,
    },
    {
      id: "banking-audit-sar-ctr-pipeline-90d",
      title: "Full SAR / CTR draft → human approval → submission timeline",
      description:
        "Reconstructs the BSA reporting pipeline: agent drafts, who " +
        "approved, when, with which signing key. Demonstrates that AI " +
        "did NOT autonomously file regulatory reports.",
      audienceContext: "FinCEN BSA examination",
      actionPrefix: "agent.bsa.",
      defaultWindowDays: 90,
    },
    {
      id: "banking-audit-vendor-risk-decisions-365d",
      title: "Vendor risk decisions and approval signatures (last year)",
      description:
        "Every third-party risk assessment, who reviewed it, what was " +
        "approved/rejected, and the cryptographic signature chain.",
      audienceContext: "OCC Bulletin 2013-29 third-party risk review",
      actionPrefix: "agent.vendor.",
      defaultWindowDays: 365,
    },
    {
      id: "banking-audit-examination-response-180d",
      title: "All examination-response artifacts and their approval chain",
      description:
        "Examination prep + response artifacts the agents produced, the " +
        "compliance officer who signed off, and the timestamps.",
      audienceContext: "Internal audit; multi-examination response audits",
      actionPrefix: "agent.examination.",
      defaultWindowDays: 180,
    },
    {
      id: "banking-audit-anomalies-180d",
      title: "Anomaly events in the agent fleet (last 180 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, capability-token " +
        "revocations. The 'has anything bad happened' query.",
      audienceContext: "OCC IT examination; SOC 2 CC7.3",
      actionPrefix: "anomaly.",
      defaultWindowDays: 180,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "Examination response time reduced from weeks to hours via canned audit queries",
    "Every agent action signed by the compliance officer's Ed25519 key (R34 CADC)",
    "Audit chain hash-verified every 6h; tampering surfaces immediately",
    "Customer-managed audit-log export to YOUR S3 bucket (R45) — even if Sovereign vanishes, your audit trail survives",
    "Insurable agent-action liability via R46 underwriting (carrier-pricable)",
    "OCC IT examination pre-pack: every relevant control with a file path + a verifier command",
    "HITL gates on every decision that could trigger SAR/CTR filing — agents NEVER file autonomously",
    "Vendor risk assessments cannot auto-onboard third parties (12 CFR 30 compliance)",
  ],

  // Banking compliance is read-heavy. Default cap is conservative;
  // R42 credit line will widen for proven-trusted agents.
  defaultDailyLimitCents: 10_000, // $100/day — modest, expected use

  defaultActScopes: {
    // Read-only by default. Compliance agents analyze + draft + alert,
    // they don't transact. Spend agents go through a separate approval
    // workflow.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.draft.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.analyze.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 25_000,
    maxAcvUsd: 150_000,
    targetCustomerSize:
      "Community banks ($1-10B AUM), credit unions ($500M+ assets), " +
      "mid-market RIAs ($1B+ AUM), fintech compliance teams",
  },
};

/**
 * Pure helpers. Used by the public endpoint + the inspector.
 */

export function getBankingCompliancePack(): VerticalPack {
  return BANKING_COMPLIANCE_PACK;
}

export function isAgentEnabledInPack(
  pack: VerticalPack,
  agentId: string,
): boolean {
  return pack.enabledAgents.includes(agentId);
}

export function findAuditQueryById(
  pack: VerticalPack,
  queryId: string,
): VerticalPack["auditQueries"][number] | null {
  return pack.auditQueries.find((q) => q.id === queryId) ?? null;
}
