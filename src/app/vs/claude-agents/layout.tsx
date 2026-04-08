import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Claude Managed Agents — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (129 pre-built agents, 39+ models, $199/mo) vs Claude Managed Agents (pay-per-use). Multi-model agent platform vs single-model hosted agents.",
  keywords: ["Claude Managed Agents alternative", "Anthropic agents vs Sovereign", "multi-model agent platform", "Claude agents alternative", "model-agnostic AI agents"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/claude-agents" },
  openGraph: {
    title: "Sovereign Matrix vs Claude Managed Agents — Honest Comparison",
    description: "129 pre-built agents with 39+ models at $199/mo vs Claude Managed Agents pay-per-use. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/claude-agents",
    type: "website",
  },
};

const comparisonSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sovereign Matrix vs Claude Managed Agents — Honest Comparison",
  description: "Feature-by-feature comparison of Sovereign Matrix ($199/mo flat) vs Claude Managed Agents (pay-per-use).",
  url: "https://sovereignmatrix.agency/vs/claude-agents",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      { "@type": "SoftwareApplication", name: "Sovereign Matrix", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "199", priceCurrency: "USD" } },
      { "@type": "SoftwareApplication", name: "Claude Managed Agents", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Pay-per-use" } },
    ],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(comparisonSchema)}</script>
      {children}
    </>
  );
}
