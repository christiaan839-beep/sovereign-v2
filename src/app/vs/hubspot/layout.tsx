import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs HubSpot — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo) vs HubSpot Marketing Hub ($890/mo). Feature-by-feature comparison with honest strengths and weaknesses for both platforms.",
  keywords: ["HubSpot alternative", "HubSpot vs AI agents", "Sovereign Matrix vs HubSpot", "AI marketing platform", "HubSpot alternative for agencies"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/hubspot" },
  openGraph: {
    title: "Sovereign Matrix vs HubSpot — Honest Comparison",
    description: "130 AI agents at $199/mo vs HubSpot Marketing Hub at $890/mo. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/hubspot",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
