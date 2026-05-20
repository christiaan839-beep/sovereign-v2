"use client";

import {
  Scale,
  ShieldAlert,
  MessageCircle,
  TrendingUp,
  Shield,
  Database,
  Layers,
  Zap,
} from "lucide-react";
import {
  VerticalPageShell,
  type VerticalConfig,
} from "@/components/landing/VerticalPageShell";

const config: VerticalConfig = {
  slug: "fintech",
  label: "Fintech",
  EyebrowIcon: TrendingUp,
  accent: "cyan",
  heroLine1: "Your AI",
  heroHighlight: "fintech engine.",
  heroBlurb:
    "Air-gapped execution. Trust levels for regulated outputs. Fiduciary data never leaves your infrastructure.",
  capabilitiesHeadline: "Automate the compliance. Focus on the client.",
  capabilitiesBlurb:
    "Every task that pulls advisors away from client relationships — automated, verified, and audit-logged.",
  capabilities: [
    {
      icon: Scale,
      title: "Compliance monitoring",
      desc: "Scan regulations in real time, cross-reference your portfolio against evolving rules, and flag violations before they become fines. What took a compliance team days now runs continuously.",
    },
    {
      icon: ShieldAlert,
      title: "Fraud detection",
      desc: "Pattern analysis across millions of transactions. Agents surface anomalies, cluster suspicious behavior, and escalate high-confidence alerts — faster than any manual review queue.",
    },
    {
      icon: MessageCircle,
      title: "Customer communication",
      desc: "Personalized financial advice drafted from client history, risk profile, and market conditions. Every message is compliant, on-brand, and ready for advisor review.",
    },
    {
      icon: TrendingUp,
      title: "Portfolio analysis",
      desc: "Combine live market data with client objectives to generate allocation recommendations, rebalancing alerts, and performance summaries — all verified by a second model before delivery.",
    },
  ],
  workflowsHeadline: "Give the command. Get the outcome.",
  workflows: [
    {
      trigger: '"Monitor our portfolio for compliance violations"',
      steps: [
        "Agent ingests current portfolio holdings and latest regulatory filings",
        "Cross-references positions against jurisdiction-specific rules and exposure limits",
        "Flags three holdings that breach updated concentration thresholds",
        "Generates a remediation report with suggested trades and filing deadlines",
      ],
      result:
        "3 violations caught 48 hours before the regulatory deadline. Zero manual review.",
    },
    {
      trigger: '"Analyze transaction patterns for fraud signals"',
      steps: [
        "Pulls 90 days of transaction data across all accounts",
        "Clusters transactions by velocity, geography, and counterparty behavior",
        "Identifies 12 accounts with anomalous patterns matching known fraud typologies",
        "Escalates high-confidence cases with evidence packets for the investigations team",
      ],
      result:
        "12 suspicious accounts flagged in under 4 minutes. $2.1M in potential losses intercepted.",
    },
    {
      trigger: '"Draft personalized quarterly client reports"',
      steps: [
        "Retrieves each client's portfolio performance, transactions, and stated goals",
        "Generates a plain-language summary with YTD returns, benchmark comparison, and outlook",
        "Tailors tone and detail level based on client's communication preferences",
        "Queues 340 reports for advisor review with one-click approval",
      ],
      result:
        "340 personalized reports drafted in 8 minutes. Advisors approve and send same day.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across transaction histories and compliance documents",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — fiduciary data isolation per firm",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output passes through PII detection, content policy, and quality guardrails",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — fiduciary data never leaves your infrastructure",
    },
  ],
  ctaHeadline: "Less risk.",
  ctaHighlight: "More alpha.",
  ctaBlurb:
    "Your team shouldn't spend half their day on compliance spreadsheets. Deploy AI agents that handle the regulated work so your advisors can focus on clients.",
};

export default function ForFintechPage() {
  return <VerticalPageShell config={config} />;
}
