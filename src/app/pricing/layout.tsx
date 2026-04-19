import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Sovereign Matrix",
  description: "One flat price. 130 autonomous agents, 38 models, unlimited runs at Node tier+. No per-token fees. No credits. Free plan, no credit card required.",
  keywords: ["AI platform pricing", "Sovereign Matrix pricing", "flat AI pricing", "unlimited agent runs", "zero per-token cost"],
  alternates: { canonical: "https://sovereignmatrix.agency/pricing" },
  openGraph: {
    title: "Pricing — Sovereign Matrix",
    description: "One flat price. 130 agents, 38 models, 25 playbooks. No per-token fees.",
    url: "https://sovereignmatrix.agency/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Sovereign Matrix",
    description: "One flat price. 130 agents, 38 models, 25 playbooks. No per-token fees.",
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
  description: "Autonomous AI agent platform with 130+ specialized agents and 38 open-source models.",
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
