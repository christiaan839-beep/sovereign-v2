import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { validateEnvironment } from "@/lib/env-check";
import { SafeClerkProvider } from "@/components/ui/SafeClerkProvider";
import "./globals.css";

// Run environment validation on server startup
validateEnvironment();

export const metadata: Metadata = {
  metadataBase: new URL("https://sovereignmatrix.agency"),
  title: "Sovereign Matrix — Autonomous AI Agent Platform",
  description: "Deploy 132 AI agents across 51+ open-source models. Find leads, write content, build pages, make calls, close deals. Zero per-token cost via NVIDIA NIM.",
  keywords: ["AI agents", "autonomous AI", "agency automation", "NVIDIA NIM", "NemoClaw", "lead generation", "content automation", "AI platform", "open-source AI", "white-label AI"],
  authors: [{ name: "Sovereign Matrix" }],
  openGraph: {
    title: "Sovereign Matrix — The Agents Are Live",
    description: "132 autonomous AI agents. 51+ open-source models. $0 per-token cost. White-label ready. The future of agency work.",
    type: "website",
    siteName: "Sovereign Matrix",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Sovereign Matrix — Autonomous AI Agent Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — The Agents Are Live",
    description: "132 autonomous AI agents. 51+ open-source models. $0 per-token cost. White-label ready. The future of agency work.",
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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace("http://", "") || "sovereignmatrix.agency";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
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
          {children}
          {process.env.NODE_ENV === "production" && <Analytics />}
          {process.env.NODE_ENV === "production" && <SpeedInsights />}
          <Script
            id="json-ld"
            type="application/ld+json"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                name: "Sovereign Matrix",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                offers: { "@type": "Offer", price: "0", priceCurrency: "ZAR" },
                description: "Autonomous AI agent platform. 132 agents, 51+ open-source models, zero per-token cost. Built on NVIDIA NIM and NemoClaw.",
              }),
            }}
          />
        </body>
      </SafeClerkProvider>
    </html>
  );
}
