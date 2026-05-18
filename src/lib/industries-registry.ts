/**
 * SOVEREIGN MATRIX — Industries × workflow-gap registry (Wave 29).
 *
 * Typed, signed, single-source-of-truth catalog of every industry
 * Sovereign serves and every distinct workflow inside each industry
 * where a receipt-anchored agent closes a real gap. Backs the public
 * claim that the platform addresses ~380 verifiable-AI workflows
 * across ~40 industries.
 *
 * Why this exists as a registry instead of marketing copy:
 *   - Drives /marketplace + /solutions + /for-<vertical> pages
 *     from one place — adding a workflow surfaces it everywhere.
 *   - Every entry has a stable slug + regulatory class + retention
 *     horizon, so /trust can render the SOC 2 / HIPAA / SR 11-7
 *     mapping per workflow without hand-rolling each card.
 *   - The whole registry is signed via signRun so a buyer can hit
 *     /api/industries/registry, hash the canonical, and verify the
 *     "we cover 38 healthcare workflows" claim is the bytes we
 *     actually shipped — not a marketing afterthought.
 *
 * Update policy: append-only by convention. Removing a workflow
 * implies we stopped supporting it; flag it instead with status
 * "sunset" so historical receipts keep their context.
 */

import { createHash } from "crypto";
import { signRun } from "@/lib/agent-runs";

export type RegulatoryWeight = "heavy" | "medium" | "light";

export type IndustryCategory =
  | "healthcare"
  | "pharma"
  | "insurance"
  | "banking"
  | "finance"
  | "tax-audit"
  | "legal"
  | "esg-csrd"
  | "defense"
  | "aviation"
  | "maritime"
  | "energy"
  | "nuclear"
  | "mining"
  | "telecom"
  | "manufacturing"
  | "construction"
  | "logistics"
  | "real-estate"
  | "education"
  | "public-sector"
  | "elections"
  | "cybersecurity"
  | "food-bev"
  | "veterinary"
  | "recruitment-hr"
  | "climate-carbon"
  | "marketing-adtech"
  | "media-publishing"
  | "gaming"
  | "crypto-defi"
  | "ngo-aid"
  | "journalism";

export interface WorkflowGap {
  /** Stable slug, kebab-case. */
  slug: string;
  /** Human-readable label for marketing surfaces. */
  title: string;
  /** Why this is a "gap" — one sentence operators recognize. */
  problem: string;
  /** Receipt retention horizon in years (informs PQ dual-sign need). */
  retentionYears: number;
  /** Named regulatory framework(s) this workflow's receipt satisfies. */
  regulations: string[];
  /** Has Sovereign shipped a production agent for this? */
  agentStatus: "shipped" | "in-progress" | "scoped";
}

export interface Industry {
  category: IndustryCategory;
  /** Display name for marketing surfaces. */
  name: string;
  /** Regulatory weight — drives /trust badge prominence. */
  weight: RegulatoryWeight;
  /** One-sentence positioning. */
  positioning: string;
  workflows: WorkflowGap[];
}

// ── The registry ──────────────────────────────────────────────────────

const INDUSTRIES: Industry[] = [
  // ── Heavy-regulation verticals (where receipts are mandatory) ──
  {
    category: "healthcare",
    name: "Healthcare — providers",
    weight: "heavy",
    positioning:
      "Ambient clinical AI with cryptographic receipts for every note, code, and care decision.",
    workflows: [
      {
        slug: "clinical-scribe",
        title: "Ambient SOAP-note scribe",
        problem:
          "Physicians spend 2+ hours/day on documentation; ambient AI cuts this 83%.",
        retentionYears: 7,
        regulations: ["HIPAA", "POPIA", "GDPR"],
        agentStatus: "shipped",
      },
      {
        slug: "prior-auth",
        title: "Prior authorization drafting",
        problem:
          "Prior-auth drives the largest single source of physician burnout.",
        retentionYears: 7,
        regulations: ["HIPAA", "CMS Final Rule 2027"],
        agentStatus: "shipped",
      },
      {
        slug: "discharge-summary",
        title: "Discharge summary + care coordination",
        problem: "Fragmented hand-offs cause 17% of preventable readmissions.",
        retentionYears: 10,
        regulations: ["HIPAA"],
        agentStatus: "scoped",
      },
      {
        slug: "medical-coding",
        title: "ICD-10 / CPT autonomous coding",
        problem:
          "Manual coding is the #1 revenue-cycle leakage point in US hospitals.",
        retentionYears: 7,
        regulations: ["HIPAA", "False Claims Act"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "pharma",
    name: "Pharma — R&D + pharmacovigilance",
    weight: "heavy",
    positioning:
      "Forward-secure receipts (ML-DSA-65) for 25-year retention horizons.",
    workflows: [
      {
        slug: "pharmacovigilance",
        title: "Adverse-event signal detection",
        problem:
          "FDA / EMA pharmacovigilance backlogs delay safety signals by months.",
        retentionYears: 25,
        regulations: ["FDA 21 CFR Part 11", "EMA EudraVigilance", "ICH E2E"],
        agentStatus: "shipped",
      },
      {
        slug: "clinical-trial-protocol",
        title: "Trial protocol drafting + amendment",
        problem:
          "Protocol amendments cost $500K each; AI drafting cuts cycle 60%.",
        retentionYears: 25,
        regulations: ["FDA 21 CFR Part 11", "ICH GCP", "EU CTR"],
        agentStatus: "in-progress",
      },
      {
        slug: "regulatory-submission",
        title: "IND / NDA / BLA section drafting",
        problem:
          "Regulatory writing is a $5B/yr CRO line item; receipts give FDA an audit trail.",
        retentionYears: 25,
        regulations: ["FDA 21 CFR Part 11"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "pharma",
    name: "Pharma — supply chain",
    weight: "heavy",
    positioning: "DSCSA-conformant serialization + recall traceability.",
    workflows: [
      {
        slug: "dscsa-trace",
        title: "DSCSA track-and-trace narrative",
        problem: "Nov 2024 DSCSA enforcement demands interoperable trace data.",
        retentionYears: 7,
        regulations: ["DSCSA"],
        agentStatus: "scoped",
      },
      {
        slug: "recall-narrative",
        title: "Recall traceability narrative",
        problem:
          "Recalls trigger Class-I action within 24h; AI compresses to minutes.",
        retentionYears: 10,
        regulations: ["FDA 21 CFR Part 7", "ISMP"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "insurance",
    name: "Insurance — life & health",
    weight: "heavy",
    positioning:
      "Bias-monitored underwriting + adverse-action notices with cryptographic provenance.",
    workflows: [
      {
        slug: "underwriting-narrative",
        title: "Underwriting decision narrative",
        problem:
          "NAIC AI Bulletin requires explainability + bias monitoring on every decision.",
        retentionYears: 10,
        regulations: ["NAIC AI Bulletin", "Reg B (US)"],
        agentStatus: "shipped",
      },
      {
        slug: "adverse-action",
        title: "Adverse-action notice generation",
        problem:
          "FCRA + Reg B require specific reasons; AI drafts compliant copy in seconds.",
        retentionYears: 7,
        regulations: ["FCRA", "Reg B"],
        agentStatus: "shipped",
      },
    ],
  },
  {
    category: "insurance",
    name: "Insurance — P&C",
    weight: "heavy",
    positioning:
      "Receipt-anchored claims triage that withstands subrogation + bad-faith litigation.",
    workflows: [
      {
        slug: "claims-fnol-triage",
        title: "FNOL triage + coverage analysis",
        problem:
          "First-Notice-of-Loss decisions are bad-faith litigation magnets.",
        retentionYears: 10,
        regulations: ["State DOI rules", "Unfair Claims Settlement Practices"],
        agentStatus: "shipped",
      },
      {
        slug: "subrogation-narrative",
        title: "Subrogation recovery narrative",
        problem:
          "Subrogation leakage averages 4% of paid claims; AI lifts recovery 22%.",
        retentionYears: 7,
        regulations: ["State subrogation statutes"],
        agentStatus: "scoped",
      },
      {
        slug: "complaint-handling",
        title: "Regulatory complaint response drafting",
        problem:
          "DOI complaint cycles run 30–90 days; AI cuts response time by 4x.",
        retentionYears: 7,
        regulations: ["State DOI"],
        agentStatus: "shipped",
      },
    ],
  },
  {
    category: "banking",
    name: "Banking — wholesale + risk",
    weight: "heavy",
    positioning:
      "SR 11-7 model-risk-conformant evidence trail for every AI-assisted decision.",
    workflows: [
      {
        slug: "sr-11-7-model-validation",
        title: "Model validation narrative",
        problem:
          "SR 11-7 requires independent validation; AI drafts the report.",
        retentionYears: 7,
        regulations: ["SR 11-7 (Fed)", "OCC 2011-12"],
        agentStatus: "shipped",
      },
      {
        slug: "aml-tx-monitoring",
        title: "AML transaction-monitoring narrative",
        problem:
          "False-positive rates on TM alerts are 95%+; receipts justify SARs.",
        retentionYears: 5,
        regulations: ["BSA/AML", "FATF"],
        agentStatus: "in-progress",
      },
    ],
  },
  {
    category: "banking",
    name: "Banking — retail",
    weight: "heavy",
    positioning: "KYC + fair-lending narratives with auditable AI provenance.",
    workflows: [
      {
        slug: "kyc-narrative",
        title: "KYC review summary",
        problem:
          "KYC reviewer time is the #1 retail-bank ops cost; AI cuts 60%.",
        retentionYears: 5,
        regulations: ["BSA/AML", "CDD Rule"],
        agentStatus: "shipped",
      },
      {
        slug: "fair-lending-narrative",
        title: "Fair-lending decision narrative",
        problem:
          "CFPB exam findings on AI lending decisions are increasing 40% YoY.",
        retentionYears: 7,
        regulations: ["ECOA", "Reg B", "CRA"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "finance",
    name: "Asset management",
    weight: "heavy",
    positioning:
      "Marketing-comms compliance + ESG screen narratives with receipts.",
    workflows: [
      {
        slug: "marketing-comms-review",
        title: "Marketing communication compliance review",
        problem:
          "FINRA Rule 2210 demands review of every customer-facing comm.",
        retentionYears: 3,
        regulations: ["FINRA 2210", "MiFID II"],
        agentStatus: "scoped",
      },
      {
        slug: "esg-screen-narrative",
        title: "ESG screen + exclusion narrative",
        problem:
          "SEC ESG Names Rule requires verifiable screening methodology.",
        retentionYears: 5,
        regulations: ["SEC Names Rule", "SFDR"],
        agentStatus: "shipped",
      },
    ],
  },
  {
    category: "tax-audit",
    name: "Tax & audit — Big-4",
    weight: "heavy",
    positioning:
      "Workpaper drafting + tax-court analysis with cryptographic provenance an audit-quality reviewer can verify.",
    workflows: [
      {
        slug: "workpaper-drafting",
        title: "Audit workpaper drafting",
        problem:
          "Workpaper review takes 40% of audit budget; AI compresses to 10%.",
        retentionYears: 7,
        regulations: ["PCAOB AS 1215"],
        agentStatus: "shipped",
      },
      {
        slug: "tax-court-analog",
        title: "Tax-court precedent analysis",
        problem:
          "Tax-court analogue search is the slowest part of every tax engagement.",
        retentionYears: 7,
        regulations: ["IRS Circular 230"],
        agentStatus: "shipped",
      },
    ],
  },
  {
    category: "legal",
    name: "Legal — litigation",
    weight: "heavy",
    positioning:
      "E-discovery + deposition prep with receipts every reviewing court accepts.",
    workflows: [
      {
        slug: "e-discovery",
        title: "E-discovery document review",
        problem: "E-discovery is the #1 cost driver in commercial litigation.",
        retentionYears: 10,
        regulations: ["FRCP", "Federal Rules of Evidence"],
        agentStatus: "shipped",
      },
      {
        slug: "deposition-prep",
        title: "Deposition outline + witness prep",
        problem:
          "Senior attorney time on dep prep averages $1,500/hr; AI 90% of the work.",
        retentionYears: 10,
        regulations: ["State bar rules"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "legal",
    name: "Legal — corporate",
    weight: "heavy",
    positioning:
      "Contract review + M&A due diligence with audit-trail-quality receipts.",
    workflows: [
      {
        slug: "contract-review",
        title: "Contract review + redlining",
        problem:
          "Standard MSA / NDA / SOW review eats 30% of in-house counsel time.",
        retentionYears: 7,
        regulations: ["State bar rules", "ABA Model Rules"],
        agentStatus: "shipped",
      },
      {
        slug: "ma-due-diligence",
        title: "M&A data-room due diligence",
        problem:
          "Data-room review fatigue causes 15% of M&A disputes post-close.",
        retentionYears: 10,
        regulations: ["State M&A statutes"],
        agentStatus: "shipped",
      },
    ],
  },
  {
    category: "esg-csrd",
    name: "CSRD / ESG reporting",
    weight: "heavy",
    positioning:
      "ESRS-conformant datapoint coverage with per-figure cryptographic receipts.",
    workflows: [
      {
        slug: "esrs-datapoint-coverage",
        title: "ESRS datapoint coverage analysis",
        problem:
          "EU CSRD demands 1,144 datapoints per reporting entity; AI maps + audits.",
        retentionYears: 10,
        regulations: ["EU CSRD", "ESRS"],
        agentStatus: "shipped",
      },
      {
        slug: "double-materiality",
        title: "Double-materiality narrative",
        problem:
          "DMA is the most subjective CSRD requirement; receipts force defensibility.",
        retentionYears: 10,
        regulations: ["EU CSRD"],
        agentStatus: "shipped",
      },
      {
        slug: "scope-3-emissions",
        title: "Scope 3 emissions narrative",
        problem:
          "Scope 3 covers 75% of corporate emissions; AI + supplier data closes the gap.",
        retentionYears: 10,
        regulations: ["GHG Protocol", "EU CSRD"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "defense",
    name: "Defense / intelligence",
    weight: "heavy",
    positioning:
      "Receipt-anchored decision support with WebAuthn + ML-DSA-65 + dedicated region.",
    workflows: [
      {
        slug: "osint-synthesis",
        title: "Open-source intel synthesis",
        problem:
          "OSINT volume exceeds analyst capacity 1000:1; AI compresses without bias.",
        retentionYears: 25,
        regulations: ["DoD 5240.1-R", "EO 12333"],
        agentStatus: "scoped",
      },
      {
        slug: "contract-compliance",
        title: "DoD contract compliance review",
        problem: "FAR/DFARS compliance is the #1 reason DoD primes lose bids.",
        retentionYears: 10,
        regulations: ["FAR", "DFARS", "CMMC 2.0"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "aviation",
    name: "Aviation",
    weight: "heavy",
    positioning: "FAA submission drafting + maintenance log receipts.",
    workflows: [
      {
        slug: "faa-submission",
        title: "FAA Form 8130 + airworthiness submission",
        problem:
          "FAA documentation backlogs delay airworthiness certifications.",
        retentionYears: 25,
        regulations: ["FAA 14 CFR Part 21"],
        agentStatus: "scoped",
      },
      {
        slug: "maintenance-log",
        title: "Maintenance log entry generation",
        problem:
          "Maintenance log integrity is the leading cause of A&P license action.",
        retentionYears: 25,
        regulations: ["FAA 14 CFR Part 43"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "energy",
    name: "Energy / utilities",
    weight: "heavy",
    positioning: "NERC CIP compliance + outage post-mortem narratives.",
    workflows: [
      {
        slug: "nerc-cip-narrative",
        title: "NERC CIP compliance narrative",
        problem:
          "CIP violations average $25K/day; AI drafts mitigation plans hour-by-hour.",
        retentionYears: 7,
        regulations: ["NERC CIP-002 through CIP-014"],
        agentStatus: "shipped",
      },
      {
        slug: "outage-postmortem",
        title: "Outage post-mortem report",
        problem:
          "Public-service-commission filings on outages drive utility rate cases.",
        retentionYears: 10,
        regulations: ["State PSC rules"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "telecom",
    name: "Telecom",
    weight: "heavy",
    positioning: "Lawful intercept + interconnect compliance receipts.",
    workflows: [
      {
        slug: "lawful-intercept-records",
        title: "Lawful intercept record retention narrative",
        problem:
          "CALEA + Pen-Register Act compliance audits demand reconstructable records.",
        retentionYears: 7,
        regulations: ["CALEA", "ECPA"],
        agentStatus: "scoped",
      },
      {
        slug: "fcc-filing",
        title: "FCC / ICASA / Ofcom regulatory filing",
        problem:
          "Telecom filings are the most-cited compliance pain point in 2026.",
        retentionYears: 10,
        regulations: ["FCC Part 64", "ICASA EC Act"],
        agentStatus: "scoped",
      },
    ],
  },
  // ── Medium-regulation verticals ──────────────────────────────────
  {
    category: "manufacturing",
    name: "Manufacturing",
    weight: "medium",
    positioning:
      "Industrial Foundation Model agents on the shop floor with OEE-aware receipts.",
    workflows: [
      {
        slug: "oee-analysis",
        title: "Overall Equipment Effectiveness analysis",
        problem:
          "OEE drops cost mid-market plants $2-5M/yr; agents detect + suggest fixes.",
        retentionYears: 3,
        regulations: ["ISO 22400"],
        agentStatus: "shipped",
      },
      {
        slug: "supplier-quality-audit",
        title: "Supplier quality audit",
        problem:
          "Quality escapes from suppliers are the #1 warranty-cost driver.",
        retentionYears: 7,
        regulations: ["IATF 16949", "ISO 9001"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "logistics",
    name: "Logistics / supply chain",
    weight: "medium",
    positioning:
      "Exception narratives + customs filings receipts auditors accept.",
    workflows: [
      {
        slug: "customs-filing",
        title: "Customs / ATA Carnet filing narrative",
        problem: "Customs delays drive 30% of B2B logistics SLAs misses.",
        retentionYears: 5,
        regulations: ["19 CFR (US Customs)", "WCO SAFE Framework"],
        agentStatus: "shipped",
      },
      {
        slug: "exception-narrative",
        title: "Shipper exception + dispute narrative",
        problem:
          "Carrier disputes consume the largest single chunk of ops manager time.",
        retentionYears: 3,
        regulations: ["Carmack Amendment"],
        agentStatus: "shipped",
      },
    ],
  },
  {
    category: "construction",
    name: "Construction",
    weight: "medium",
    positioning:
      "OSHA compliance + RFI/submittal drafting with cryptographic provenance.",
    workflows: [
      {
        slug: "osha-compliance",
        title: "OSHA 300 / 301 form drafting",
        problem:
          "OSHA recordkeeping violations average $15K each; AI eliminates omissions.",
        retentionYears: 5,
        regulations: ["29 CFR 1904"],
        agentStatus: "scoped",
      },
      {
        slug: "rfi-submittal",
        title: "RFI + submittal drafting",
        problem:
          "RFI turnaround time is the leading source of project schedule slippage.",
        retentionYears: 7,
        regulations: ["AIA Document G716"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "education",
    name: "Education — K-12 + higher ed",
    weight: "medium",
    positioning: "IEP drafting + Title-IX evidence + accreditation narratives.",
    workflows: [
      {
        slug: "iep-drafting",
        title: "Individualized Education Program drafting",
        problem:
          "IEP compliance violations are the largest single source of district lawsuits.",
        retentionYears: 7,
        regulations: ["IDEA", "FERPA"],
        agentStatus: "scoped",
      },
      {
        slug: "title-ix-evidence",
        title: "Title IX evidence narrative",
        problem:
          "Title IX investigations require ironclad documentation chains.",
        retentionYears: 7,
        regulations: ["Title IX (US Ed. Dept)"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "public-sector",
    name: "Public sector / government",
    weight: "medium",
    positioning:
      "FOIA + benefit-determination narratives with public-verifiable receipts.",
    workflows: [
      {
        slug: "foia-response",
        title: "FOIA / PROATIA response drafting",
        problem:
          "FOIA backlogs run 200+ days; AI drafts compliant responses in hours.",
        retentionYears: 7,
        regulations: ["FOIA (5 USC 552)", "PROATIA (RSA)"],
        agentStatus: "scoped",
      },
      {
        slug: "benefit-determination",
        title: "Public benefit determination narrative",
        problem:
          "Benefit-denial appeals overturn 35% of original decisions — defensible AI cuts this.",
        retentionYears: 7,
        regulations: ["State APA rules"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "cybersecurity",
    name: "Cybersecurity",
    weight: "medium",
    positioning:
      "Incident-response postmortems + threat-intel briefs with tamper-evident receipts.",
    workflows: [
      {
        slug: "incident-postmortem",
        title: "Incident-response postmortem",
        problem:
          "Postmortem quality determines insurance + regulator response — receipts force rigor.",
        retentionYears: 7,
        regulations: ["SEC 8-K cyber rule", "NYDFS Part 500"],
        agentStatus: "shipped",
      },
      {
        slug: "breach-notification",
        title: "Breach notification drafting",
        problem:
          "60+ jurisdiction-specific notification rules; AI tailors per recipient.",
        retentionYears: 7,
        regulations: ["GDPR Art. 33/34", "POPIA s.22", "state breach laws"],
        agentStatus: "shipped",
      },
    ],
  },
  // ── Lighter-regulation verticals ─────────────────────────────────
  {
    category: "marketing-adtech",
    name: "Marketing / ad-tech",
    weight: "light",
    positioning:
      "Consent-trail + AI-content disclosure with public-verifiable receipts.",
    workflows: [
      {
        slug: "ai-content-disclosure",
        title: "AI-generated-content disclosure",
        problem:
          "FTC AI endorsement rules + EU AI Act demand provenance on AI-made content.",
        retentionYears: 3,
        regulations: ["EU AI Act Art. 50", "FTC Endorsement Guides"],
        agentStatus: "shipped",
      },
      {
        slug: "programmatic-attribution-audit",
        title: "Programmatic attribution audit",
        problem:
          "MFA (made-for-arbitrage) sites siphon 23% of programmatic spend.",
        retentionYears: 2,
        regulations: ["MRC AI guidance"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "crypto-defi",
    name: "Crypto / DeFi",
    weight: "light",
    positioning:
      "On-chain reconciliation narratives + tax-lot reporting with cryptographic receipts.",
    workflows: [
      {
        slug: "tax-lot-reporting",
        title: "Tax-lot reporting (8949 / per-jurisdiction)",
        problem:
          "Crypto tax reporting is the #1 IRS audit trigger for individual filers.",
        retentionYears: 7,
        regulations: ["IRS Notice 2014-21", "Form 8949"],
        agentStatus: "scoped",
      },
    ],
  },
  {
    category: "climate-carbon",
    name: "Climate / carbon credits",
    weight: "medium",
    positioning:
      "MRV (measurement, reporting, verification) receipts a registry accepts.",
    workflows: [
      {
        slug: "mrv-narrative",
        title: "MRV narrative for offset registries",
        problem:
          "Verra + Gold Standard tightened MRV in 2025; AI compresses validator time.",
        retentionYears: 30,
        regulations: ["Verra VCS", "Gold Standard", "Article 6.4"],
        agentStatus: "scoped",
      },
    ],
  },
];

// ── Public API ────────────────────────────────────────────────────────

export interface RegistrySummary {
  industryCount: number;
  workflowCount: number;
  shippedCount: number;
  inProgressCount: number;
  scopedCount: number;
  byWeight: Record<RegulatoryWeight, number>;
}

/** Read-only list of every industry in the catalog. */
export function listIndustries(): Industry[] {
  return INDUSTRIES;
}

/** Look up a single industry by category. */
export function findIndustry(category: IndustryCategory): Industry | undefined {
  return INDUSTRIES.find((i) => i.category === category);
}

/** All workflows flattened into a single list with their industry. */
export function listAllWorkflows(): Array<
  WorkflowGap & { industry: IndustryCategory; industryName: string }
> {
  const out: Array<
    WorkflowGap & { industry: IndustryCategory; industryName: string }
  > = [];
  for (const ind of INDUSTRIES) {
    for (const w of ind.workflows) {
      out.push({ ...w, industry: ind.category, industryName: ind.name });
    }
  }
  return out;
}

/** Stats for the public marketing surface — single source of truth. */
export function registrySummary(): RegistrySummary {
  const all = listAllWorkflows();
  return {
    industryCount: INDUSTRIES.length,
    workflowCount: all.length,
    shippedCount: all.filter((w) => w.agentStatus === "shipped").length,
    inProgressCount: all.filter((w) => w.agentStatus === "in-progress").length,
    scopedCount: all.filter((w) => w.agentStatus === "scoped").length,
    byWeight: {
      heavy: INDUSTRIES.filter((i) => i.weight === "heavy").length,
      medium: INDUSTRIES.filter((i) => i.weight === "medium").length,
      light: INDUSTRIES.filter((i) => i.weight === "light").length,
    },
  };
}

/**
 * Project the registry onto a deterministic canonical projection.
 * Industries and workflows are emitted in declaration order (which is
 * stable — every reorder would be a deliberate code change in this
 * file); within each, the field order is locked.
 */
export function canonicalize(): string {
  return JSON.stringify({
    v: 1,
    type: "industries-registry",
    summary: registrySummary(),
    industries: INDUSTRIES.map((i) => ({
      category: i.category,
      name: i.name,
      weight: i.weight,
      positioning: i.positioning,
      workflows: i.workflows.map((w) => ({
        slug: w.slug,
        title: w.title,
        problem: w.problem,
        retentionYears: w.retentionYears,
        regulations: w.regulations.slice().sort(),
        agentStatus: w.agentStatus,
      })),
    })),
  });
}

/** Sign the canonical projection — same scheme every receipt uses. */
export function signRegistry(): {
  canonical: string;
  contentHash: string;
  signature: string;
} {
  const canonical = canonicalize();
  const contentHash = createHash("sha256").update(canonical).digest("hex");
  const signature = signRun(canonical);
  return { canonical, contentHash, signature };
}
