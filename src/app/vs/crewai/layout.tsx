import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs CrewAI — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 pre-built AI agents, hosted platform) vs CrewAI (open-source Python framework). Feature-by-feature comparison with honest strengths and weaknesses for both.",
  keywords: ["CrewAI alternative", "CrewAI vs hosted AI platform", "Sovereign Matrix vs CrewAI", "no-code AI agents", "CrewAI alternative no code", "AI agent platform vs framework"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/crewai" },
  openGraph: {
    title: "Sovereign Matrix vs CrewAI — Honest Comparison",
    description: "130 pre-built AI agents on a hosted platform vs an open-source Python framework. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/crewai",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
