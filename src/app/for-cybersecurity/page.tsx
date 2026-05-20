"use client";

import {
  Scan,
  Radar,
  ClipboardCheck,
  ShieldAlert,
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
  slug: "cybersecurity",
  label: "Cybersecurity",
  EyebrowIcon: ShieldAlert,
  accent: "red",
  heroLine1: "AI agents for",
  heroHighlight: "cybersecurity.",
  heroBlurb:
    "Continuous vulnerability scanning. Real-time threat detection. Automated compliance. Your SOC team, 24/7.",
  capabilitiesHeadline: "Find threats before they find you.",
  capabilitiesBlurb:
    "Continuous monitoring across your entire stack. Agents detect anomalies, classify threats, and trigger containment — at machine speed, not human speed.",
  capabilities: [
    {
      icon: Scan,
      title: "Vulnerability scanning",
      desc: "Agents crawl your codebase, infrastructure, and dependencies for known CVEs, misconfigurations, and zero-day patterns. Continuous scanning, not quarterly audits. Built for the era when AI can find zero-days autonomously.",
    },
    {
      icon: Radar,
      title: "Threat detection & response",
      desc: "Real-time monitoring across your API endpoints, network traffic, and authentication logs. Agents detect anomalous patterns, classify threat severity, and trigger automated containment — before the SOC analyst finishes their coffee.",
    },
    {
      icon: ClipboardCheck,
      title: "Security audit automation",
      desc: "Generate SOC 2, ISO 27001, and PCI-DSS compliance artifacts automatically. Agents map your controls to framework requirements, identify gaps, and draft remediation plans with evidence collection.",
    },
    {
      icon: ShieldAlert,
      title: "Compliance monitoring",
      desc: "Continuous compliance posture monitoring across your entire stack. Policy drift detection, access review automation, and real-time alerting when configurations deviate from your security baseline.",
    },
  ],
  workflowsHeadline: "Say what you need. Watch it happen.",
  workflows: [
    {
      trigger: '"Scan our codebase for known vulnerability patterns"',
      steps: [
        "Agent ingests your repository, dependency manifests, and infrastructure-as-code",
        "Cross-references every dependency against CVE feeds and zero-day signatures",
        "Classifies findings by exploitability, blast radius, and remediation difficulty",
        "Generates a prioritized remediation queue with PR-ready patches where possible",
      ],
      result:
        "47 findings ranked by severity, 12 PR-ready patches generated, full audit trail signed.",
    },
    {
      trigger: '"Investigate this 4 AM authentication spike"',
      steps: [
        "Pulls auth logs from the affected window plus 60 minutes before and after",
        "Correlates with your network flow data, geo-IP, and known threat indicators",
        "Classifies the spike: credential-stuffing, account-takeover, or legitimate burst",
        "Drafts an incident report with timeline, attribution, and recommended containment",
      ],
      result:
        "Confirmed credential-stuffing attempt from 240 IPs. Containment proposed in 4 minutes.",
    },
    {
      trigger: '"Generate our SOC 2 Type II evidence package for last quarter"',
      steps: [
        "Maps your in-scope controls to the AICPA TSP framework requirements",
        "Pulls evidence from your CI/CD, ticketing, IAM, and infrastructure stacks",
        "Identifies gaps in evidence collection and drafts the SOC 2 narrative",
        "Produces an auditor-ready bundle with cryptographic signatures on every artifact",
      ],
      result:
        "92 controls evidenced, 4 gaps surfaced with remediation plans, bundle signed and shipped.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across CVE feeds, logs, and historical incidents",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — per-engagement isolation",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output verified, signed, and audit-grade for compliance use",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — sensitive log data never leaves your perimeter",
    },
  ],
  ctaHeadline: "Stop reacting to breaches.",
  ctaHighlight: "Start preventing them.",
  ctaBlurb:
    "Every commit scanned. Every anomaly investigated. Every control evidenced. Your AI security team works while your SOC sleeps.",
};

export default function ForCybersecurityPage() {
  return <VerticalPageShell config={config} />;
}
