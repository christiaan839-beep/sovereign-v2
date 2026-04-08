import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Manus AI — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 specialized AI agents, $199/mo flat) vs Manus AI (usage-based computer-use agent, acquired by Meta). Feature-by-feature comparison with honest strengths and weaknesses.",
  keywords: ["Manus AI alternative", "Manus vs AI agents", "Sovereign Matrix vs Manus", "AI agent platform", "computer-use agent alternative"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/manus" },
  openGraph: {
    title: "Sovereign Matrix vs Manus AI — Honest Comparison",
    description: "130 specialized AI agents at $199/mo flat vs Manus AI usage-based pricing. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/manus",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
