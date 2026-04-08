import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Comparison — Sovereign Matrix vs HubSpot, Clay, Zapier, Sintra, n8n",
  description:
    "Side-by-side pricing and feature comparison of Sovereign Matrix against HubSpot, Clay, Zapier, Sintra, and n8n. AI agents, models, safety, integrations, and more — every number in one table.",
  keywords: [
    "AI agent pricing comparison",
    "HubSpot vs Zapier vs Clay pricing",
    "best AI agent platform price",
    "Sovereign Matrix pricing",
    "AI agent platform comparison",
    "HubSpot alternative",
    "Clay alternative",
    "Zapier alternative",
    "Sintra AI pricing",
    "n8n pricing comparison",
  ],
  openGraph: {
    title: "Pricing Comparison — Sovereign Matrix vs HubSpot, Clay, Zapier, Sintra, n8n",
    description:
      "Every platform. One table. Your decision. Compare AI agents, models, safety pipelines, and pricing across 6 platforms.",
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
