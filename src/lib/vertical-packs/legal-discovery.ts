/**
 * LEGAL E-DISCOVERY & CHAIN-OF-CUSTODY PACK (R52).
 *
 * The third vertical product. Sold to BigLaw firms, in-house legal
 * teams at Fortune 1000 companies, e-discovery vendors, and
 * litigation-support service providers.
 *
 * The wedge: chain of custody is the entire legal profession.
 * Every document review, every produced exhibit, every privileged
 * communication, every deposition transcript — all of it must be
 * auditable end-to-end. R26 audit chain + R34 user-signed actions
 * IS the chain-of-custody primitive that legal teams have been
 * faking with PDFs and Bates numbers for 30 years.
 *
 * Why legal third (after banking + healthcare):
 *   - Same regulatory-defensibility playbook
 *   - Federal Rules of Evidence (FRE 901-902) require chain of
 *     custody — our audit chain satisfies it CRYPTOGRAPHICALLY
 *   - Sedona Conference cooperation principles call for
 *     auditable preservation — R45 customer-managed export = win
 *   - Sanctions for spoliation are catastrophic ($35M+ in
 *     2023-2024 cases); accountability is non-negotiable
 *   - Average matter cost in BigLaw: $200K-$2M; pricing power
 *     is real
 *
 * Pricing: $30-200K ACV. Target: AmLaw 200 firms, Fortune 1000
 * in-house legal departments, e-discovery vendor platforms,
 * litigation-support service providers.
 */

import type { VerticalPack } from "./types";

export const LEGAL_DISCOVERY_PACK: VerticalPack = {
  id: "legal-discovery-v1",
  name: "Legal e-Discovery & Chain-of-Custody Pack",
  summary:
    "Cryptographically-defensible chain of custody for AI-assisted document " +
    "review, e-discovery production, contract analysis, and matter " +
    "management. Every agent action signed by the responsible attorney's " +
    "Ed25519 key (R34 CADC); every privileged-vs-non-privileged decision " +
    "logged in the immutable audit chain; every document produced through " +
    "an auditable pipeline FRE 901/902 evidence-admissible.",
  version: "1.0.0",
  industry: "Legal — e-discovery, doc review, contract ops, matter management",
  targetBuyerPersona:
    "General Counsel, Chief Legal Officer, e-Discovery Counsel, or Director " +
    "of Litigation Support at AmLaw 200 firms, Fortune 1000 in-house legal " +
    "departments, e-discovery vendor platforms, or litigation-support " +
    "service providers handling >$50M/year in document production.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "gdpr",
    "ccpa",
    "nist-ai-rmf",
  ],

  // Curated agent allowlist — only agents that fit a chain-of-custody
  // legal surface. NO open-internet, NO marketing, NO consumer-facing.
  enabledAgents: [
    "document-classifier-privileged",
    "document-classifier-responsive",
    "redaction-suggester",
    "deposition-summarizer",
    "contract-clause-analyzer",
    "contract-deviation-detector",
    "case-law-researcher",
    "matter-budget-monitor",
    "conflict-of-interest-checker",
    "production-set-prep-assistant",
    "bates-number-validator",
    "privilege-log-generator",
    "regulatory-filing-quality-checker",
    "deposition-transcript-validator",
  ],

  // Legal-specific HITL rules. Each cites controlling authority a
  // judge or opposing counsel would recognize.
  hitlRules: [
    {
      id: "legal-privilege-call-must-be-attorney",
      description:
        "Any agent classification of a document as PRIVILEGED or NOT " +
        "PRIVILEGED requires an attorney's review + Ed25519 signature " +
        "(R34 CADC) before the classification is binding. The agent " +
        "drafts; the attorney decides. This is the spoliation-defense " +
        "rule — Zubulake v. UBS Warburg sanctions ($29M) are the ghost " +
        "this rule prevents.",
      trigger:
        "agent.action == 'document.classify.privilege' OR " +
        "agent.action == 'document.classify.work_product'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FRE 502 (privilege waiver); FRE 901 (authentication); " +
        "Zubulake v. UBS Warburg, 217 F.R.D. 309 (S.D.N.Y. 2003)",
    },
    {
      id: "legal-production-set-attorney-signoff",
      description:
        "Any document set being PRODUCED to opposing counsel (or a " +
        "regulator, or court) requires explicit attorney sign-off " +
        "BEFORE Bates-stamping is finalized. The R34 signature on the " +
        "production manifest is the chain-of-custody handoff record.",
      trigger:
        "agent.action == 'production.finalize' OR " +
        "agent.action == 'bates.stamp.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FRE 902 (self-authentication); FRCP 26(g) (signature on " +
        "discovery responses); Sedona Conference Cooperation Proclamation",
    },
    {
      id: "legal-redaction-dual-approval",
      description:
        "Any agent-suggested redactions covering more than 5% of a " +
        "document, or any redaction citing privilege/trade-secret, " +
        "requires DUAL approval: the responsible attorney AND a " +
        "supervising attorney or e-discovery counsel. This blocks " +
        "over-redaction sanctions.",
      trigger: "agent.action == 'redaction.commit'",
      requiredApprovers: 2,
      regulatoryCitation:
        "FRCP 26(b)(5) (privilege log requirements); various state " +
        "bar over-redaction sanctions cases",
    },
    {
      id: "legal-conflict-check-before-engagement",
      description:
        "Agent-detected conflicts of interest are HARD-BLOCKED until " +
        "ethics/managing-partner clearance. The agent flags; humans " +
        "decide. No engagement can proceed without recorded clearance.",
      trigger: "agent.action == 'conflict.detected'",
      requiredApprovers: 1,
      regulatoryCitation:
        "ABA Model Rule 1.7 (conflicts of interest); ABA Model Rule 1.10 " +
        "(imputation); state-by-state RPC variations",
    },
    {
      id: "legal-spoliation-hold-cannot-be-disabled-by-agent",
      description:
        "Agents CANNOT disable a litigation hold autonomously. Any " +
        "hold-release action requires General Counsel sign-off + audit " +
        "chain entry — to defeat any future spoliation argument that " +
        "the AI 'just deleted things'.",
      trigger:
        "agent.action == 'litigation_hold.release' OR " +
        "agent.action == 'document.delete' AND target.under_hold",
      requiredApprovers: 1,
      regulatoryCitation:
        "FRCP 37(e) (failure to preserve ESI); Pension Committee, " +
        "685 F. Supp. 2d 456 (S.D.N.Y. 2010)",
    },
    {
      id: "legal-court-filing-must-be-attorney-of-record",
      description:
        "Any agent-drafted court filing or regulatory submission must " +
        "be signed (R34 CADC) by the attorney of record before the " +
        "filing is transmitted. The agent NEVER files autonomously — " +
        "FRCP 11 sanctions attach to the human signer.",
      trigger:
        "agent.action == 'court.filing.submit' OR " +
        "agent.action == 'regulatory.submission.submit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FRCP 11 (signing pleadings + sanctions); 28 USC §1927 " +
        "(vexatious litigation costs)",
    },
  ],

  // Pre-built audit queries an opposing counsel, judge, or regulator
  // would request during discovery disputes or sanctions motions.
  auditQueries: [
    {
      id: "legal-audit-privilege-log-365d",
      title: "Privilege log: every agent classification with attorney sign-off",
      description:
        "The privilege log is the most-litigated artifact in modern " +
        "e-discovery. This query reconstructs every privilege call: " +
        "which document, which attorney signed, when, with which key.",
      audienceContext:
        "Opposing-counsel privilege challenge; FRCP 26(b)(5) production",
      actionPrefix: "agent.document.classify.",
      defaultWindowDays: 365,
    },
    {
      id: "legal-audit-production-history-365d",
      title: "Production history: every set produced and the attorney signature chain",
      description:
        "Reconstructs every production set: when finalized, which " +
        "attorney signed off, what documents were included, what was " +
        "redacted. The FRE 901/902 evidence-admissibility record.",
      audienceContext: "Discovery dispute; trial admissibility hearing",
      actionPrefix: "agent.production.",
      defaultWindowDays: 365,
    },
    {
      id: "legal-audit-litigation-hold-events-365d",
      title: "Litigation-hold events: enable / release / disable + signatures",
      description:
        "The spoliation-defense record. Every hold-related action and " +
        "the General Counsel signature that authorized it. Defeats " +
        "FRCP 37(e) sanctions arguments.",
      audienceContext: "Spoliation sanctions motion; ESI preservation audit",
      actionPrefix: "agent.litigation_hold.",
      defaultWindowDays: 365,
    },
    {
      id: "legal-audit-conflict-checks-365d",
      title: "Conflict-check decisions and clearance sign-offs",
      description:
        "Every conflict the agents flagged, the ethics partner who " +
        "cleared (or refused) each, and the engagement-letter chain.",
      audienceContext: "Bar ethics complaint; client conflict claim",
      actionPrefix: "agent.conflict.",
      defaultWindowDays: 365,
    },
    {
      id: "legal-audit-court-filings-365d",
      title: "Court filings + the attorney-of-record signature chain",
      description:
        "Every agent-drafted filing, the attorney who signed, the " +
        "filing timestamp, the FRCP 11-attaching CADC signature.",
      audienceContext: "Sanctions motion (FRCP 11); discipline proceeding",
      actionPrefix: "agent.court.",
      defaultWindowDays: 365,
    },
    {
      id: "legal-audit-anomalies-180d",
      title: "Anomaly events in the legal-agent fleet (last 180 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, ACT revocations. " +
        "The 'has anything bad happened with our matters' query.",
      audienceContext: "Internal audit; bar ethics scrutiny",
      actionPrefix: "anomaly.",
      defaultWindowDays: 180,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "FRE 901/902 evidence-admissibility achieved cryptographically (audit chain = chain of custody)",
    "Every privilege call signed by the responsible attorney's Ed25519 key — Zubulake-defense by design",
    "Litigation-hold actions are tamper-evident; FRCP 37(e) spoliation sanctions become an irrelevant risk",
    "Production-set finalization is gated by attorney signature; FRCP 26(g) compliance verifiable",
    "Privilege-log generation reduced from days to hours; the canned query produces FRCP 26(b)(5)-compliant output",
    "Customer-managed audit-log export to YOUR firm's blob storage (R45) — work product survives even if Sovereign vanishes",
    "Insurable malpractice-adjacent agent-action liability via R46 underwriting (carrier-pricable for legal)",
    "Conflict-of-interest detection with HARD HITL block — ABA Rule 1.7 enforcement built in",
  ],

  // Legal admin volume sits between banking and healthcare. Default
  // cap reflects typical law-firm matter throughput.
  defaultDailyLimitCents: 15_000, // $150/day

  defaultActScopes: {
    // Read-only by default. Legal agents draft + classify + analyze
    // — they NEVER autonomously commit privilege calls, redactions,
    // production sets, or filings. Every state change goes through
    // attorney sign-off (R34 CADC).
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.draft.*",
      "agent.classify.*",
      "agent.analyze.*",
      "agent.summary.*",
      "agent.search.*",
      "agent.alert.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 30_000,
    maxAcvUsd: 200_000,
    targetCustomerSize:
      "AmLaw 200 firms (>$100M/year revenue), Fortune 1000 in-house legal " +
      "departments (>50 attorneys), e-discovery vendor platforms (>$10M ARR), " +
      "litigation-support service providers handling >$50M/year in production",
  },
};

export function getLegalDiscoveryPack(): VerticalPack {
  return LEGAL_DISCOVERY_PACK;
}

export function isAgentEnabledInLegalPack(agentId: string): boolean {
  return LEGAL_DISCOVERY_PACK.enabledAgents.includes(agentId);
}
