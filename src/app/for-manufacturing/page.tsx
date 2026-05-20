"use client";

import {
  Factory,
  Wrench,
  AlertTriangle,
  CheckSquare,
  FileSpreadsheet,
  Database,
  Layers,
  Shield,
  Zap,
} from "lucide-react";
import {
  VerticalPageShell,
  type VerticalConfig,
} from "@/components/landing/VerticalPageShell";

const config: VerticalConfig = {
  slug: "manufacturing",
  label: "Manufacturing",
  EyebrowIcon: Factory,
  accent: "amber",
  heroLine1: "AI agents for manufacturing",
  heroHighlight: "& supply chain.",
  heroBlurb:
    "Predictive maintenance. Disruption detection. Quality control. From floor sensor to board report — without the manual data pulls.",
  capabilitiesHeadline: "From floor sensors to board reports.",
  capabilitiesBlurb:
    "Every signal from the production line, every supplier risk indicator, every quality metric — synthesized into decisions before they become incidents.",
  capabilities: [
    {
      icon: Wrench,
      title: "Predictive maintenance",
      desc: "Agents ingest vibration, temperature, and run-hour data from every machine on the floor. They surface failure probability scores days before breakdown — so you schedule maintenance on your terms, not the machine's.",
    },
    {
      icon: AlertTriangle,
      title: "Supply chain disruption detection & rerouting",
      desc: "Real-time monitoring of supplier financial health, geopolitical risk, weather events, and port delays. When disruption probability exceeds threshold, agents surface alternative suppliers and draft rerouting orders automatically.",
    },
    {
      icon: CheckSquare,
      title: "Quality control & defect detection",
      desc: "Computer-vision agents analyze production line imagery against spec tolerances in real time. Defects are flagged to the line supervisor before they compound — not discovered by the customer.",
    },
    {
      icon: FileSpreadsheet,
      title: "Vendor management & RFQ automation",
      desc: "Agents draft RFQs, compare bids against historical pricing, flag anomalies, and generate vendor scorecards. What took your procurement team three days now takes three minutes.",
    },
  ],
  workflowsHeadline: "Give the command. Get the outcome.",
  workflows: [
    {
      trigger: '"Run predictive maintenance analysis on press line 4"',
      steps: [
        "Pulls 90 days of vibration, temperature, and cycle-count telemetry for press line 4",
        "Runs anomaly detection against the manufacturer baseline and your historical failure patterns",
        "Identifies bearing wear signature in main drive motor — 94% probability of failure within 11 days",
        "Drafts maintenance work order with part numbers, estimated downtime window, and technician hours",
      ],
      result:
        "Unplanned downtime avoided. Maintenance scheduled for next Friday during a planned shift gap — not mid-production.",
    },
    {
      trigger: '"Score our top 20 suppliers for Q3 risk exposure"',
      steps: [
        "Pulls latest financial filings, news sentiment, and logistics delay data for all 20 suppliers",
        "Cross-references each supplier against geopolitical risk indices for their origin countries",
        "Calculates a composite risk score across 8 dimensions: financial, geographic, delivery, quality, concentration",
        "Generates a ranked risk report with recommended buffer stock levels and backup supplier options",
      ],
      result:
        "2 critical-risk suppliers identified. Buffer stock recommendations issued before any disruption lands.",
    },
    {
      trigger:
        '"Generate quality report for the Tier 1 auto client audit next week"',
      steps: [
        "Pulls defect logs, inspection records, and corrective action history for the past 90 days",
        "Calculates DPMO, Cpk, and first-pass yield rates broken down by product line and shift",
        "Maps defect trends against process change events to identify root cause correlations",
        "Assembles a client-ready quality report with executive summary, trend charts, and corrective action status",
      ],
      result:
        "Audit package ready in 8 minutes. Zero manual data pulls from three separate systems.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Vector Memory",
      desc: "Semantic search across maintenance logs, supplier records, and quality histories",
    },
    {
      icon: Layers,
      label: "Tenant Isolation",
      desc: "Plant data is scoped per facility — your production IP stays within your walls",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every alert passes anomaly detection, quality, and content guardrails before delivery",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — sensor data and IP never leave your on-premise infrastructure",
    },
  ],
  ctaHeadline: "Less downtime.",
  ctaHighlight: "More throughput.",
  ctaBlurb:
    "Your engineers shouldn't be chasing paper trails across disconnected systems. Deploy AI agents that read every sensor, every supplier signal, every defect log — and turn it into the next decision.",
};

export default function ForManufacturingPage() {
  return <VerticalPageShell config={config} />;
}
