import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Sintra — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo) vs Sintra X ($97/mo). Feature-by-feature comparison with honest strengths and weaknesses for both platforms.",
  keywords: ["Sintra alternative", "Sintra AI vs Sovereign Matrix", "AI employees comparison", "Sintra vs AI agents", "AI business automation"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/sintra" },
  openGraph: {
    title: "Sovereign Matrix vs Sintra — Honest Comparison",
    description: "130 AI agents at $199/mo vs Sintra X at $97/mo. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/sintra",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
