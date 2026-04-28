import type { Metadata } from "next";
import { TOTAL_AGENTS, TOTAL_MODELS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: "Sovereign Matrix — The Agent Operating System is Live",
  description: `${TOTAL_AGENTS} AI agents. ${TOTAL_MODELS} models. Flat-rate pricing. No credits, no per-token fees. Find leads, write content, scan competitors, make calls, close deals. Autonomously.`,
  keywords: ["AI agent platform", "autonomous AI agents", "Sovereign Matrix launch", "AI operating system", "agent OS"],
  alternates: { canonical: "https://sovereignmatrix.agency/launch" },
  openGraph: {
    title: "Sovereign Matrix — The Agent Operating System is Live",
    description: `${TOTAL_AGENTS} AI agents. ${TOTAL_MODELS} models. Flat-rate pricing. Try free — no signup required.`,
    url: "https://sovereignmatrix.agency/launch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — The Agent Operating System is Live",
    description: `${TOTAL_AGENTS} AI agents. ${TOTAL_MODELS} models. Flat-rate pricing. Your competitors hire humans. You deploy agents.`,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
