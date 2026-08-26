import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs CrewAI — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (140 pre-built AI agents, hosted platform) vs CrewAI (open-source Python framework). Feature-by-feature comparison with honest strengths and weaknesses for both.",
  keywords: ["CrewAI alternative", "CrewAI vs hosted AI platform", "Sovereign Matrix vs CrewAI", "no-code AI agents", "CrewAI alternative no code", "AI agent platform vs framework"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/crewai" },
  openGraph: {
    title: "Sovereign Matrix vs CrewAI — Honest Comparison",
    description: "140 pre-built AI agents on a hosted platform vs an open-source Python framework. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/crewai",
    type: "website",
  },
};

const comparisonSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sovereign Matrix vs CrewAI — Honest Comparison",
  description: "Feature-by-feature comparison of Sovereign Matrix ($199/mo) vs CrewAI (open-source).",
  url: "https://sovereignmatrix.agency/vs/crewai",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      { "@type": "SoftwareApplication", name: "Sovereign Matrix", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "199", priceCurrency: "USD" } },
      { "@type": "SoftwareApplication", name: "CrewAI", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
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
