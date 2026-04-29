/**
 * IT, SOFTWARE & CYBERSECURITY OPERATIONS PACK (R78).
 *
 * The eighth vertical product. Targets the role categories most
 * aggressively being replaced by AI agents per the workforce-
 * displacement chats:
 *   - Junior / entry-level developers
 *   - QA testers
 *   - Level-1 SOC analysts (per Forrester: "AI is steadily
 *     removing the need for traditional Level-1 SOC analysts")
 *   - IT support + help desk
 *   - DevOps + SRE (routine tasks)
 *
 * The wedge: IT/Sec leaders face a unique paradox — they're asked
 * to deploy AI agents to automate work, but those same agents are
 * the highest-stakes targets for prompt injection, supply-chain
 * attacks, and credential exfiltration. R78 ships the substrate
 * for IT/Sec teams to deploy AI agents SAFELY against:
 *
 *   - SOC alerts (Level-1 triage automation)
 *   - Code commit review (junior-dev workload)
 *   - QA test generation
 *   - Incident response coordination
 *   - Patch management + dependency updates
 *   - Cloud-config drift detection
 *   - SBOM + supply-chain risk
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack does NOT autonomously deploy code to production.
 *     Code-commit + infra-change actions are HARD-GATED behind
 *     human approval (R34 CADC) — defends against the autonomous-
 *     code-deploy disaster pattern (CrowdStrike July 2024 outage,
 *     SolarWinds-style supply-chain incidents).
 *   - We are NOT a SOC service. The pack provides the substrate;
 *     customers' security teams (or MSSP partners) operate it.
 *
 * Pricing: $40-250K ACV. Target: enterprise CISOs, SOC Directors,
 * VPs of Engineering, Cloud Security Architects, MSSP partners
 * deploying AI agents into security operations.
 */

import type { VerticalPack } from "./types";

export const IT_CYBERSECURITY_PACK: VerticalPack = {
  id: "it-cybersecurity-v1",
  name: "IT, Software & Cybersecurity Operations Pack",
  summary:
    "Audit-defensible AI agent infrastructure for enterprise IT, " +
    "engineering, and security-operations teams deploying agents " +
    "against SOC triage, code review, QA testing, incident response, " +
    "patch management, and cloud-config compliance. Every code-commit " +
    "recommendation, every SOC alert verdict, every infrastructure " +
    "change proposal is signed by a designated engineer's Ed25519 " +
    "key (R34 CADC); every command targeting production infrastructure " +
    "passes through R71 + R73 guardrails before reaching the runtime " +
    "boundary; every supply-chain decision is logged immutably for " +
    "SBOM + provenance audit defense. Built to align with NIST CSF, " +
    "ISO 27001, SOC 2 Type II, MITRE ATT&CK, and the OWASP LLM " +
    "Top 10 — the canonical security frameworks for agentic deployment.",
  version: "1.0.0",
  industry:
    "IT, software engineering, security operations — SOC, DevSecOps, " +
    "incident response, supply-chain security",
  targetBuyerPersona:
    "Chief Information Security Officer (CISO), SOC Director, VP of " +
    "Engineering, Cloud Security Architect, Director of DevSecOps, or " +
    "VP of IT Operations at enterprises (>1,000 engineers, > $500M " +
    "revenue) deploying AI agents into security operations or DevOps " +
    "workflows. Also serves Managed Security Service Providers (MSSPs) " +
    "and consulting firms (Mandiant, Optiv, Coalfire, Trustwave) " +
    "operating SOCs on behalf of customers.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "nist-ai-rmf",
    "fedramp-moderate",
    "cmmc-level-2",
    "pci-dss",
  ],

  enabledAgents: [
    "soc-alert-triage-l1",
    "ioc-enrichment-analyzer",
    "incident-runbook-recommender",
    "code-commit-reviewer",
    "code-vulnerability-scanner",
    "qa-test-generator",
    "qa-regression-coverage-checker",
    "patch-availability-tracker",
    "dependency-vulnerability-scanner",
    "sbom-drift-detector",
    "cloud-config-compliance-monitor",
    "iam-permission-auditor",
    "container-image-vulnerability-scanner",
    "log-anomaly-summarizer",
    "phishing-url-analyzer",
    "audit-trail-summarizer",
    "regulatory-update-tracker",
  ],

  hitlRules: [
    {
      id: "it-no-autonomous-production-deploys",
      description:
        "Agents NEVER autonomously deploy code to production. Every " +
        "code-commit recommendation that would trigger a production " +
        "build OR a release tag requires the responsible engineer's " +
        "R34 CADC signature. This rule exists because of the " +
        "CrowdStrike July 2024 outage pattern — automated deploys " +
        "without staged human review are the highest-blast-radius " +
        "events in IT operations.",
      trigger:
        "agent.action == 'code.commit.recommend' AND " +
        "(target.environment == 'production' OR " +
        "target.affects_release_tag == true)",
      requiredApprovers: 1,
      regulatoryCitation:
        "SOC 2 CC8.1 (change management); ISO 27001 A.12.1.2 " +
        "(change management); NIST CSF PR.IP-3 (configuration " +
        "change control); industry post-CrowdStrike best practices",
    },
    {
      id: "it-l1-soc-alert-must-have-human-final-call",
      description:
        "Agents NEVER autonomously close OR escalate SOC alerts " +
        "above Severity-Low without a human analyst's R34 signature. " +
        "Forrester's research shows AI removes the NEED for L1 " +
        "analysts but the human accountability stays with the human " +
        "signer. The agent triages; the analyst decides. Wrong " +
        "auto-escalations exhaust the SOC; wrong auto-closes leak " +
        "real incidents.",
      trigger:
        "agent.action == 'soc.alert.close' OR " +
        "agent.action == 'soc.alert.escalate' AND " +
        "alert.severity != 'low'",
      requiredApprovers: 1,
      regulatoryCitation:
        "NIST SP 800-61 (Computer Security Incident Handling Guide); " +
        "NIST CSF DE.AE (Anomalies and Events); " +
        "MITRE ATT&CK detection-engineering practices",
    },
    {
      id: "it-iam-privilege-escalation-block",
      description:
        "Agents are HARD-BLOCKED from autonomously granting elevated " +
        "IAM privileges, modifying admin roles, or rotating production " +
        "credentials. The agent flags; an authorized administrator " +
        "(per the company's access control policy) signs each change. " +
        "This rule is the SolarWinds-defense — supply-chain-style " +
        "attacks ALWAYS involve unauthorized privilege escalation.",
      trigger:
        "agent.action == 'iam.privilege.grant' OR " +
        "agent.action == 'iam.role.modify' OR " +
        "agent.action == 'credential.rotate.production'",
      requiredApprovers: 1,
      regulatoryCitation:
        "NIST 800-53 AC-6 (Least Privilege); ISO 27001 A.9.2.5 " +
        "(review of user access rights); SOC 2 CC6.3 (logical access)",
    },
    {
      id: "it-supply-chain-package-addition-dual-approval",
      description:
        "Adding a new dependency or container image to the SBOM " +
        "requires DUAL approval — Engineering + Security. Agents " +
        "cannot autonomously add a new package or pull a new image " +
        "into production. This rule defends against the typo-squatting, " +
        "dependency-confusion, and compromised-upstream attack " +
        "patterns.",
      trigger:
        "agent.action == 'dependency.add.recommend' OR " +
        "agent.action == 'container.image.add.recommend' OR " +
        "agent.action == 'sbom.entry.add'",
      requiredApprovers: 2,
      regulatoryCitation:
        "Executive Order 14028 (Software Supply Chain Security); " +
        "NIST SSDF SP 800-218; SLSA (Supply-chain Levels for Software " +
        "Artifacts) framework; CISA SBOM minimum elements",
    },
    {
      id: "it-incident-response-coordinator-signoff",
      description:
        "When an agent recommends incident-response playbook actions " +
        "during a Severity-1 / Severity-2 incident (data exfiltration, " +
        "ransomware, wide-scope outage), the Incident Commander must " +
        "sign each action via R34 CADC before execution. Defends " +
        "against agent-driven cascading-failure patterns during " +
        "real incidents.",
      trigger:
        "incident.severity IN ('1', '2') AND " +
        "agent.action == 'runbook.action.recommend'",
      requiredApprovers: 1,
      regulatoryCitation:
        "NIST SP 800-61 §3.3 (Containment, Eradication, Recovery); " +
        "ISO 27035-2 (incident response); SOC 2 CC7.4 (incident " +
        "response)",
    },
    {
      id: "it-data-exfiltration-block",
      description:
        "Any agent action that would EXPORT data outside the customer's " +
        "trust boundary (S3 bucket → external URL, database → CSV " +
        "download, secrets → unauthorized destination) is HARD-BLOCKED " +
        "at the boundary. The agent flags; the responsible data steward " +
        "+ Security Officer dual-sign. This is the data-exfiltration " +
        "defense composing R71 + R73 guardrails with R34 + R45 audit " +
        "export.",
      trigger:
        "agent.action LIKE 'data.export.%' OR " +
        "agent.action == 'secret.exfiltration.detected'",
      requiredApprovers: 2,
      regulatoryCitation:
        "GDPR Art 32 (security of processing); HIPAA §164.312(e)(1); " +
        "SOC 2 CC6.7 (data transmission); PCI DSS Req 4 (cardholder " +
        "data transmission)",
    },
    {
      id: "it-multi-turn-prompt-injection-defense",
      description:
        "Every agent interaction with security-relevant tooling " +
        "(SIEM, EDR, IAM, IR runbooks) MUST pass the R73 multi-turn " +
        "jailbreak defender + R71 single-turn guardrails. Cisco's " +
        "2025 research shows multi-turn jailbreaks succeed 2-10x " +
        "more often — and a SIEM agent is one of the highest-value " +
        "attack targets. HARD-BLOCK if either guardrail fires.",
      trigger:
        "agent.action LIKE 'siem.%' OR " +
        "agent.action LIKE 'edr.%' OR " +
        "agent.action LIKE 'iam.%' OR " +
        "agent.action LIKE 'ir.runbook.%'",
      requiredApprovers: 0, // hard block driven by guardrails, not approver count
      regulatoryCitation:
        "OWASP LLM Top 10 (LLM01: Prompt Injection); MITRE ATLAS " +
        "(Adversarial Threat Landscape for Artificial-Intelligence " +
        "Systems); Cisco 2025 multi-turn-jailbreak research",
    },
    {
      id: "it-fedramp-incident-72h-coordination",
      description:
        "If the deployment is on FedRAMP Moderate / High AND a " +
        "security incident is detected, the platform auto-triggers " +
        "the 72-hour US-CERT notification timeline + the customer's " +
        "FedRAMP PMO communication channel. Composed with R53 " +
        "FedRAMP Pack for federal customers.",
      trigger:
        "deployment.fedramp == true AND " +
        "agent.action == 'incident.detected'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FedRAMP Continuous Monitoring Strategy v1.0; OMB M-22-09; " +
        "FISMA 44 USC 3554; DFARS 252.204-7012 (when DoD-adjacent)",
    },
  ],

  auditQueries: [
    {
      id: "it-audit-soc-alert-decisions-365d",
      title: "SOC alert triage + analyst-signoff chain (365 days)",
      description:
        "Every SOC alert the platform processed: agent triage verdict, " +
        "the analyst who closed/escalated, R34 signature, MITRE ATT&CK " +
        "technique mapping, post-incident outcome. Defends against " +
        "regulatory examination + post-breach DOJ scrutiny.",
      audienceContext:
        "SOC 2 audit; post-incident regulatory examination; insurance " +
        "claim adjudication",
      actionPrefix: "agent.soc.",
      defaultWindowDays: 365,
    },
    {
      id: "it-audit-code-commit-decisions-365d",
      title: "Agent-recommended code commits + engineer signoff (365 days)",
      description:
        "Every agent code-review verdict, the responsible engineer's " +
        "R34 signature, the commit SHA, the production-deploy lineage. " +
        "Defends against negligence claims when agent-influenced " +
        "code causes outages.",
      audienceContext: "Internal incident review; insurance subrogation",
      actionPrefix: "agent.code.",
      defaultWindowDays: 365,
    },
    {
      id: "it-audit-iam-privilege-changes-1095d",
      title:
        "IAM privilege changes + admin signature chain (3 years — " +
        "matches SOX retention + GDPR audit windows)",
      description:
        "Every IAM modification, role grant, credential rotation, " +
        "admin-role escalation. The SolarWinds-class-attack defense " +
        "record. Defends against breach-related litigation.",
      audienceContext:
        "SOC 2 audit; SEC cybersecurity disclosure (Item 1.05); " +
        "GDPR breach investigation",
      actionPrefix: "agent.iam.",
      defaultWindowDays: 1095,
    },
    {
      id: "it-audit-supply-chain-additions-1095d",
      title:
        "SBOM additions + dual-approval chain (3 years — matches " +
        "EO 14028 + NIST SSDF retention)",
      description:
        "Every dependency added, container image pulled, package " +
        "approved. The supply-chain-attack defense record (typo-" +
        "squatting, dependency-confusion, compromised-upstream).",
      audienceContext:
        "Executive Order 14028 audit; CISA SBOM compliance review",
      actionPrefix: "agent.dependency.",
      defaultWindowDays: 1095,
    },
    {
      id: "it-audit-incident-response-365d",
      title: "Incident response actions + Incident Commander signoff",
      description:
        "Every IR runbook action recommended during a Severity-1 / " +
        "Severity-2 incident, the Incident Commander signature chain, " +
        "the timeline of containment / eradication / recovery actions. " +
        "Defends against post-incident regulatory + insurance review.",
      audienceContext:
        "Post-incident SEC 8-K filing; insurance claim review; " +
        "DOJ cybersecurity investigation",
      actionPrefix: "agent.runbook.",
      defaultWindowDays: 365,
    },
    {
      id: "it-audit-data-exfiltration-attempts-365d",
      title: "Data exfiltration attempts blocked + approval-overrides",
      description:
        "Every blocked data-export action, every dual-approval " +
        "override, every flagged secrets-exfiltration attempt. Defends " +
        "against both insider-threat and prompt-injection-driven " +
        "data-leak scenarios.",
      audienceContext: "Insider-threat investigation; GDPR breach analysis",
      actionPrefix: "agent.data.export.",
      defaultWindowDays: 365,
    },
    {
      id: "it-audit-anomalies-365d",
      title: "Anomaly events in IT/Security agent fleet (365 days)",
      description:
        "Audit-chain anomalies, R73 multi-turn jailbreak detections, " +
        "ACT revocations, prompt-injection attempt patterns. The " +
        "'has anything bad happened with our security agents' query.",
      audienceContext:
        "Internal security review; pre-incident risk assessment",
      actionPrefix: "anomaly.",
      defaultWindowDays: 365,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "Level-1 SOC analyst burden reduced 80%+ via agent triage; analyst " +
      "headcount STAYS while SOC throughput goes 5-10x (the augmentation " +
      "frame, not the replacement frame)",
    "Code-commit decisions auditable end-to-end — engineer signature on " +
      "every agent-recommended merge; defends against post-CrowdStrike-" +
      "class outage litigation",
    "IAM privilege-escalation HARD-BLOCK — agents NEVER autonomously " +
      "grant admin or rotate production credentials (SolarWinds defense)",
    "SBOM additions dual-approved (Engineering + Security); typo-squatting " +
      "+ dependency-confusion + compromised-upstream all defended",
    "MITRE ATT&CK technique mapping captured per SOC decision — " +
      "post-incident analysis reconstructable down to the technique level",
    "OWASP LLM Top 10 (LLM01-LLM10) covered via R71 + R73 guardrails " +
      "framework; security agents themselves are defensible attack targets",
    "Customer-managed audit-log export to YOUR S3 bucket (R45) — your " +
      "security audit trail is FOIA-compliant + insurance-claim-grade",
    "Composes with R53 FedRAMP pack for federal SOCs (72-hour US-CERT " +
      "auto-trigger)",
  ],

  defaultDailyLimitCents: 25_000, // $250/day — enterprise SOC volume

  defaultActScopes: {
    // Read-only by default. IT/Sec agents triage, scan, draft, alert,
    // analyze — they NEVER autonomously commit code, modify IAM, add
    // dependencies, or close high-severity alerts.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.scan.*",
      "agent.triage.*",
      "agent.draft.*",
      "agent.classify.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.analyze.*",
      "agent.detect.*",
      "agent.enrich.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 40_000,
    maxAcvUsd: 250_000,
    targetCustomerSize:
      "Enterprises (>1,000 engineers, >$500M revenue) deploying AI " +
      "agents into security operations or DevOps. Specifically: " +
      "Fortune 1000 SOCs, MSSPs (Mandiant, Optiv, Coalfire, Trustwave, " +
      "Arctic Wolf, eSentire), cloud-security pure-plays (Wiz, Lacework, " +
      "Orca), DevSecOps platforms (Snyk, Veracode, Checkmarx), and " +
      "consulting firms operating SOCs on behalf of clients. Federal + " +
      "DoD customers should pair with R53 FedRAMP Pack.",
  },
};

export function getItCybersecurityPack(): VerticalPack {
  return IT_CYBERSECURITY_PACK;
}

export function isAgentEnabledInItPack(agentId: string): boolean {
  return IT_CYBERSECURITY_PACK.enabledAgents.includes(agentId);
}
