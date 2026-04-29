/**
 * MANUFACTURING & INDUSTRIAL COMPLIANCE PACK (R76).
 *
 * The seventh vertical product. Manufacturing is a $6T global
 * industry where AI agents are now handling supply-chain
 * orchestration, predictive maintenance, quality control, and
 * regulatory submissions. The "AI Industrialization Engine" pivot
 * from the strategic chats demands this pack.
 *
 * The wedge: manufacturers face overlapping regulatory regimes
 * that NO horizontal agent platform addresses end-to-end:
 *
 *   1. ISO 9001 — quality management (universal)
 *   2. IATF 16949 — automotive quality (Toyota, GM, Stellantis suppliers)
 *   3. AS9100 — aerospace + defense quality (Boeing, Lockheed suppliers)
 *   4. ISO 13485 — medical device quality (FDA-regulated devices)
 *   5. OSHA 29 CFR 1910 — workplace safety
 *   6. EPA Clean Air Act + RCRA — environmental compliance
 *   7. ITAR (22 CFR 120-130) — defense article export controls
 *   8. EAR (15 CFR 730-774) — dual-use export controls
 *   9. DFARS 252.204-7012 — DoD cybersecurity (CMMC composes here)
 *  10. NIST 800-171 — CUI for defense contractors
 *
 * Why this pack exists: when a defense-contractor manufacturer's
 * AI agent autonomously approves a part substitution that violates
 * AS9100, the consequences are: production line stoppage, ITAR
 * violation, FAA/DCMA audit failure, prime-contractor termination.
 * R76 prevents this with hard-block HITL gates + 6+ year audit
 * retention (matches ITAR + DFARS retention requirements).
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack does NOT process classified data (CONFIDENTIAL+).
 *     Classified manufacturing requires IL5+ deployment.
 *   - We are NOT a Quality Management Representative (QMR). The
 *     QMR is your designated employee per ISO 9001 §5.5.2.
 *   - We are NOT a registered ITAR person. Customers must complete
 *     their own DDTC registration before processing ITAR data.
 *
 * Pricing: $75-500K ACV. Target: Tier-1 + Tier-2 manufacturers
 * supplying automotive / aerospace / defense / medical-device
 * primes; specialty chemicals; energy/utilities ICS environments.
 */

import type { VerticalPack } from "./types";

export const MANUFACTURING_INDUSTRIAL_PACK: VerticalPack = {
  id: "manufacturing-industrial-v1",
  name: "Manufacturing & Industrial Compliance Pack",
  summary:
    "Audit-defensible AI agent infrastructure for Tier-1 + Tier-2 " +
    "manufacturers in automotive (IATF 16949), aerospace (AS9100), " +
    "defense (DFARS + CMMC + ITAR), medical-device (ISO 13485 + FDA " +
    "21 CFR 820), and ICS/SCADA-heavy industrial environments. Every " +
    "part-substitution decision, every supplier change, every " +
    "predictive-maintenance directive, every export-control " +
    "classification is signed by a designated qualified employee's " +
    "Ed25519 key (R34 CADC); every regulatory submission is gated " +
    "by a Quality Management Representative; every ICS/OT command " +
    "passes through the multi-turn jailbreak defender (R73) before " +
    "reaching the SCADA boundary. 6+ year audit retention matches " +
    "ITAR §123.22 + DFARS 252.204-7012 + 21 CFR Part 11 §11.10(c).",
  version: "1.0.0",
  industry:
    "Manufacturing — automotive, aerospace, defense, medical device, " +
    "industrial chemicals, ICS/SCADA environments",
  targetBuyerPersona:
    "Chief Operating Officer, VP of Quality, VP of Manufacturing, " +
    "Quality Management Representative (QMR), Empowered Official " +
    "(ITAR), Plant Information Security Officer, or VP of Supply " +
    "Chain at Tier-1 / Tier-2 manufacturers ($500M+ revenue) " +
    "supplying primes (Toyota, GM, Stellantis, Boeing, Lockheed, " +
    "Northrop, Raytheon, Pfizer, J&J, Medtronic), or running " +
    "ICS/SCADA-heavy operations subject to NERC CIP / ISA/IEC 62443.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "nist-ai-rmf",
    "cmmc-level-2",
    "cmmc-level-3",
    "fedramp-moderate",
  ],

  enabledAgents: [
    "iso-9001-deviation-detector",
    "iatf-16949-pfmea-assistant",
    "as9100-first-article-inspector",
    "iso-13485-design-history-recorder",
    "fda-21cfr820-design-control-validator",
    "supplier-change-impact-analyzer",
    "predictive-maintenance-anomaly-detector",
    "spc-statistical-process-control-monitor",
    "calibration-due-date-tracker",
    "itar-export-classification-drafter",
    "ear-eccn-classification-drafter",
    "dfars-7012-incident-report-drafter",
    "osha-incident-report-drafter",
    "epa-air-emissions-monitor",
    "ics-scada-anomaly-summarizer",
    "audit-trail-summarizer",
    "regulatory-update-tracker",
  ],

  hitlRules: [
    {
      id: "manufacturing-part-substitution-engineering-signoff",
      description:
        "Any agent recommendation to SUBSTITUTE a controlled part " +
        "(qualified-supplier-list (QSL) item, FAA-PMA part, defense " +
        "drawing-controlled item, FDA-listed component) requires the " +
        "responsible Engineering Authority's R34 CADC signature. " +
        "Substitutions in aerospace (AS9100) or defense (DFARS) without " +
        "a signed engineering-disposition record can void contracts " +
        "+ trigger FAA, DCMA, or DCAA findings.",
      trigger:
        "agent.action == 'part.substitution.recommend' OR " +
        "agent.action == 'bom.deviation.flag'",
      requiredApprovers: 1,
      regulatoryCitation:
        "AS9100 §8.5.6 (control of changes); IATF 16949 §8.5.6 (PPAP); " +
        "21 CFR 820.30(i) (design changes); FAA 14 CFR Part 21 (PMA)",
    },
    {
      id: "manufacturing-itar-export-classification-block",
      description:
        "Any agent classification of an item as ITAR-controlled (USML " +
        "Category I-XXI) is HARD-BLOCKED until the company's Empowered " +
        "Official (per 22 CFR 120.67) reviews and signs. ITAR " +
        "violations carry $1M criminal penalties per occurrence + " +
        "10-year debarment. The agent NEVER autonomously commits to " +
        "an export classification.",
      trigger:
        "agent.action == 'itar.classification.draft' OR " +
        "agent.action == 'usml.category.assign'",
      requiredApprovers: 1,
      regulatoryCitation:
        "ITAR 22 CFR 120-130 (USML); 22 USC 2778 (Arms Export Control " +
        "Act); DDTC Compliance Program Guidelines",
    },
    {
      id: "manufacturing-ear-eccn-classification-block",
      description:
        "Any agent classification of an item as EAR-controlled (ECCN " +
        "5A002, 1C351, etc.) is HARD-BLOCKED until the company's " +
        "Designated Export Compliance Officer reviews and signs. EAR " +
        "violations carry $300K civil + 10-year criminal penalties + " +
        "Denial of Export Privileges.",
      trigger:
        "agent.action == 'eccn.classification.draft' OR " +
        "agent.action == 'ear.export.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "EAR 15 CFR 730-774; ECCN classification per Supplement 1 to " +
        "Part 774; 50 USC 4811 et seq. (Export Control Reform Act)",
    },
    {
      id: "manufacturing-supplier-change-cab-required",
      description:
        "Adding or removing a supplier from the Approved Vendor List " +
        "(AVL) requires Change Advisory Board (CAB) approval — DUAL " +
        "approval from Procurement + Engineering. Unilateral supplier " +
        "changes in aerospace / defense / medical-device manufacturing " +
        "can void airworthiness, CMMC posture, or 510(k) clearance.",
      trigger:
        "agent.action == 'supplier.add_to_avl' OR " +
        "agent.action == 'supplier.remove_from_avl'",
      requiredApprovers: 2,
      regulatoryCitation:
        "AS9100 §8.4.1 (control of externally provided processes); " +
        "IATF 16949 §8.4 (supply chain); 21 CFR 820.50 (purchasing " +
        "controls); DFARS 252.246-7003 (notification)",
    },
    {
      id: "manufacturing-osha-incident-must-be-reviewed",
      description:
        "OSHA-recordable incidents (29 CFR 1904) detected by safety " +
        "agents are NEVER auto-filed. The Plant EHS Director must " +
        "review the agent draft, sign via R34 CADC, and submit. Late " +
        "or inaccurate OSHA filings expose the company to General " +
        "Duty Clause penalties + Item 5(a) safety citations.",
      trigger:
        "agent.action == 'osha.300_log.draft' OR " +
        "agent.action == 'osha.301.draft' OR " +
        "agent.action == 'osha.severe_injury_report.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "OSHA 29 CFR 1904 (recordkeeping); 29 USC 654 (General Duty " +
        "Clause); OSHA 29 CFR 1910 (general industry standards)",
    },
    {
      id: "manufacturing-fda-design-control-qmr-required",
      description:
        "Medical-device design history file (DHF) updates require " +
        "the Quality Management Representative (QMR per ISO 13485 " +
        "§5.5.2 and 21 CFR 820.20(b)) to sign each agent-drafted " +
        "DHF entry. Missing DHF traceability is the #1 finding in " +
        "FDA Form 483 inspections of Class II/III device firms.",
      trigger:
        "agent.action == 'dhf.entry.draft' OR " +
        "agent.action == 'design_input.commit' OR " +
        "agent.action == 'design_verification.commit'",
      requiredApprovers: 1,
      regulatoryCitation:
        "21 CFR 820.30 (design controls); ISO 13485 §7.3 (design + " +
        "development); FDA Quality System Inspection Technique (QSIT)",
    },
    {
      id: "manufacturing-ics-command-multi-turn-defense",
      description:
        "Any agent recommendation that would result in a control " +
        "command being sent to ICS/SCADA / PLC / DCS hardware MUST " +
        "pass the R73 multi-turn jailbreak defender + the R71 single-" +
        "turn guardrails BEFORE reaching the OT boundary. Cisco's " +
        "2025 research shows multi-turn jailbreaks succeed 2-10x " +
        "more often — and an industrial control system is the worst " +
        "target imaginable. HARD-BLOCK if either guardrail fires.",
      trigger:
        "agent.action == 'ics.control_command.recommend' OR " +
        "agent.action == 'plc.setpoint.change' OR " +
        "agent.action == 'dcs.parameter.modify'",
      requiredApprovers: 2,
      regulatoryCitation:
        "ISA/IEC 62443 (industrial automation security); NERC CIP-005, " +
        "CIP-007, CIP-010 (electric grid critical infrastructure); " +
        "CISA ICS-CERT advisories",
    },
    {
      id: "manufacturing-cmmc-evidence-sism-signoff",
      description:
        "DFARS 252.204-7012 + CMMC Level 2/3 evidence packages " +
        "require Senior Information Systems Manager (SISM) Ed25519 " +
        "attestation. False Claims Act exposure on inaccurate " +
        "self-attestations means EVERY evidence row needs a named " +
        "human signer. Same regulatory citation pattern as R53 " +
        "FedRAMP Pack — composed for manufacturing context.",
      trigger:
        "agent.action == 'cmmc.evidence.commit' OR " +
        "agent.action == 'dfars_7012.incident_report.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "31 USC 3729-3733 (False Claims Act); DFARS 252.204-7012 " +
        "(72-hour cyber-incident reporting); DFARS 252.204-7019/7020/" +
        "7021 (NIST 800-171 attestation); CMMC Final Rule 32 CFR Part 170",
    },
  ],

  auditQueries: [
    {
      id: "manufacturing-audit-part-substitutions-2190d",
      title:
        "Part-substitution decisions + engineering-signoff chain " +
        "(6 years — matches AS9100 + ITAR retention)",
      description:
        "Every controlled-part substitution the platform processed: " +
        "the engineering disposition rationale, the substitute part's " +
        "qualification status, the QSL impact, the responsible " +
        "Engineering Authority's R34 signature. Defends FAA/DCMA " +
        "investigations + customer-driven CAR (corrective action) " +
        "audits.",
      audienceContext:
        "FAA airworthiness audit; DCMA quality audit; AS9100 " +
        "registrar surveillance",
      actionPrefix: "agent.part.",
      defaultWindowDays: 2190, // 6 years
    },
    {
      id: "manufacturing-audit-itar-classifications-2190d",
      title:
        "ITAR classification decisions + Empowered-Official signoff " +
        "(6 years — matches 22 CFR 122.5(b) retention)",
      description:
        "Every USML classification, AECA license submission, " +
        "encryption-export-classification per the 'commerce-license " +
        "exception' analysis. The DDTC enforcement defense record.",
      audienceContext:
        "DDTC Compliance Office audit; DOJ ITAR criminal investigation",
      actionPrefix: "agent.itar.",
      defaultWindowDays: 2190,
    },
    {
      id: "manufacturing-audit-ear-classifications-2190d",
      title:
        "EAR / ECCN classifications + DECO signoff (6 years — matches " +
        "15 CFR 762 retention)",
      description:
        "Every ECCN classification, license-determination, deemed-export " +
        "review. Defends BIS export-enforcement investigations.",
      audienceContext: "BIS / OEE investigation; Commerce Control List audit",
      actionPrefix: "agent.eccn.",
      defaultWindowDays: 2190,
    },
    {
      id: "manufacturing-audit-supplier-changes-1825d",
      title:
        "Supplier AVL changes + CAB-approval chain (5 years — matches " +
        "AS9100 + IATF supplier-history retention)",
      description:
        "Every AVL addition / removal / requalification, with the " +
        "Procurement + Engineering CAB signatures. Defends supply-" +
        "chain disruption claims + prime-contractor flow-down audits.",
      audienceContext: "Prime-contractor flow-down audit; AS9100 surveillance",
      actionPrefix: "agent.supplier.",
      defaultWindowDays: 1825,
    },
    {
      id: "manufacturing-audit-osha-incidents-1825d",
      title:
        "OSHA-recordable incidents + EHS-Director signoff (5 years — " +
        "matches 29 CFR 1904.33 retention)",
      description:
        "Every OSHA 300 / 301 / SIR draft, the EHS-Director signature " +
        "chain, the corrective action timeline. Defends OSHA citation " +
        "appeals + General Duty Clause litigation.",
      audienceContext: "OSHA inspection; General Duty Clause litigation",
      actionPrefix: "agent.osha.",
      defaultWindowDays: 1825,
    },
    {
      id: "manufacturing-audit-dhf-entries-2920d",
      title:
        "Medical-device DHF entries + QMR signature chain (8 years — " +
        "matches 21 CFR 820.180 retention for design records)",
      description:
        "Every Design History File entry the platform produced or " +
        "modified, the QMR signature, the device-master-record (DMR) " +
        "linkage. Defends FDA Form 483 + Warning Letter findings.",
      audienceContext: "FDA inspection; ISO 13485 registrar audit",
      actionPrefix: "agent.dhf.",
      defaultWindowDays: 2920,
    },
    {
      id: "manufacturing-audit-ics-commands-2190d",
      title:
        "ICS/SCADA control-command requests + multi-turn-defense + " +
        "approval chain (6 years — matches NERC CIP-007 retention)",
      description:
        "Every ICS / PLC / DCS command the platform recommended, the " +
        "R73 + R71 guardrail verdicts, the dual-approval signature " +
        "chain. Defends NERC CIP audits + CISA incident response.",
      audienceContext: "NERC CIP audit; CISA ICS-CERT investigation",
      actionPrefix: "agent.ics.",
      defaultWindowDays: 2190,
    },
    {
      id: "manufacturing-audit-anomalies-365d",
      title: "Anomaly Events in Manufacturing Agent Fleet (365 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, ACT revocations, " +
        "predictive-maintenance false positives. The 'has anything bad " +
        "happened on the plant floor or in our supply chain' query.",
      audienceContext: "Internal audit; pre-incident risk review",
      actionPrefix: "anomaly.",
      defaultWindowDays: 365,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "Part-substitution + supplier-change audit trail for AS9100 + IATF " +
      "16949 + 21 CFR 820 — 6+ year retention matches the most demanding " +
      "regulatory regime",
    "ITAR + EAR classifications HARD-BLOCKED until Empowered Official + " +
      "Designated Export Compliance Officer sign — defends $1M criminal " +
      "+ 10-year debarment exposure",
    "ICS/SCADA control commands pass R73 multi-turn jailbreak defense + " +
      "R71 single-turn guardrails + dual approval BEFORE reaching the " +
      "OT boundary — Cisco-research-driven defense for industrial " +
      "control systems",
    "FDA design-history file entries gated by QMR signature — defends #1 " +
      "Form 483 finding category for Class II/III device firms",
    "OSHA 300/301/severe-injury reports never auto-filed; EHS-Director " +
      "signoff on every record — defends General Duty Clause exposure",
    "CMMC Level 2/3 evidence with named SISM signers (False Claims Act " +
      "qui-tam defense by design)",
    "Customer-managed audit-log export to YOUR facility's S3 bucket (R45) " +
      "— your manufacturing audit trail survives Sovereign disappearance",
    "MoA model router (R74) automatically routes math-heavy QC tasks to " +
      "DeepSeek V3.2; coding-heavy automation tasks to GLM-4.7; long-" +
      "context BOM analysis to Llama 4 Maverick — best specialist per task",
  ],

  defaultDailyLimitCents: 30_000, // $300/day — manufacturing volume is high

  defaultActScopes: {
    // Read-only by default. Manufacturing agents analyze, draft, alert,
    // monitor — they NEVER autonomously commit part substitutions, AVL
    // changes, regulatory submissions, or ICS commands.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.analyze.*",
      "agent.monitor.*",
      "agent.draft.*",
      "agent.classify.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.flag.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 75_000,
    maxAcvUsd: 500_000,
    targetCustomerSize:
      "Tier-1 / Tier-2 manufacturers ($500M+ revenue) supplying " +
      "automotive primes (Toyota, GM, Stellantis, Ford), aerospace + " +
      "defense primes (Boeing, Lockheed Martin, Northrop Grumman, " +
      "Raytheon, BAE), medical-device firms (Pfizer, J&J, Medtronic, " +
      "Abbott, Stryker), and ICS/SCADA-heavy industrial environments " +
      "(specialty chemicals, energy, utilities, water). Deal sizes " +
      "scale with regulatory complexity (AS9100 + ITAR primes pay " +
      "the top of the range).",
  },
};

export function getManufacturingIndustrialPack(): VerticalPack {
  return MANUFACTURING_INDUSTRIAL_PACK;
}

export function isAgentEnabledInManufacturingPack(agentId: string): boolean {
  return MANUFACTURING_INDUSTRIAL_PACK.enabledAgents.includes(agentId);
}
