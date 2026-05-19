import type { Metadata } from "next";
import { VsPage, type VsPageData } from "@/components/vs/VsPage";

export const metadata: Metadata = {
  title:
    "Sovereign Matrix vs Credo AI — Open-source EU AI Act + NIST RMF (Apache 2.0)",
  description:
    "Credo AI charges $50-200K/year for AI governance. Sovereign Matrix ships the same regulator-ready EU AI Act + NIST AI RMF + ISO 42001 exporters Apache 2.0.",
};

const DATA: VsPageData = {
  competitorName: "Credo AI",
  competitorTagline:
    "Closed-source AI governance platform — EU AI Act, NIST AI RMF, ISO 42001, bias + fairness audits. One of the first dedicated AI-governance vendors. Series B funded.",
  competitorCategory: "AI governance",
  competitorPriceRange: "$50K-200K+ USD / year",
  ourAngle:
    "Credo AI is one of the strongest closed-source AI-governance products on the market. Sovereign Matrix ships the same regulator-ready deliverables — EU AI Act Annex IV, ISO 42001 AIMS, NIST AI RMF — as Apache 2.0 OSS, with cryptographic receipts as the underlying audit primitive Credo AI doesn't ship.",
  whoTheyServe:
    "Mid-market + enterprise teams shipping high-risk AI under EU AI Act / NIST RMF requirements. Customers who want managed governance with dedicated CSM + bias audit services.",
  whoWeServe:
    "Engineering teams who want a programmable, version-controllable governance pipeline. AI-product companies that want byte-deterministic, auditor-reproducible reports their regulator can re-derive from receipts.",
  comparison: [
    {
      feature: "License",
      competitor: { value: "Closed-source SaaS", tone: "bad" },
      sovereign: { value: "Apache 2.0", tone: "good" },
    },
    {
      feature: "EU AI Act Annex IV exporter",
      competitor: { value: "Yes — proprietary", tone: "good" },
      sovereign: { value: "@sovereign-matrix/annex-iv (free)", tone: "good" },
    },
    {
      feature: "ISO/IEC 42001 AIMS",
      competitor: { value: "Yes — proprietary", tone: "good" },
      sovereign: { value: "@sovereign-matrix/iso-42001 (free)", tone: "good" },
    },
    {
      feature: "NIST AI RMF 1.0",
      competitor: { value: "Yes — proprietary", tone: "good" },
      sovereign: {
        value: "@sovereign-matrix/nist-ai-rmf (free)",
        tone: "good",
      },
    },
    {
      feature: "GDPR DPIA + RoPA",
      competitor: "Partial",
      sovereign: { value: "@sovereign-matrix/gdpr-dpia (free)", tone: "good" },
    },
    {
      feature: "HIPAA Security Rule",
      competitor: { value: "Not core focus", tone: "bad" },
      sovereign: {
        value: "@sovereign-matrix/hipaa-security (free)",
        tone: "good",
      },
    },
    {
      feature: "SOC 2 evidence binder",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: {
        value: "@sovereign-matrix/soc2-evidence (free)",
        tone: "good",
      },
    },
    {
      feature: "Bias + fairness audits (managed service)",
      competitor: { value: "Yes — flagship offering", tone: "good" },
      sovereign: { value: "Bring your own auditor", tone: "neutral" },
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
      feature: "RFC 9162 transparency log",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Anchored on every receipt", tone: "good" },
    },
    {
      feature: "3-language verifier (TS / Python / Go) with conformance corpus",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "Byte-deterministic across all 3", tone: "good" },
    },
    {
      feature: "MCP / Claude Code integration",
      competitor: { value: "Not offered", tone: "bad" },
      sovereign: { value: "@sovereign-matrix/mcp · 7 tools", tone: "good" },
    },
    {
      feature: "Self-hostable",
      competitor: { value: "No", tone: "bad" },
      sovereign: { value: "Yes — fork the repo", tone: "good" },
    },
    {
      feature: "Annual price",
      competitor: "$50K-200K+ USD",
      sovereign: { value: "$0 OSS · managed coming", tone: "good" },
    },
  ],
  whenToPickThem: [
    "You want a managed bias + fairness audit service with PhD-level researchers on-call.",
    "You need a non-technical UI for compliance officers to operate the governance program end-to-end.",
    "You want dedicated CSM + onboarding + training.",
    "Your procurement organisation strongly prefers an established closed-source vendor with E&O insurance.",
  ],
  whenToPickUs: [
    "You're an engineering-led team and want compliance artifacts as version-controlled code, not screenshots in a SaaS dashboard.",
    "You want cryptographic receipts as the audit primitive — every claim in the report is reproducible by your regulator.",
    "You want post-quantum-secure signatures by default, ahead of the NIST mandate.",
    "You operate across multiple frameworks (AI Act + ISO 42001 + NIST + SOC 2 + GDPR + HIPAA) and want one receipt set powering all six exporters.",
    "You want MCP tools that let Claude Code generate compliance reports from inside your editor.",
    "You want zero vendor lock-in.",
  ],
  npmPackageHighlight: "@sovereign-matrix/annex-iv",
  installCommand: `npm install \\
  @sovereign-matrix/annex-iv \\
  @sovereign-matrix/iso-42001 \\
  @sovereign-matrix/nist-ai-rmf \\
  @sovereign-matrix/verifiable-receipts`,
};

export default function VsCredoAiPage() {
  return <VsPage data={DATA} />;
}
