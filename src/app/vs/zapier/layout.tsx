import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Zapier — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo unlimited) vs Zapier (workflow automation, $49/mo limited tasks). Agents that think vs automations that follow rules.",
  keywords: ["Zapier alternative", "Zapier vs AI agents", "Sovereign Matrix vs Zapier", "AI automation platform", "Zapier alternative with AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/zapier" },
  openGraph: {
    title: "Sovereign Matrix vs Zapier — Honest Comparison",
    description: "Zapier connects apps. Sovereign agents think, plan, and execute. See the full comparison.",
    url: "https://sovereignmatrix.agency/vs/zapier",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
