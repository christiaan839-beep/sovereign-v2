import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Sovereign Matrix",
  description:
    "Three plans. Free (50 verified runs/mo). Pro $49/mo (Ed25519 signatures, Merkle inclusion proofs, audit-bundle export). Team $199/mo (white-label, OpenTimestamps notarization, SOC2-ready evidence). Cancel anytime.",
  keywords: [
    "AI platform pricing",
    "Sovereign Matrix pricing",
    "verifiable AI receipts",
    "HMAC-signed AI outputs",
    "audit-grade AI",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/pricing" },
  openGraph: {
    title: "Pricing — Sovereign Matrix",
    description:
      "Free / Pro $49 / Team $199. Verified agent receipts on every plan. Audit-grade infrastructure for AI in regulated industries.",
    url: "https://sovereignmatrix.agency/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Sovereign Matrix",
    description:
      "Free / Pro $49 / Team $199. Verified agent receipts on every plan.",
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
  description:
    "Audit-grade AI infrastructure — HMAC-signed receipts, Ed25519 v2 signatures, Merkle inclusion proofs, OpenTimestamps notarization.",
  url: "https://sovereignmatrix.agency/pricing",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description:
        "50 verified runs/month. All 137 agents. HMAC-signed receipts. Public verifier API. No credit card.",
      availability: "https://schema.org/InStock",
      url: "https://sovereignmatrix.agency/signup",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "49",
      priceCurrency: "USD",
      description:
        "500 verified runs/month. Ed25519 v2 signatures. Merkle inclusion proofs. Audit-bundle export. Priority support.",
      availability: "https://schema.org/InStock",
      url: "https://sovereignmatrix.agency/pricing",
    },
    {
      "@type": "Offer",
      name: "Team",
      price: "199",
      priceCurrency: "USD",
      description:
        "2,000 verified runs/month. White-label badge. Bitcoin notarization via OpenTimestamps. SOC2-ready evidence export.",
      availability: "https://schema.org/InStock",
      url: "https://sovereignmatrix.agency/pricing",
    },
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
        text: "Sovereign Matrix is audit-grade AI infrastructure. Every agent run produces a cryptographically signed receipt that anyone can verify against our public /api/verify endpoint — no signup, no API key. Designed for AI deployments in regulated industries where compliance teams need to prove what an agent did.",
      },
    },
    {
      "@type": "Question",
      name: "What is a verifiable agent receipt?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An HMAC-SHA256-signed projection of the agent's run — inputs, outputs, model used, safety pipeline results, and timestamp. Tamper one byte and the signature breaks. On Pro and above, receipts can be Ed25519-signed for non-repudiation and bundled into Merkle inclusion proofs. On Team, they can be notarized to Bitcoin via OpenTimestamps.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. All paid plans are month-to-month with no long-term commitment. Cancel from your dashboard anytime. The Free plan never expires.",
      },
    },
    {
      "@type": "Question",
      name: "What's included in the Free plan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Full platform access. All 137 agents. All 25 playbooks. 50 verified agent runs per month. HMAC-signed receipts. Public verifier API. No credit card required. Designed so anyone can prove the platform works before paying.",
      },
    },
  ],
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(pricingJsonLd)}
      </script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      {children}
    </>
  );
}
