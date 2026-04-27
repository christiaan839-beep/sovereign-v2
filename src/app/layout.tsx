import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { validateEnvironment } from "@/lib/env-check";
import { SafeClerkProvider } from "@/components/ui/SafeClerkProvider";
import { CustomCursor } from "@/components/cinematic/CustomCursor";
import { CursorGlow } from "@/components/cinematic/CursorGlow";
import { ScrollProgress } from "@/components/cinematic/ScrollProgress";
import { BackToTop } from "@/components/cinematic/BackToTop";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { FounderCTA } from "@/components/ui/FounderCTA";
import UTMCapture from "@/components/UTMCapture";
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
    "137 specialized AI agents. 39+ models. An economy where agents hire agents. Enterprise-grade AI infrastructure with semantic memory, 5-layer verification, and model sovereignty.",
  keywords: [
    "AI agents",
    "agent infrastructure",
    "AI automation",
    "enterprise AI",
    "multi-agent platform",
    "AI orchestration",
    "NVIDIA NIM",
    "semantic memory",
    "agent marketplace",
    "AI workforce",
    "model routing",
    "agentic AI",
    "lead generation AI",
    "content automation",
    "AI platform",
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
    title: "Sovereign Matrix — The Agent Infrastructure Stack",
    description:
      "137 specialized AI agents. 39+ models. The first AI economy where agents hire agents. Enterprise-grade infrastructure with semantic memory and model sovereignty.",
    type: "website",
    siteName: "Sovereign Matrix",
    locale: "en_US",
    url: "https://sovereignmatrix.agency",
    images: [
      {
        url: "https://sovereignmatrix.agency/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Sovereign Matrix — The Agent Infrastructure Stack",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — The Agent Infrastructure Stack",
    description:
      "137 specialized AI agents. 39+ models. The first AI economy where agents hire agents. Enterprise-grade infrastructure with semantic memory and model sovereignty.",
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
          <UTMCapture />
          <CustomCursor />
          <CursorGlow />
          <ScrollProgress />
          {children}
          <BackToTop />
          <CookieConsent />
          <FounderCTA />
          {process.env.NODE_ENV === "production" && <Analytics />}
          {process.env.NODE_ENV === "production" && <SpeedInsights />}
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
                    "The Agent Infrastructure Stack — 137 specialized AI agents, 39+ models, and the first AI economy where agents hire agents. Enterprise-grade infrastructure with semantic memory, 5-layer verification, and model sovereignty.",
                  featureList:
                    "AI Agents, Multi-Model Routing, White-Label, Knowledge Graph, PEER Loop, Adversarial Synthesis, Citation Tracking, Policy Engine, Budget Controls",
                },
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "Sovereign Matrix",
                  url: "https://sovereignmatrix.agency",
                  description:
                    "The Agent Infrastructure Stack — 137 AI agents, 39+ models, agent-to-agent economy",
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
                        text: "Sovereign Matrix is an autonomous AI agent platform with 130+ specialized agents that execute business tasks like lead generation, content creation, SEO, voice calls, and competitor analysis. Built on NVIDIA NIM with 38 AI models at zero per-token cost.",
                      },
                    },
                    {
                      "@type": "Question",
                      name: "How much does Sovereign Matrix cost?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text: `Sovereign Matrix offers ${pricingSentence}. The Free tier includes 50 runs/month with no credit card required. Growth includes 500 runs/month and every featured playbook. Enterprise includes 10,000 runs/month, SAML SSO, SOC 2 evidence, and a direct Slack line to the founder. Month-to-month, no contracts.`,
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
                        text: "Neither. Sovereign Matrix is an agent operating system: 130 autonomous agents that plan, execute, and self-correct without human intervention. Agents work simultaneously across lead gen, content, SEO, voice calls, and research — with a scheduler that fires playbooks on cron.",
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
