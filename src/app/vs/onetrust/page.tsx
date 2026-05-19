import type { Metadata } from "next";
import { VsPage, type VsPageData } from "@/components/vs/VsPage";

export const metadata: Metadata = {
  title:
    "Sovereign Matrix vs OneTrust — Open-source GDPR DPIA + RoPA (Apache 2.0)",
  description:
    "OneTrust charges $40-200K/year for privacy management. Sovereign Matrix ships @sovereign-matrix/gdpr-dpia Apache 2.0. Side-by-side comparison.",
};

const DATA: VsPageData = {
  competitorName: "OneTrust",
  competitorTagline:
    "Closed-source privacy + GRC platform — GDPR, CCPA, third-party risk, consent, DSAR automation. Large (~4000 employees). The default enterprise privacy stack.",
  competitorCategory: "Privacy + GDPR",
  competitorPriceRange: "$40K-200K+ USD / year",
  ourAngle:
    "OneTrust is the enterprise privacy command-center. Sovereign Matrix is the Apache 2.0 evidence layer for the specific deliverables — DPIA, RoPA, EU AI Act, ISO 42001 — that OneTrust produces for $40K+/year per module.",
  whoTheyServe:
    "Large enterprises with mature privacy + GRC programs. Customers who need consent banners + DSAR + vendor risk + privacy ops in one console.",
  whoWeServe:
    "Engineering + privacy teams who want a programmable evidence layer (`npm install` → DPIA generated from receipts) and don't want to operate enterprise-procurement workflow software.",
  comparison: [
    {
      feature: "License",
      competitor: { value: "Closed-source SaaS", tone: "bad" },
      sovereign: { value: "Apache 2.0", tone: "good" },
    },
    {
      feature: "GDPR Article 35 DPIA",
      competitor: "Built into the platform",
      sovereign: { value: "@sovereign-matrix/gdpr-dpia (free)", tone: "good" },
    },
    {
      feature: "GDPR Article 30 RoPA",
      competitor: "Built-in workflow",
      sovereign: { value: "@sovereign-matrix/gdpr-dpia (free)", tone: "good" },
    },
    {
      feature: "EU AI Act Annex IV",
      competitor: "Partial — manual workflow",
      sovereign: { value: "@sovereign-matrix/annex-iv (free)", tone: "good" },
    },
    {
      feature: "Consent management + banners",
      competitor: { value: "Comprehensive", tone: "good" },
      sovereign: { value: "Not in scope", tone: "neutral" },
    },
    {
      feature: "DSAR (data-subject-access-request) automation",
      competitor: { value: "Full workflow", tone: "good" },
      sovereign: { value: "Not in scope", tone: "neutral" },
    },
    {
      feature: "Vendor / third-party risk module",
      competitor: { value: "Comprehensive", tone: "good" },
      sovereign: { value: "Not in scope", tone: "neutral" },
    },
    {
      feature: "Cryptographic receipts (Ed25519 + ML-DSA-65)",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Core primitive", tone: "good" },
    },
    {
      feature: "Byte-deterministic, auditor-reproducible DPIA",
      competitor: { value: "No — depends on workflow", tone: "bad" },
      sovereign: { value: "Yes by design", tone: "good" },
    },
    {
      feature: "Auto-flag Article 36 prior consultation on high residual risk",
      competitor: "Workflow-driven approval",
      sovereign: { value: "Default behaviour", tone: "good" },
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
      competitor: "$40K-200K+ USD",
      sovereign: { value: "$0 OSS · managed coming", tone: "good" },
    },
  ],
  whenToPickThem: [
    "You're a Fortune 500 with global consent management + DSAR + vendor-risk requirements in one console.",
    "You need fully managed privacy ops with a dedicated CSM and 24×7 support.",
    "Your procurement organisation can absorb a 6-figure annual contract.",
    "Your privacy program is non-technical and runs entirely through enterprise SaaS workflows.",
  ],
  whenToPickUs: [
    "You only need the deliverables (DPIA, RoPA, Annex IV) — not the consent banners + DSAR machinery.",
    "You're a tech-forward team that wants programmable, version-controllable compliance artifacts.",
    "You operate AI products subject to EU AI Act + ISO 42001 alongside GDPR — Sovereign Matrix covers all three with one receipt set.",
    "You want auditor-reproducible evidence (byte-deterministic output) instead of workflow-screenshots-as-evidence.",
    "You want zero vendor lock-in — fork the repo and self-host if needed.",
  ],
  npmPackageHighlight: "@sovereign-matrix/gdpr-dpia",
  installCommand: `npm install @sovereign-matrix/gdpr-dpia @sovereign-matrix/verifiable-receipts`,
};

export default function VsOneTrustPage() {
  return <VsPage data={DATA} />;
}
