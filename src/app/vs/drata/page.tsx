import type { Metadata } from "next";
import { VsPage, type VsPageData } from "@/components/vs/VsPage";

export const metadata: Metadata = {
  title:
    "Sovereign Matrix vs Drata — Open-source SOC 2 + ISO 42001 (Apache 2.0)",
  description:
    "Drata charges $5-50K/year for compliance automation. Sovereign Matrix ships Apache 2.0 evidence exporters for SOC 2 + EU AI Act + NIST + ISO 42001.",
};

const DATA: VsPageData = {
  competitorName: "Drata",
  competitorTagline:
    "Closed-source compliance automation — SOC 2, ISO 27001, HIPAA, GDPR, PCI. Series C, ~$200M ARR run-rate. Strong continuous-monitoring + audit-readiness story.",
  competitorCategory: "Compliance automation",
  competitorPriceRange: "$5K-50K+ USD / year",
  ourAngle:
    "Drata is excellent at SOC 2 + ISO 27001 continuous monitoring. Sovereign Matrix is the Apache 2.0 layer for AI-specific frameworks Drata doesn't cover — EU AI Act Annex IV, ISO 42001 AIMS, NIST AI RMF — plus the byte-deterministic evidence primitive underneath.",
  whoTheyServe:
    "SaaS companies preparing for SOC 2 + ISO 27001 audits. Customers who want continuous-control-monitoring + auto-evidence-collection in a polished SaaS UI.",
  whoWeServe:
    "Engineering teams + AI-product companies that need AI-governance frameworks (EU AI Act / ISO 42001 / NIST RMF) alongside SOC 2 — and want the evidence primitive (signed receipts) Drata doesn't provide.",
  comparison: [
    {
      feature: "License",
      competitor: { value: "Closed-source SaaS", tone: "bad" },
      sovereign: { value: "Apache 2.0", tone: "good" },
    },
    {
      feature: "SOC 2 evidence generation",
      competitor: {
        value: "Continuous-monitoring + auto-collection",
        tone: "good",
      },
      sovereign: {
        value: "@sovereign-matrix/compliance (free)",
        tone: "good",
      },
    },
    {
      feature: "ISO 27001",
      competitor: { value: "Built-in", tone: "good" },
      sovereign: { value: "Not in scope", tone: "neutral" },
    },
    {
      feature: "HIPAA",
      competitor: "Built-in",
      sovereign: {
        value: "@sovereign-matrix/compliance (free)",
        tone: "good",
      },
    },
    {
      feature: "EU AI Act Annex IV",
      competitor: { value: "Not covered", tone: "bad" },
      sovereign: { value: "@sovereign-matrix/annex-iv (free)", tone: "good" },
    },
    {
      feature: "ISO/IEC 42001 AIMS",
      competitor: { value: "Not covered", tone: "bad" },
      sovereign: { value: "@sovereign-matrix/iso-42001 (free)", tone: "good" },
    },
    {
      feature: "NIST AI RMF 1.0",
      competitor: { value: "Not covered", tone: "bad" },
      sovereign: {
        value: "@sovereign-matrix/compliance (free)",
        tone: "good",
      },
    },
    {
      feature: "Continuous control monitoring (auto-pull from cloud APIs)",
      competitor: { value: "Strong — flagship feature", tone: "good" },
      sovereign: { value: "Not in scope — bring your own", tone: "neutral" },
    },
    {
      feature: "Auditor-pre-vetted CPA firm relationships",
      competitor: { value: "Hundreds", tone: "good" },
      sovereign: { value: "Bring your own auditor", tone: "neutral" },
    },
    {
      feature: "Policy management + employee onboarding",
      competitor: { value: "Built-in workflow", tone: "good" },
      sovereign: { value: "Bring your own", tone: "neutral" },
    },
    {
      feature: "Cryptographic receipts (Ed25519 + ML-DSA-65)",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Core primitive", tone: "good" },
    },
    {
      feature: "Byte-deterministic, auditor-reproducible evidence",
      competitor: "Approximate — depends on integration source",
      sovereign: { value: "Yes by design", tone: "good" },
    },
    {
      feature: "Per-criterion days-of-coverage gap analysis (SOC 2)",
      competitor: "Available in the UI",
      sovereign: { value: "Default in the exporter", tone: "good" },
    },
    {
      feature: "MCP / Claude Code integration",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "@sovereign-matrix/mcp", tone: "good" },
    },
    {
      feature: "Self-hostable",
      competitor: { value: "Hosted only", tone: "bad" },
      sovereign: { value: "Yes — fork the repo", tone: "good" },
    },
    {
      feature: "Annual price",
      competitor: "$5K-50K+ USD",
      sovereign: { value: "$0 OSS · managed coming", tone: "good" },
    },
  ],
  whenToPickThem: [
    "You want continuous control monitoring with auto-evidence-collection from AWS / GCP / Okta / GitHub / etc.",
    "You're targeting SOC 2 + ISO 27001 + HIPAA + PCI together and want the bundle in one polished SaaS console.",
    "You want pre-vetted auditor relationships to accelerate the engagement.",
    "You don't ship AI subject to AI-governance frameworks (EU AI Act, ISO 42001, NIST RMF).",
  ],
  whenToPickUs: [
    "You operate AI in regulated verticals — Drata doesn't cover AI-governance frameworks.",
    "You want Apache 2.0 verifiers your auditor can re-run independently against your receipts.",
    "You want one receipt set powering SOC 2 + AI Act + ISO 42001 + NIST + GDPR + HIPAA exporters.",
    "You want post-quantum-signed evidence — Drata's evidence is screenshots + log files, not signed artifacts.",
    "You want zero vendor lock-in.",
  ],
  npmPackageHighlight: "@sovereign-matrix/compliance",
  installCommand: `npm install @sovereign-matrix/compliance @sovereign-matrix/verifiable-receipts`,
};

export default function VsDrataPage() {
  return <VsPage data={DATA} />;
}
