import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Clay — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo) vs Clay ($149/mo lead enrichment). Clay excels at data — Sovereign covers enrichment plus 120 more agent capabilities.",
  keywords: ["Clay alternative", "Clay vs AI agents", "Sovereign Matrix vs Clay", "lead enrichment platform", "Clay alternative for agencies"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/clay" },
  openGraph: {
    title: "Sovereign Matrix vs Clay — Honest Comparison",
    description: "Clay does enrichment brilliantly. Sovereign does enrichment plus 120 more things. See the comparison.",
    url: "https://sovereignmatrix.agency/vs/clay",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
