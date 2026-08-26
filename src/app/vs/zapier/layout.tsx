import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Zapier — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (140 AI agents, $199/mo unlimited) vs Zapier (workflow automation, $49/mo limited tasks). Agents that think vs automations that follow rules.",
  keywords: ["Zapier alternative", "Zapier vs AI agents", "Sovereign Matrix vs Zapier", "AI automation platform", "Zapier alternative with AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/zapier" },
  openGraph: {
    title: "Sovereign Matrix vs Zapier — Honest Comparison",
    description: "Zapier connects apps. Sovereign agents think, plan, and execute. See the full comparison.",
    url: "https://sovereignmatrix.agency/vs/zapier",
    type: "website",
  },
};

const comparisonSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sovereign Matrix vs Zapier — Honest Comparison",
  description: "Feature-by-feature comparison of Sovereign Matrix ($199/mo) vs Zapier ($49/mo).",
  url: "https://sovereignmatrix.agency/vs/zapier",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      { "@type": "SoftwareApplication", name: "Sovereign Matrix", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "199", priceCurrency: "USD" } },
      { "@type": "SoftwareApplication", name: "Zapier", applicationCategory: "BusinessApplication", offers: { "@type": "Offer", price: "49", priceCurrency: "USD" } },
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
