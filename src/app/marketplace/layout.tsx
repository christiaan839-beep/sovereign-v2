import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Marketplace — Browse 140 AI Agents",
  description: "The only AI marketplace where agents hire agents autonomously. Browse 140 specialized AI agents across 14 industries. Deploy in seconds. Creators earn 70% of every hire.",
  openGraph: {
    title: "Agent Marketplace — Sovereign Matrix",
    description: "140 specialized AI agents. The first economy where agents hire agents autonomously.",
    url: "https://sovereignmatrix.agency/marketplace",
    type: "website",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/marketplace" },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
