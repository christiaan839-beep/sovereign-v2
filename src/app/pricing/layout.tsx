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
  description: "Autonomous AI agent platform with 130+ specialized agents and 39+ open-source models.",
  url: "https://sovereignmatrix.agency/pricing",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", description: "50 tasks/month, 3 agents, community support. No credit card.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/signup" },
    { "@type": "Offer", name: "Starter", price: "19", priceCurrency: "USD", description: "200 tasks/month, 10 agents, email support.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Growth", price: "49", priceCurrency: "USD", description: "500 tasks/month, 50 agents, priority support.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Node", price: "199", priceCurrency: "USD", description: "2,000 tasks/month, 130 agents, all features, priority support.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Enterprise", price: "499", priceCurrency: "USD", description: "10,000 tasks/month, full white-label, custom domains, SLA.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/enterprise" },
  ],
  // No aggregate rating until real reviews exist
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(pricingJsonLd)}</script>
      {children}
    </>
  );
}
