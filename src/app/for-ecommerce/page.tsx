"use client";

import {
  FileText,
  DollarSign,
  Megaphone,
  Star,
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
  slug: "ecommerce",
  label: "E-Commerce",
  EyebrowIcon: DollarSign,
  accent: "amber",
  heroLine1: "Your AI",
  heroHighlight: "commerce engine.",
  heroBlurb:
    "130 agents handle your entire catalog at once. Voice agents handle customer inquiries 24/7.",
  capabilitiesHeadline: "Automate the catalog. Focus on growth.",
  capabilitiesBlurb:
    "Every task that slows your merchandising team — automated, verified, and ready to publish.",
  capabilities: [
    {
      icon: FileText,
      title: "Product description generation",
      desc: "SEO-optimized, brand-voiced descriptions for every SKU in your catalog. Agents pull product specs, competitor positioning, and keyword data to write copy that ranks and converts.",
    },
    {
      icon: DollarSign,
      title: "Competitor price monitoring",
      desc: "Track thousands of SKUs across competitor storefronts in real time. Agents surface price changes, MAP violations, and margin opportunities before your competitors react.",
    },
    {
      icon: Megaphone,
      title: "Ad copy optimization",
      desc: "ROAS-driven creative generation. Agents analyze top-performing ads, test headline variants, and draft copy calibrated to your audience segments and campaign objectives.",
    },
    {
      icon: Star,
      title: "Customer review analysis",
      desc: "Sentiment analysis across every review channel. Agents extract actionable insights, cluster complaints by theme, and surface product issues before they become return spikes.",
    },
  ],
  workflowsHeadline: "Give the command. Get the outcome.",
  workflows: [
    {
      trigger: '"Write descriptions for 50 new products in our catalog"',
      steps: [
        "Agent ingests product specs, images, and category taxonomy from your catalog feed",
        "Pulls top-ranking competitor descriptions and target keywords for each SKU",
        "Generates SEO-optimized, brand-voiced copy tailored to each product's unique selling points",
        "Queues all 50 descriptions for review with one-click publish to your storefront",
      ],
      result:
        "50 product descriptions written in 6 minutes. Average keyword density +40% vs. old copy.",
    },
    {
      trigger: '"Monitor competitor pricing on our top 100 SKUs"',
      steps: [
        "Maps your top 100 SKUs to matching products across 8 competitor storefronts",
        "Pulls current pricing, stock status, and promotional flags for each match",
        "Flags 14 SKUs where competitors undercut your price by more than 10%",
        "Generates a repricing recommendation with projected margin impact per SKU",
      ],
      result:
        "14 pricing opportunities identified. Repricing recommendations ready in 3 minutes.",
    },
    {
      trigger:
        '"Analyze reviews from last quarter and identify top complaints"',
      steps: [
        "Aggregates 4,200 reviews from your storefront, Amazon, and social channels",
        "Runs sentiment analysis and clusters negative reviews by complaint theme",
        "Ranks top 5 complaint categories by frequency and revenue impact",
        "Drafts a product improvement brief with specific fixes for each issue",
      ],
      result:
        "Top 5 complaint themes identified from 4,200 reviews. Action brief delivered to product team.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across product catalogs and review data",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — catalog isolation per storefront",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output passes through brand voice, content policy, and quality guardrails",
    },
    {
      icon: Zap,
      label: "130 Agents",
      desc: "Full catalog processing — descriptions, pricing, reviews, and ads in parallel",
    },
  ],
  ctaHeadline: "Less manual work.",
  ctaHighlight: "More revenue.",
  ctaBlurb:
    "Your team shouldn't spend half their day writing product descriptions. Deploy AI agents that handle the catalog so your team can focus on growth.",
};

export default function ForEcommercePage() {
  return <VerticalPageShell config={config} />;
}
