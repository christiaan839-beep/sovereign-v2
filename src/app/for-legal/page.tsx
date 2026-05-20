"use client";

import {
  Scale,
  FileSearch,
  ShieldCheck,
  BookOpen,
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
  slug: "legal",
  label: "Legal",
  EyebrowIcon: Scale,
  accent: "violet",
  heroLine1: "AI agents for",
  heroHighlight: "legal.",
  heroBlurb:
    "Contract review in seconds. Due diligence at scale. Air-gapped execution for confidential work.",
  capabilitiesHeadline: "Billable hours on what matters.",
  capabilitiesBlurb:
    "Let agents handle the document review, research, and compliance checks. Your team focuses on strategy and client counsel.",
  capabilities: [
    {
      icon: FileSearch,
      title: "Contract analysis & review",
      desc: "Upload any contract and get a clause-by-clause breakdown in seconds. Non-standard terms flagged, risk scored, and compared against your playbook. What took a junior associate 4 hours takes 30 seconds.",
    },
    {
      icon: Scale,
      title: "Due diligence automation",
      desc: "Feed in a target company and the agent pulls public filings, cross-references litigation history, identifies red flags, and generates a structured diligence memo. Weeks of work compressed into hours.",
    },
    {
      icon: ShieldCheck,
      title: "Compliance scanning",
      desc: "Check your documents, terms, and policies against GDPR, CCPA, SOX, or any regulatory framework. Agents flag gaps, suggest language, and track remediation status across your entire compliance surface.",
    },
    {
      icon: BookOpen,
      title: "Legal research",
      desc: "Natural language queries across case law, statutes, and regulatory guidance. The agent finds relevant precedents, summarizes holdings, and cites sources — no Boolean search strings required.",
    },
  ],
  workflowsHeadline: "Describe the task. Get the deliverable.",
  workflows: [
    {
      trigger: '"Review this 50-page NDA and flag non-standard clauses"',
      steps: [
        "Agent ingests the full NDA and segments it by clause type",
        "Compares each clause against your firm's standard NDA playbook",
        "Flags 7 non-standard provisions with risk ratings (high/medium/low)",
        "Generates a redline with suggested alternative language for each flag",
      ],
      result:
        "Full NDA review with annotated redlines delivered in 45 seconds.",
    },
    {
      trigger: '"Run due diligence on Acme Corp acquisition target"',
      steps: [
        "Pulls corporate filings, SEC documents, and public records for Acme Corp",
        "Scans litigation databases for pending and historical cases",
        "Identifies key contracts, IP holdings, and regulatory obligations",
        "Generates a structured diligence memo with risk matrix and recommendations",
      ],
      result:
        "A 30-page diligence report that would have taken a team 2 weeks, ready in an afternoon.",
    },
    {
      trigger: '"Check our terms against GDPR requirements"',
      steps: [
        "Parses your current Terms of Service and Privacy Policy",
        "Maps each section against GDPR Articles 6-22 data subject rights",
        "Identifies 4 gaps in consent language and 2 missing data processing disclosures",
        "Drafts compliant replacement clauses with legal citations",
      ],
      result:
        "GDPR gap analysis with ready-to-use compliant language. No outside counsel needed.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across contracts, case files, and precedents",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — client matter isolation",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output passes through PII scrubbing, privilege, and quality guardrails",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — confidential documents never leave your network",
    },
  ],
  ctaHeadline: "Stop reviewing manually.",
  ctaHighlight: "Start scaling your practice.",
  ctaBlurb:
    "Every contract reviewed builds your firm's institutional knowledge. Every precedent found makes the next search faster. Compounding legal intelligence.",
};

export default function ForLegalPage() {
  return <VerticalPageShell config={config} />;
}
