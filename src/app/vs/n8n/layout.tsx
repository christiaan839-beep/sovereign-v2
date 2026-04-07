import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs n8n — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo) vs n8n Cloud ($20/mo). Feature-by-feature comparison: AI reasoning vs workflow automation, with honest strengths and weaknesses for both platforms.",
  keywords: ["n8n alternative", "n8n vs AI agents", "n8n alternative with AI", "Sovereign Matrix vs n8n", "AI workflow automation", "n8n alternative for agencies"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/n8n" },
  openGraph: {
    title: "Sovereign Matrix vs n8n — Honest Comparison",
    description: "130 AI agents at $199/mo vs n8n Cloud at $20/mo. Agents that reason vs workflows that follow rules. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/n8n",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
