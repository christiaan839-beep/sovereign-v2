import type { Metadata } from "next";
import { VsPage, type VsPageData } from "@/components/vs/VsPage";

export const metadata: Metadata = {
  title:
    "Sovereign Matrix vs Holistic AI — Open-source AI assurance (Apache 2.0)",
  description:
    "Holistic AI charges $50-150K/year for AI assurance. Sovereign Matrix ships EU AI Act + ISO 42001 + NIST RMF exporters Apache 2.0.",
};

const DATA: VsPageData = {
  competitorName: "Holistic AI",
  competitorTagline:
    "Closed-source AI assurance platform — EU AI Act, NYC AEDT, NIST RMF, bias + robustness testing. UK-based. Strong research lab + academic credentials.",
  competitorCategory: "AI assurance",
  competitorPriceRange: "$50K-150K+ USD / year",
  ourAngle:
    "Holistic AI brings deep AI-safety research credentials and a managed assurance workflow. Sovereign Matrix brings the Apache 2.0 evidence primitive and the same regulatory exporters as code — programmable, version-controllable, byte-deterministic.",
  whoTheyServe:
    "Enterprises with significant model-risk exposure who want PhD-level adversarial robustness + bias testing as a managed service. NYC AEDT compliance + EU AI Act readiness.",
  whoWeServe:
    "Engineering + ML teams who treat compliance as code. Companies that ship AI products and need the exporter outputs without paying for the managed-research bundle.",
  comparison: [
    {
      feature: "License",
      competitor: { value: "Closed-source SaaS", tone: "bad" },
      sovereign: { value: "Apache 2.0", tone: "good" },
    },
    {
      feature: "EU AI Act Annex IV",
      competitor: { value: "Yes — proprietary", tone: "good" },
      sovereign: { value: "@sovereign-matrix/annex-iv (free)", tone: "good" },
    },
    {
      feature: "ISO/IEC 42001 AIMS",
      competitor: "Yes",
      sovereign: { value: "@sovereign-matrix/iso-42001 (free)", tone: "good" },
    },
    {
      feature: "NIST AI RMF 1.0",
      competitor: "Yes",
      sovereign: {
        value: "@sovereign-matrix/compliance (free)",
        tone: "good",
      },
    },
    {
      feature: "NYC AEDT bias audit",
      competitor: { value: "Yes — flagship", tone: "good" },
      sovereign: { value: "Bring your own auditor", tone: "neutral" },
    },
    {
      feature: "Bias + fairness research (managed)",
      competitor: { value: "PhD-level lab", tone: "good" },
      sovereign: { value: "Bring your own", tone: "neutral" },
    },
    {
      feature: "Adversarial robustness testing (managed)",
      competitor: { value: "Yes", tone: "good" },
      sovereign: {
        value: "OWASP Agentic Top 10 pack ships in receipts",
        tone: "neutral",
      },
    },
    {
      feature: "GDPR DPIA + RoPA",
      competitor: "Partial",
      sovereign: { value: "@sovereign-matrix/gdpr-dpia (free)", tone: "good" },
    },
    {
      feature: "HIPAA + SOC 2",
      competitor: { value: "Not core focus", tone: "bad" },
      sovereign: { value: "Both shipping as Apache 2.0", tone: "good" },
    },
    {
      feature: "Cryptographic receipts (Ed25519 + ML-DSA-65)",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Core primitive", tone: "good" },
    },
    {
      feature: "Byte-deterministic exporter output",
      competitor: { value: "No", tone: "bad" },
      sovereign: { value: "Yes by design", tone: "good" },
    },
    {
      feature: "3-language verifier conformance corpus",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "TS / Python / Go byte-identical", tone: "good" },
    },
    {
      feature: "MCP / Claude Code integration",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "@sovereign-matrix/mcp", tone: "good" },
    },
    {
      feature: "Self-hostable",
      competitor: { value: "No", tone: "bad" },
      sovereign: { value: "Yes — fork the repo", tone: "good" },
    },
    {
      feature: "Annual price",
      competitor: "$50K-150K+ USD",
      sovereign: { value: "$0 OSS · managed coming", tone: "good" },
    },
  ],
  whenToPickThem: [
    "You need PhD-level bias-audit research as a managed service (NYC AEDT, EEOC).",
    "Your AI risk profile justifies six-figure annual spend on managed assurance.",
    "You want adversarial-robustness testing performed for you, not as a library you operate.",
    "Your buyer is a Chief AI Officer who wants vendor-of-record relationships, not engineering primitives.",
  ],
  whenToPickUs: [
    "You're an engineering-led team and want compliance as code, not a SaaS workflow.",
    "You want byte-deterministic, auditor-reproducible reports your regulator can re-derive.",
    "You want cryptographic receipts as the audit primitive — Holistic AI doesn't ship this layer.",
    "You operate across multiple frameworks (AI Act + ISO 42001 + NIST + GDPR + HIPAA + SOC 2) and want one receipt set powering all six exporters.",
    "You want MCP integration so Claude Code can call your compliance pipeline directly.",
    "You want zero vendor lock-in.",
  ],
  npmPackageHighlight: "@sovereign-matrix/annex-iv",
  installCommand: `npm install \\
  @sovereign-matrix/annex-iv \\
  @sovereign-matrix/iso-42001 \\
  @sovereign-matrix/compliance \\
  @sovereign-matrix/verifiable-receipts`,
};

export default function VsHolisticAiPage() {
  return <VsPage data={DATA} />;
}
