import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Content Engine — Blog, Social, Email Generation | Sovereign Matrix",
  description: "Autonomous content generation pipeline. Blog posts, social media, email sequences, and landing pages — researched, written, critiqued, and published by AI agents.",
  keywords: ["AI content generation", "AI blog writer", "autonomous content engine", "AI content marketing"],
  alternates: { canonical: "https://sovereignmatrix.agency/use-cases/content-engine" },
  openGraph: {
    title: "Your AI Content Engine — Sovereign Matrix",
    description: "Blog posts, social media, email sequences — all generated, optimized, and published by autonomous agents. Human quality at machine speed.",
    url: "https://sovereignmatrix.agency/use-cases/content-engine",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
