import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Semantic Intelligence Engine — AI That Remembers",
  description: "Every agent run builds compounding semantic memory using NVIDIA NIM embeddings. 1,024-dim vectors, cosine similarity, user-scoped isolation. The more you use it, the smarter it gets.",
  openGraph: {
    title: "Semantic Intelligence Engine — Sovereign Matrix",
    description: "AI that remembers everything. Every run builds compounding intelligence unique to your workflows.",
    url: "https://sovereignmatrix.agency/intelligence",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/intelligence" },
};

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
