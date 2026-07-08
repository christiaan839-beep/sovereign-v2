import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { validateEnvironment } from "@/lib/env-check";
import { SafeClerkProvider } from "@/components/ui/SafeClerkProvider";
import { CustomCursor } from "@/components/cinematic/CustomCursor";
import { CursorGlow } from "@/components/cinematic/CursorGlow";
import { ScrollProgress } from "@/components/cinematic/ScrollProgress";
import { BackToTop } from "@/components/cinematic/BackToTop";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { LiveActivityTicker } from "@/components/landing/LiveActivityTicker";
import { FounderCTA } from "@/components/ui/FounderCTA";
import { getMarketingPlans } from "@/lib/plans";
import "./globals.css";

// Run environment validation on server startup
validateEnvironment();

export const revalidate = 3600; // Revalidate static pages every hour

export const metadata: Metadata = {
  metadataBase: new URL("https://sovereignmatrix.agency"),
  title: {
    default: "Sovereign Matrix — The Agent Infrastructure Stack",
    template: "%s | Sovereign Matrix",
  },
  description:
    "Audit-grade AI agent infrastructure. Every agent run produces a cryptographically signed receipt — Ed25519, ML-DSA-65 (FIPS 204 post-quantum dual-sign), Merkle inclusion + consistency proofs, RFC 6962-style transparency log, OpenTimestamps Bitcoin anchoring. 140 agents, 8-provider unified router, 5-layer safety pipeline, ZAR-first billing for emerging markets. Apache-2.0 OSS verifier on npm.",
  keywords: [
    "verifiable AI agents",
    "AI agent audit standard",
    "Ed25519 AI receipts",
    "post-quantum AI signatures",
    "AI transparency log",
    "ML-DSA-65 dual-sign",
    "RFC 6962 AI receipts",
    "agent infrastructure",
    "audit-grade AI",
    "enterprise AI compliance",
    "multi-agent platform",
    "AI orchestration",
    "agent marketplace",
    "model routing",
    "agentic AI",
    "POPIA AI compliance",
    "SOC2 AI",
    "OpenTimestamps AI",
    "VAOS",
  ],
  authors: [
    { name: "Sovereign Matrix", url: "https://sovereignmatrix.agency" },
  ],
  creator: "Sovereign Matrix",
  publisher: "Sovereign Matrix",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: { canonical: "https://sovereignmatrix.agency" },
  openGraph: {
    title: "Sovereign Matrix — Audit-grade AI agent infrastructure",
    description:
      "Every AI agent run produces a cryptographically signed receipt. Ed25519, ML-DSA-65 (FIPS 204 post-quantum), Merkle inclusion + consistency proofs, RFC 6962-style transparency log, Bitcoin notarization. 140 agents, 5-layer safety pipeline, ZAR + USD billing. Apache-2.0 OSS verifier on npm.",
    type: "website",
    siteName: "Sovereign Matrix",
    locale: "en_US",
    url: "https://sovereignmatrix.agency",
    images: [
      {
        url: "https://sovereignmatrix.agency/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Sovereign Matrix — Audit-grade AI agent infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — Audit-grade AI agent infrastructure",
    description:
      "Ed25519 + post-quantum-ready AI agent receipts. 140 agents, transparency log, Bitcoin-anchored proofs. Apache-2.0 OSS verifier — install and check the math yourself. Built for AI in regulated industries.",
    images: ["https://sovereignmatrix.agency/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/icon.svg",
  },
  other: {
    "msapplication-TileColor": "#050505",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const plausibleDomain =
    process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace(
      "http://",
      "",
    ) || "sovereignmatrix.agency";

  // JSON-LD Offer entries derive from the single source of truth in
  // plans.ts so archived tiers never leak into SEO surfaces. A price
  // of "0" is correct for the Free tier (schema.org accepts it).
  const marketingOffers = getMarketingPlans().map((p) => ({
    "@type": "Offer" as const,
    name: p.name,
    price: String(Math.round(p.priceUsdCents / 100)),
    priceCurrency: "USD",
  }));

  // Resolved once so the FAQ answer matches the Offer list.
  const pricingSentence = getMarketingPlans()
    .map((p) =>
      p.priceUsdCents === 0
        ? `${p.name} at $0/mo`
        : `${p.name} at $${Math.round(p.priceUsdCents / 100)}/mo`,
    )
    .join(", ");

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* Preconnect to critical API endpoints */}
        <link rel="preconnect" href="https://integrate.api.nvidia.com" />
        <link
          rel="preconnect"
          href="https://generativelanguage.googleapis.com"
        />
        <link rel="dns-prefetch" href="https://api.anthropic.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router layout.tsx applies fonts globally, not per-page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Outfit:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Sovereign Matrix" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Service Worker registration */}
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }`}
        </Script>
        {/* Plausible Analytics — Privacy-friendly, GDPR compliant, no cookies */}
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <SafeClerkProvider>
        <body className="relative bg-midnight text-white antialiased">
          {/* Skip-to-content link — first tab stop for keyboard users (WCAG 2.4.1) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-lg focus:font-bold focus:shadow-2xl"
          >
            Skip to main content
          </a>
          <CustomCursor />
          <CursorGlow />
          <ScrollProgress />
          {children}
          <BackToTop />
          <CookieConsent />
          <LiveActivityTicker />
          <FounderCTA />
          <Script
            id="json-ld"
            type="application/ld+json"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "SoftwareApplication",
                  name: "Sovereign Matrix",
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "Web",
                  offers: marketingOffers,
                  description:
                    "Audit-grade AI agent infrastructure — 140 agents, every output cryptographically signed (Ed25519 v2, ML-DSA-65 v3 post-quantum dual-sign per FIPS 204, RFC 6962-style transparency log, Merkle inclusion + consistency proofs, OpenTimestamps Bitcoin anchoring), 8-provider unified router, 5-layer safety pipeline, ZAR + USD billing. Apache-2.0 OSS verifier on npm.",
                  featureList:
                    "Verifiable Agent Receipts (VAOS 1.0/2.0/3.0), Ed25519 v2 Signatures, ML-DSA-65 v3 Post-Quantum Dual-Sign (FIPS 204), RFC 6962-Style Transparency Log, Merkle Inclusion + Consistency Proofs, OpenTimestamps Bitcoin Notarization, Multi-Provider Routing, Whitelabel, 5-layer Safety Pipeline, Plan-Aware Quotas, Daily $-Cap Budget Controls, Multi-Tenant Isolation, ZAR Billing, Apache-2.0 OSS Verifier (@sovereign-matrix/verifiable-receipts)",
                },
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "Sovereign Matrix",
                  url: "https://sovereignmatrix.agency",
                  description:
                    "Audit-grade AI agent infrastructure — 140 agents with cryptographically signed receipts, 8-provider unified router, ZAR + USD billing.",
                  logo: "https://sovereignmatrix.agency/icon-512.png",
                  contactPoint: {
                    "@type": "ContactPoint",
                    email: "christiaan@sovereignmatrix.agency",
                    contactType: "sales",
                  },
                  sameAs: [],
                },
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: [
                    {
                      "@type": "Question",
                      name: "What is Sovereign Matrix?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "Sovereign Matrix is audit-grade AI agent infrastructure. 140 specialized agents handle lead generation, content creation, voice calls, competitor analysis, and more — and every run produces a cryptographically signed receipt (Ed25519 v2, ML-DSA-65 v3 post-quantum dual-sign per FIPS 204, RFC 6962-style transparency log, Merkle inclusion + consistency proofs, OpenTimestamps Bitcoin notarization). An Apache-2.0 OSS verifier on npm lets any auditor independently confirm the math without an account. Designed for AI deployments in regulated industries where compliance teams need to prove what an agent did.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "How much does Sovereign Matrix cost?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: `Sovereign Matrix offers ${pricingSentence}. Free includes 50 verified runs/month, no credit card. Pro at $49/month adds Ed25519 v2 signatures, Merkle inclusion proofs, and audit-bundle export. Team at $199/month adds white-label, Bitcoin notarization via OpenTimestamps, and SOC2-ready evidence export. Enterprise is custom — 10,000+ runs, SAML SSO, full evidence pack, dedicated account manager, and a private support channel with the engineering team. Month-to-month, no contracts.`,
                      },
                    },
                    {
                      "@type": "Question",
                      name: "Can I run Sovereign Matrix on my own hardware?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "Yes. NemoClaw OS allows complete local execution via Ollama. Download open-source AI models directly to your machine. Your data never leaves your hardware. Fully air-gapped for healthcare, legal, finance, and defense use cases.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "Is this a chatbot or a platform?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "Neither. Sovereign Matrix is an agent operating system: 140 autonomous agents that plan, execute, and self-correct without human intervention — and every output ships with a verifiable Ed25519-signed receipt (post-quantum-ready via ML-DSA-65). Agents work simultaneously across lead gen, content, SEO, voice calls, and research, with a scheduler that fires playbooks on cron.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "What is the white-label Enterprise license?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "The Enterprise license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. Clients think you built the technology. It is an agency-in-a-box franchise model.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "Is my data safe with Sovereign Matrix?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "How long does setup take?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No technical setup required for the cloud version.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "What integrations does Sovereign Matrix support?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: "Sovereign Matrix integrates with NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, Yoco, and PayStack. A public API is available for custom integrations.",
                      },
                    },
                  ],
                },
              ]),
            }}
          />
        </body>
      </SafeClerkProvider>
    </html>
  );
}
