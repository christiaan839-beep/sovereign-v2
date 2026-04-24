/**
 * Starter Bundles — curated bundles per industry, shipped as catalog
 * constants (not DB-persisted).
 *
 * WHY NOT DATABASE-BACKED?
 * ────────────────────────
 * The dynamic bundle system (src/lib/agent-bundles.ts) is for CREATORS
 * to publish custom bundles — those live in Postgres. These starter
 * bundles are FIRST-PARTY marketing curations that the platform itself
 * ships as "here's a recipe you can use today". They need zero DB
 * migration to show up, zero moderation, zero pricing flow. They link
 * to /playground?agent=<first-slug> as the simplest activation path.
 *
 * If a specific starter gets enough traction we promote it to a real
 * paid bundle (creator-owned, DB-backed, revenue-share) using the same
 * shape. Until then it's a static marketing surface.
 */

export interface StarterBundle {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  industry:
    | "insurance"
    | "logistics"
    | "healthcare"
    | "construction"
    | "agriculture"
    | "finance"
    | "recruiting"
    | "retail";
  agents: Array<{
    slug: string;
    displayName: string;
    category: string;
  }>;
  useCases: string[];
  /** Estimated monthly value to a mid-market user — drives the pricing narrative. */
  estimatedMonthlyValueUsd: number;
  /** Icon hint for marketing surfaces. */
  accentColor: string;
}

export const STARTER_BUNDLES: StarterBundle[] = [
  {
    slug: "insurance-starter",
    name: "Insurance Starter",
    tagline: "FNOL to COI to fraud flag — the core insurance workflow.",
    description:
      "Everything a brokerage or TPA needs on day one. First Notice of Loss intake, Certificate of Insurance verification, NDA triage for vendor contracts, and claim-document extraction — all shaped for Guidewire / Duck Creek / Origami imports.",
    industry: "insurance",
    agents: [
      { slug: "fnol-intake", displayName: "FNOL Intake", category: "Insurance" },
      { slug: "coi-verifier", displayName: "COI Verifier", category: "Insurance" },
      { slug: "nda-triage", displayName: "NDA Triage", category: "Legal" },
      { slug: "id-verifier", displayName: "ID Verifier", category: "Compliance" },
    ],
    useCases: [
      "Auto-classify incoming claims at FNOL into line-of-business + severity",
      "Verify every vendor COI with <2 min turnaround",
      "Redline NDAs before they hit legal review",
      "Extract structured data from ACORD certificates",
    ],
    estimatedMonthlyValueUsd: 12000,
    accentColor: "#F87171",
  },
  {
    slug: "logistics-starter",
    name: "Logistics Starter",
    tagline: "BOL to TMS to HS code — paper-to-digital in one pack.",
    description:
      "The freight broker's bundle. Bill-of-Lading OCR feeding McLeod / MercuryGate, HS classification that holds up in CBP audits, and invoice extraction for AP reconciliation. Shippers cut keystroke labor 80% on day one.",
    industry: "logistics",
    agents: [
      {
        slug: "bill-of-lading-reader",
        displayName: "Bill of Lading Reader",
        category: "Logistics",
      },
      {
        slug: "hs-code-classifier",
        displayName: "HS Code Classifier",
        category: "Logistics",
      },
      { slug: "invoice-ocr", displayName: "Invoice OCR", category: "Finance" },
      {
        slug: "business-card-reader",
        displayName: "Contact Card Reader",
        category: "Sales",
      },
    ],
    useCases: [
      "OCR 50 BOLs per morning in <4 min, pushed straight to your TMS",
      "Classify outbound shipments with GRI-compliant HS codes",
      "Reconcile freight invoices against BOLs automatically",
      "Capture leads from freight-show business cards",
    ],
    estimatedMonthlyValueUsd: 8400,
    accentColor: "#FDE047",
  },
  {
    slug: "healthcare-starter",
    name: "Healthcare Coding Starter",
    tagline: "ICD-10 + CPT + prior-auth drafts — reduce coder backlog 60%.",
    description:
      "Addresses the national medical coder shortage head-on. ICD-10 suggestions with HCC flags, prior-auth drafting with guideline citations, and chart summarization. Every output ships advisory + disclaimer — a certified coder still signs.",
    industry: "healthcare",
    agents: [
      { slug: "icd10-coder", displayName: "ICD-10 Coder", category: "Healthcare" },
      {
        slug: "prior-auth-drafter",
        displayName: "Prior Auth Drafter",
        category: "Healthcare",
      },
      {
        slug: "healthcare-docs",
        displayName: "Healthcare Docs Summarizer",
        category: "Healthcare",
      },
      { slug: "gliner-pii", displayName: "PII Detector", category: "Safety" },
    ],
    useCases: [
      "First-pass ICD-10 on every outpatient encounter",
      "Draft prior-auth packets with the right guideline cites",
      "Summarize 5-page charts for physician prep",
      "Redact PHI before any LLM call",
    ],
    estimatedMonthlyValueUsd: 18000,
    accentColor: "#22D3EE",
  },
  {
    slug: "construction-starter",
    name: "Construction Ops Starter",
    tagline: "Permit drafting + OSHA 300 + blueprint parsing — the GC pack.",
    description:
      "The bundle a GC running $100M-$1B revenue needs. Permit-form drafting with IBC occupancy classification, OSHA 300/301 recordability drafts, and blueprint-PDF → room-level JSON for takeoffs. Output shapes match Procore + Autodesk Construction Cloud.",
    industry: "construction",
    agents: [
      {
        slug: "permit-form-filler",
        displayName: "Permit Form Filler",
        category: "Real Estate",
      },
      {
        slug: "safety-incident-reporter",
        displayName: "OSHA Safety Reporter",
        category: "Real Estate",
      },
      {
        slug: "blueprint-parser",
        displayName: "Blueprint Parser",
        category: "Real Estate",
      },
      { slug: "id-verifier", displayName: "Subcontractor ID Verifier", category: "Compliance" },
    ],
    useCases: [
      "First-pass-clean permit applications with IBC occupancy classification",
      "Draft OSHA 300/301 reports with recordability tests built-in",
      "Parse architect PDFs into room-level dimensions for takeoffs",
      "Verify subcontractor IDs before site access",
    ],
    estimatedMonthlyValueUsd: 9600,
    accentColor: "#FB923C",
  },
  {
    slug: "agriculture-season-starter",
    name: "Ag Season Starter",
    tagline: "Soil test intake + field scouting + compliance drafts.",
    description:
      "Every piece of paperwork a 1-5k-acre operation sees in a season. Lab-report ingestion keyed to Operations Center + FieldView, smartphone-photo crop scouting with CCA-grade triage, and USDA/state compliance drafts from farm records.",
    industry: "agriculture",
    agents: [
      {
        slug: "soil-report-extractor",
        displayName: "Soil Report Extractor",
        category: "Agriculture",
      },
      {
        slug: "crop-health-scout",
        displayName: "Crop Health Scout",
        category: "Agriculture",
      },
      { slug: "grant-finder-writer", displayName: "Grant Writer", category: "General" },
      { slug: "weekly-report", displayName: "Farm Weekly Report", category: "General" },
    ],
    useCases: [
      "Ingest 30 soil reports in a season, push to John Deere Ops Center",
      "Triage every field photo before the CCA visits",
      "Find + draft NRCS / USDA grant applications",
      "Auto-generate the weekly operations summary for banks",
    ],
    estimatedMonthlyValueUsd: 4200,
    accentColor: "#34D399",
  },
];

export function getStarterBundle(slug: string): StarterBundle | undefined {
  return STARTER_BUNDLES.find((b) => b.slug === slug);
}

export function totalAddressableValueUsd(): number {
  return STARTER_BUNDLES.reduce(
    (acc, b) => acc + b.estimatedMonthlyValueUsd,
    0,
  );
}
