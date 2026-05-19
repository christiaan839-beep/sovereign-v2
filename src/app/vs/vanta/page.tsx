import type { Metadata } from "next";
import { VsPage, type VsPageData } from "@/components/vs/VsPage";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Vanta — Open-source SOC 2 evidence (Apache 2.0)",
  description:
    "Vanta charges $5-50K/year for SOC 2 evidence. Sovereign Matrix ships @sovereign-matrix/soc2-evidence Apache 2.0. Side-by-side comparison.",
};

const DATA: VsPageData = {
  competitorName: "Vanta",
  competitorTagline:
    "Closed-source compliance OS — SOC 2 + ISO 27001 + HIPAA + GDPR + 30 frameworks. ~$160M ARR pre-IPO. ~500 employees. Strong auditor relationships.",
  competitorCategory: "SOC 2 + compliance OS",
  competitorPriceRange: "$5K-50K+ USD / year",
  ourAngle:
    "Vanta is a great product if you want a closed-source compliance OS with hand-holding. Sovereign Matrix is the Apache 2.0 evidence-generation layer underneath — every SOC 2 binder Vanta produces, we generate from receipts for free.",
  whoTheyServe:
    "Mid-market + enterprise SaaS preparing for SOC 2 Type II audits. Strongest at the comprehensive compliance-operations bundle.",
  whoWeServe:
    "Developers and platform teams who want OSS, byte-deterministic evidence + post-quantum receipts. AI-product companies subject to EU AI Act / ISO 42001 / NIST RMF alongside SOC 2.",
  comparison: [
    {
      feature: "License",
      competitor: { value: "Closed-source SaaS", tone: "bad" },
      sovereign: { value: "Apache 2.0", tone: "good" },
    },
    {
      feature: "SOC 2 evidence generation",
      competitor: "Built into the platform",
      sovereign: {
        value: "@sovereign-matrix/soc2-evidence (free)",
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
        value: "@sovereign-matrix/nist-ai-rmf (free)",
        tone: "good",
      },
    },
    {
      feature: "Auditor pre-vetting (CPA firm relationships)",
      competitor: { value: "100+ CPA firm integrations", tone: "good" },
      sovereign: {
        value: "None — bring your own auditor",
        tone: "bad",
      },
    },
    {
      feature: "Policy management UI",
      competitor: { value: "Full editor + templates", tone: "good" },
      sovereign: { value: "Bring your own", tone: "neutral" },
    },
    {
      feature: "Security questionnaire auto-fill",
      competitor: { value: "Built-in", tone: "good" },
      sovereign: { value: "Bring your own", tone: "neutral" },
    },
    {
      feature: "Vendor risk module",
      competitor: { value: "Built-in", tone: "good" },
      sovereign: { value: "Not in scope", tone: "neutral" },
    },
    {
      feature: "Cryptographic receipts (Ed25519 + ML-DSA-65)",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Core primitive", tone: "good" },
    },
    {
      feature: "Post-quantum signatures (FIPS 204)",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Default", tone: "good" },
    },
    {
      feature: "Byte-deterministic, auditor-reproducible reports",
      competitor: "Approximate — depends on integration",
      sovereign: { value: "Yes by design", tone: "good" },
    },
    {
      feature: "MCP / Claude Code integration",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: {
        value: "@sovereign-matrix/mcp · 7 tools",
        tone: "good",
      },
    },
    {
      feature: "Self-hostable",
      competitor: { value: "No", tone: "bad" },
      sovereign: { value: "Yes — fork the repo", tone: "good" },
    },
    {
      feature: "Annual price",
      competitor: "$5K-50K+ USD",
      sovereign: { value: "$0 OSS · managed coming", tone: "good" },
    },
  ],
  whenToPickThem: [
    "You want the full compliance-OS bundle — SOC 2 + ISO 27001 + HIPAA + GDPR + vendor risk + policies in one platform.",
    "You're a non-technical compliance team that needs UI for everything.",
    "You want pre-vetted auditor relationships to accelerate the engagement.",
    "You're indifferent to OSS vs closed-source and don't subject AI specifically to AI governance frameworks (EU AI Act, ISO 42001, NIST RMF).",
  ],
  whenToPickUs: [
    "You operate AI in regulated verticals and need EU AI Act + ISO 42001 + NIST RMF coverage Vanta doesn't offer.",
    "You want Apache 2.0 verifiers your auditor can re-run against your receipts independently.",
    "You're shipping production AI with post-quantum-signed receipts as the audit primitive.",
    "You want MCP tools that let Claude Code generate compliance reports from inside your editor.",
    "You want zero vendor lock-in — fork the repo and self-host if needed.",
  ],
  npmPackageHighlight: "@sovereign-matrix/soc2-evidence",
  installCommand: `npm install @sovereign-matrix/soc2-evidence @sovereign-matrix/verifiable-receipts`,
};

export default function VsVantaPage() {
  return <VsPage data={DATA} />;
}
