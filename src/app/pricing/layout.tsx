import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Sovereign Matrix vs ChatGPT, Zapier, HubSpot",
  description: "Compare Sovereign Matrix against ChatGPT, Zapier, HubSpot, and Clay. See how 130+ autonomous agents and zero per-token cost stack up. Free plan, no credit card.",
  keywords: ["AI platform pricing", "Sovereign Matrix pricing", "AI agents comparison", "ChatGPT alternative pricing", "Zapier vs AI agents", "HubSpot alternative"],
  alternates: { canonical: "https://sovereignmatrix.agency/pricing" },
  openGraph: {
    title: "Pricing — Sovereign Matrix vs ChatGPT, Zapier, HubSpot",
    description: "130+ autonomous agents. $0 per token. Free plan. See the full comparison.",
    url: "https://sovereignmatrix.agency/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Sovereign Matrix vs ChatGPT, Zapier, HubSpot",
    description: "130+ autonomous agents. $0 per token. Free plan. See the full comparison.",
  },
};

// JSON-LD: Product with multiple Offer tiers for rich pricing snippets in search.
// Object is constructed from static literals — no user input, XSS-safe.
const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sovereign Matrix",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Linux, macOS, Windows",
  description: "Autonomous AI agent platform with 130+ specialized agents and 65+ open-source models.",
  url: "https://sovereignmatrix.agency/pricing",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "ZAR", description: "50 tasks/month, 3 agents, community support. No credit card.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/signup" },
    { "@type": "Offer", name: "Sovereign Node", price: "9997", priceCurrency: "ZAR", description: "2,000 tasks/month, 20 agents, priority support.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Sovereign Array", price: "24997", priceCurrency: "ZAR", description: "500 tasks/month, voice agents, advanced automations, dedicated success manager.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Enterprise License", price: "49997", priceCurrency: "ZAR", description: "10,000 tasks/month, full white-label, custom domains, SLA, dedicated infrastructure.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/enterprise" },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "47",
    bestRating: "5",
    worstRating: "1",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(pricingJsonLd)}</script>
      {children}
    </>
  );
}
