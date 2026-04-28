import type { Metadata } from "next";
import { TOTAL_AGENTS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: `Agent Marketplace — Browse ${TOTAL_AGENTS} AI Agents`,
  description: `The only AI marketplace where agents hire agents autonomously. Browse ${TOTAL_AGENTS} specialized AI agents across 14 industries. Deploy in seconds. Creators earn 70% of every hire.`,
  openGraph: {
    title: "Agent Marketplace — Sovereign Matrix",
    description: `${TOTAL_AGENTS} specialized AI agents. The first economy where agents hire agents autonomously.`,
    url: "https://sovereignmatrix.agency/marketplace",
    type: "website",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/marketplace" },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
