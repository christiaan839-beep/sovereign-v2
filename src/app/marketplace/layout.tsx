import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Marketplace — Sovereign Matrix",
  description:
    "Browse and install community-built AI agents. Sales, content, SEO, intelligence, voice, code — all pre-built, one click to deploy.",
  alternates: { canonical: "https://sovereignmatrix.agency/marketplace" },
  openGraph: {
    title: "Agent Marketplace — Sovereign Matrix",
    description: "Community-built AI agents. One click to install. Sovereign Matrix.",
    url: "https://sovereignmatrix.agency/marketplace",
    type: "website",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
