"use client";

import {
  Sprout,
  TrendingUp,
  Bug,
  ShoppingCart,
  ClipboardList,
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
  slug: "agriculture",
  label: "Agriculture",
  EyebrowIcon: Sprout,
  accent: "emerald",
  heroLine1: "AI agents for agriculture",
  heroHighlight: "& precision farming.",
  heroBlurb:
    "Yield forecasting. Disease detection. Compliance documentation. Field-grade reliability with air-gapped execution for sensitive agronomic IP.",
  capabilitiesHeadline: "Intelligence across every acre.",
  capabilitiesBlurb:
    "Continuous monitoring of crops, supply chain, and regulation — turning raw field data into operational decisions before the season turns against you.",
  capabilities: [
    {
      icon: TrendingUp,
      title: "Crop intelligence & yield forecasting",
      desc: "Agents ingest satellite imagery, soil sensor data, and weather forecasts to predict yield weeks before harvest. Field-level recommendations adjust seed density, irrigation, and fertilizer in real time.",
    },
    {
      icon: Bug,
      title: "Pest and disease early warning",
      desc: "Computer-vision agents scan drone imagery for pest signatures and fungal patterns. Alerts fire before infestation spreads — days earlier than manual scouting, with GPS-precise treatment zones.",
    },
    {
      icon: ShoppingCart,
      title: "Supply chain & market price optimization",
      desc: "Agents monitor commodity futures, logistics costs, and buyer demand signals simultaneously. They surface optimal harvest windows and storage timing decisions so you sell at peak — not at whoever calls first.",
    },
    {
      icon: ClipboardList,
      title: "Regulatory compliance automation",
      desc: "Pesticide application logs, traceability records, and export certificates — all generated automatically from field activity. Audit-ready documentation with zero manual data entry.",
    },
  ],
  workflowsHeadline: "Give the command. Get the outcome.",
  workflows: [
    {
      trigger:
        '"Analyze field 7 and give me a planting recommendation for the east quadrant"',
      steps: [
        "Pulls soil composition, moisture levels, and historical yield data for field 7",
        "Cross-references 14-day weather forecast with optimal germination windows for the selected crop variety",
        "Calculates seed density recommendation per row based on soil nitrogen and pH variance",
        "Generates GPS-mapped planting prescription file compatible with variable-rate seeder",
      ],
      result:
        "Planting prescription ready in 90 seconds. Estimated 18% yield improvement over uniform seeding.",
    },
    {
      trigger: '"Flag any disease risk across the wheat portfolio this week"',
      steps: [
        "Retrieves latest drone imagery across all 14 wheat fields",
        "Runs computer-vision model trained on 40,000 annotated disease samples",
        "Detects early-stage rust signatures in 3 fields, flags GPS coordinates of affected zones",
        "Drafts fungicide application order with dosage, timing, and equipment settings",
      ],
      result:
        "3 intervention zones identified. Treatment dispatched 8 days before visible symptoms would appear.",
    },
    {
      trigger:
        '"Generate export documentation for the canola shipment to Rotterdam"',
      steps: [
        "Pulls pesticide application records, spray dates, and product registrations for the lot",
        "Cross-checks residue limits against EU MRL regulations for the destination market",
        "Assembles phytosanitary certificate, traceability report, and bill of lading draft",
        "Flags one product requiring additional EU notification — sends pre-alert to freight forwarder",
      ],
      result:
        "Complete export pack ready in 4 minutes. Compliance risk flagged before shipment — not at the port.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Vector Memory",
      desc: "Semantic search across years of field records, spray logs, and yield histories",
    },
    {
      icon: Layers,
      label: "Tenant Isolation",
      desc: "Farm data is scoped per operation — your competitors never see your soil data",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every recommendation passes compliance, PII, and quality guardrails before delivery",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode available — sensitive agronomic IP never leaves your infrastructure",
    },
  ],
  ctaHeadline: "Less guesswork.",
  ctaHighlight: "More yield.",
  ctaBlurb:
    "Your agronomists shouldn't be buried in spreadsheets. Deploy AI agents that read every field, every sensor, every market signal — and turn it into the next decision.",
};

export default function ForAgriculturePage() {
  return <VerticalPageShell config={config} />;
}
