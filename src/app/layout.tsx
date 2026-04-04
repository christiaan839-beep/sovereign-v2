import type { Metadata } from "next";
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
import "./globals.css";

// Run environment validation on server startup
validateEnvironment();

export const revalidate = 3600; // Revalidate static pages every hour

export const metadata: Metadata = {
  metadataBase: new URL("https://sovereignmatrix.agency"),
  title: "Sovereign Matrix — Your AI Workforce",
  description: "130+ autonomous AI agents. 65+ open-source models. $0 per-token cost. Find leads, write content, build pages, make calls, close deals. Built on NVIDIA NIM.",
  keywords: ["AI agents", "autonomous AI", "agency automation", "NVIDIA NIM", "NemoClaw", "lead generation", "content automation", "AI platform", "open-source AI", "white-label AI", "AI agency", "agentic AI"],
  authors: [{ name: "Sovereign Matrix", url: "https://sovereignmatrix.agency" }],
  creator: "Sovereign Matrix",
  publisher: "Sovereign Matrix",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: {
    canonical: "https://sovereignmatrix.agency",
  },
  openGraph: {
    title: "Sovereign Matrix — Your AI Workforce",
    description: "130+ autonomous AI agents. 65+ open-source models. $0 per-token cost. White-label ready. Your competitors hire. You deploy.",
    type: "website",
    siteName: "Sovereign Matrix",
    locale: "en_US",
    url: "https://sovereignmatrix.agency",
    images: [{ url: "https://sovereignmatrix.agency/og-image.jpg", width: 1200, height: 630, alt: "Sovereign Matrix — Autonomous AI Agent Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — Your AI Workforce",
    description: "130+ autonomous AI agents. 65+ open-source models. $0 per-token cost. White-label ready. Your competitors hire. You deploy.",
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
    "theme-color": "#050505",
    "msapplication-TileColor": "#050505",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace("http://", "") || "sovereignmatrix.agency";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Preconnect to critical API endpoints */}
        <link rel="preconnect" href="https://integrate.api.nvidia.com" />
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" />
        <link rel="dns-prefetch" href="https://api.anthropic.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router layout.tsx applies fonts globally, not per-page */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
          <CustomCursor />
          <CursorGlow />
          <ScrollProgress />
          {children}
          <BackToTop />
          <CookieConsent />
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
                  offers: { "@type": "Offer", price: "0", priceCurrency: "ZAR" },
                  description: "Autonomous AI agent platform. 130+ agents, 65+ open-source models, zero per-token cost. Built on NVIDIA NIM and NemoClaw.",
                },
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "Sovereign Matrix",
                  url: "https://sovereignmatrix.agency",
                  logo: "https://sovereignmatrix.agency/og-image.jpg",
                  contactPoint: { "@type": "ContactPoint", email: "christiaan@sovereignmatrix.agency", contactType: "sales" },
                  sameAs: [],
                },
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: [
                    {
                      "@type": "Question",
                      name: "What is Sovereign Matrix?",
                      acceptedAnswer: { "@type": "Answer", text: "Sovereign Matrix is an autonomous AI agent platform with 130+ specialized agents that execute business tasks like lead generation, content creation, SEO, voice calls, and competitor analysis. Built on NVIDIA NIM with 65+ open-source models at zero per-token cost." },
                    },
                    {
                      "@type": "Question",
                      name: "How much does Sovereign Matrix cost?",
                      acceptedAnswer: { "@type": "Answer", text: "Sovereign Matrix offers a free tier with 3 agents and 50 tasks per month. Paid plans start at R9,997/mo (Sovereign Node), R24,997/mo (Sovereign Array with voice agents), and R49,997/mo (Enterprise License with white-label). Month-to-month, no contracts." },
                    },
                    {
                      "@type": "Question",
                      name: "Can I run Sovereign Matrix on my own hardware?",
                      acceptedAnswer: { "@type": "Answer", text: "Yes. NemoClaw OS allows complete local execution via Ollama. Download open-source AI models directly to your machine. Your data never leaves your hardware. Fully air-gapped for healthcare, legal, finance, and defense use cases." },
                    },
                    {
                      "@type": "Question",
                      name: "How is this different from ChatGPT or other AI tools?",
                      acceptedAnswer: { "@type": "Answer", text: "ChatGPT is a chatbot — you type, it responds. Sovereign Matrix deploys autonomous agents that plan, execute, and self-correct without human intervention. 130+ agents work simultaneously across lead gen, content, SEO, voice calls, and more." },
                    },
                    {
                      "@type": "Question",
                      name: "What is the white-label Enterprise license?",
                      acceptedAnswer: { "@type": "Answer", text: "The Enterprise license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. Clients think you built the technology. It is an agency-in-a-box franchise model." },
                    },
                    {
                      "@type": "Question",
                      name: "Is my data safe with Sovereign Matrix?",
                      acceptedAnswer: { "@type": "Answer", text: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose." },
                    },
                    {
                      "@type": "Question",
                      name: "How long does setup take?",
                      acceptedAnswer: { "@type": "Answer", text: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No technical setup required for the cloud version." },
                    },
                    {
                      "@type": "Question",
                      name: "What integrations does Sovereign Matrix support?",
                      acceptedAnswer: { "@type": "Answer", text: "Sovereign Matrix integrates with NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, Yoco, and PayStack. A public API is available for custom integrations." },
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
