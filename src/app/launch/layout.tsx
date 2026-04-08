import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix — The Agent Operating System is Live",
  description: "130 AI agents. 39+ models. $199/mo flat. No credits, no per-token fees. Find leads, write content, scan competitors, make calls, close deals. Autonomously.",
  keywords: ["AI agent platform", "autonomous AI agents", "Sovereign Matrix launch", "AI operating system", "agent OS"],
  alternates: { canonical: "https://sovereignmatrix.agency/launch" },
  openGraph: {
    title: "Sovereign Matrix — The Agent Operating System is Live",
    description: "130 AI agents. 39+ models. $199/mo flat. Try free — no signup required.",
    url: "https://sovereignmatrix.agency/launch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — The Agent Operating System is Live",
    description: "130 AI agents. 39+ models. $199/mo flat. Your competitors hire humans. You deploy agents.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
