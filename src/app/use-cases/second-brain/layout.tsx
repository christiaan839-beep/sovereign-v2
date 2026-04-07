import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Second Brain — Memory + Retrieval + Action | Sovereign Matrix",
  description: "Build a persistent AI second brain. Every conversation stored, searchable, and actionable. Agents remember your strategies, clients, and decisions — then act on them.",
  keywords: ["AI second brain", "AI memory", "business AI assistant", "AI knowledge management", "autonomous AI agents"],
  alternates: { canonical: "https://sovereignmatrix.agency/use-cases/second-brain" },
  openGraph: {
    title: "Your AI Second Brain — Sovereign Matrix",
    description: "Memory + Retrieval + Action. Agents that remember everything and turn memory into execution.",
    url: "https://sovereignmatrix.agency/use-cases/second-brain",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
