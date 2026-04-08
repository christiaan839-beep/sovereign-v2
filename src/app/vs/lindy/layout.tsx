import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Lindy — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo) vs Lindy AI ($49.99–$59.99/mo). Feature-by-feature comparison with honest strengths and weaknesses for both platforms.",
  keywords: ["Lindy alternative", "Lindy AI vs Sovereign Matrix", "AI assistant comparison", "Lindy vs AI agents", "AI business automation platform"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/lindy" },
  openGraph: {
    title: "Sovereign Matrix vs Lindy — Honest Comparison",
    description: "130 AI agents at $199/mo vs Lindy AI at $49.99–$59.99/mo. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/lindy",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
