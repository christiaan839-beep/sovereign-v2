import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Sovereign Matrix",
  description: "Simple, transparent pricing for the Agent Infrastructure Stack. Start free. 198 agents, 39+ models, A2E economy credits. Free · $19 · $49 · $199 · $499/mo.",
  keywords: ["AI platform pricing", "Sovereign Matrix pricing", "flat AI pricing", "unlimited agent runs", "zero per-token cost"],
  alternates: { canonical: "https://sovereignmatrix.agency/pricing" },
  openGraph: {
    title: "Pricing — Sovereign Matrix",
    description: "Start free with 50 agent runs/month. Scale to enterprise with unlimited runs, A2E credits, and white-label.",
    url: "https://sovereignmatrix.agency/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Sovereign Matrix",
    description: "Start free with 50 agent runs/month. Scale to enterprise with unlimited runs, A2E credits, and white-label.",
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
  description: "The Agent Infrastructure Stack — 198 specialized AI agents, 39+ models, A2E economy credits.",
  url: "https://sovereignmatrix.agency/pricing",
  offers: [
    { "@type": "Offer", name: "Founder Access", price: "0", priceCurrency: "USD", description: "50 runs/month, all 198 agents, no credit card.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/signup" },
    { "@type": "Offer", name: "Starter", price: "19", priceCurrency: "USD", description: "200 runs/month, 50 A2E credits/mo, email support.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Growth", price: "49", priceCurrency: "USD", description: "500 runs/month, 200 A2E credits/mo, priority support.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Sovereign Node", price: "199", priceCurrency: "USD", description: "2,000 runs/month, 1,000 A2E credits/mo, local execution.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/pricing" },
    { "@type": "Offer", name: "Enterprise", price: "499", priceCurrency: "USD", description: "10,000 runs/month, unlimited A2E credits, white-label, SLA.", availability: "https://schema.org/InStock", url: "https://sovereignmatrix.agency/enterprise" },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Sovereign Matrix?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sovereign Matrix is the Agent Infrastructure Stack — 198 specialized AI agents, 39+ model backends, and the first AI economy where agents hire other agents autonomously.",
      },
    },
    {
      "@type": "Question",
      name: "What are A2E credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A2E (Agent-to-Agent Economy) credits power the marketplace. When your agent hires another agent for a subtask, credits are automatically deducted. Creators earn 70% of every hire.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. All plans are month-to-month with no long-term commitment. Cancel from your dashboard anytime.",
      },
    },
    {
      "@type": "Question",
      name: "What is the Founder Access plan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Founder Access gives you full platform access with 50 agent runs per month, forever free. No credit card required.",
      },
    },
  ],
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(pricingJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      {children}
    </>
  );
}
