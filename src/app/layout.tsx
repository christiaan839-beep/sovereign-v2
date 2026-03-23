import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { validateEnvironment } from "@/lib/env-check";
import "./globals.css";

// Run environment validation on server startup
validateEnvironment();

export const metadata: Metadata = {
  metadataBase: new URL("https://sovereignmatrix.agency"),
  title: "Sovereign OS | The Ultimate Open-Source Agentic Platform",
  description: "The premier enterprise alternative to CrewAI, AutoGen, and LangGraph. Deploy 80+ autonomous AI agents via the Sovereign Vector Matrix with $0 inference costs using NVIDIA NIM. Replace your agency.",
  keywords: ["CrewAI alternative", "AutoGen UI", "LangGraph enterprise", "OpenAI Swarm alternative", "AI agent OS", "autonomous marketing", "NVIDIA NIM agents", "open-source agentic AI", "sovereign matrix"],
  authors: [{ name: "Sovereign Matrix - Edge" }],
  openGraph: {
    title: "Sovereign OS | The Ultimate Open-Source Agentic Platform",
    description: "The enterprise alternative to CrewAI, AutoGen, and OpenAI Swarm. Deploy 80+ autonomous AI agents powered by NVIDIA NIM without vendor lock-in.",
    type: "website",
    siteName: "Sovereign OS",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Sovereign OS — Enterprise Agent Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign OS | The Ultimate Open-Source Agentic Platform",
    description: "The #1 Enterprise Alternative to CrewAI and AutoGen. Deploy 80+ autonomous agents with zero API costs.",
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
        <script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        
        {/* Enterprise JSON-LD SEO Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Sovereign OS",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "299.00",
                "priceCurrency": "USD"
              },
              "description": "The premier enterprise alternative to CrewAI, AutoGen, and LangGraph. Deploy 80+ autonomous AI agents via the Sovereign Vector Matrix with $0 inference costs using NVIDIA NIM."
            })
          }}
        />
      </head>
      <ClerkProvider>
        <body className="bg-midnight text-white antialiased">
          {children}
          <Analytics />
          <SpeedInsights />
        </body>
      </ClerkProvider>
    </html>
  );
}
