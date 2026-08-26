import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Relevance AI — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (140 pre-built AI agents, $199/mo transparent) vs Relevance AI (enterprise AI Workforce platform, custom pricing). Feature-by-feature comparison with honest strengths and weaknesses.",
  keywords: ["Relevance AI alternative", "Relevance AI vs AI agents", "Sovereign Matrix vs Relevance AI", "AI GTM platform", "AI workforce alternative"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/relevance-ai" },
  openGraph: {
    title: "Sovereign Matrix vs Relevance AI — Honest Comparison",
    description: "140 pre-built AI agents at $199/mo vs Relevance AI custom enterprise pricing. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/relevance-ai",
    type: "website",
  },
};

const comparisonSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sovereign Matrix vs Relevance AI — Honest Comparison",
  description: "Feature-by-feature comparison of Sovereign Matrix ($199/mo) vs Relevance AI (custom pricing).",
  url: "https://sovereignmatrix.agency/vs/relevance-ai",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      { "@type": "SoftwareApplication", name: "Sovereign Matrix", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "199", priceCurrency: "USD" } },
      { "@type": "SoftwareApplication", name: "Relevance AI", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
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
