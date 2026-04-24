import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Lead Generation — ICP to Qualified Meetings | Sovereign Matrix",
  description: "From ICP definition to qualified meetings. 223 agents handle prospect research, personalized outreach, AI voice qualification, and pipeline intelligence. No cold calling. No spreadsheets.",
  keywords: ["AI lead generation", "autonomous lead gen", "AI sales pipeline", "lead enrichment AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/use-cases/lead-gen" },
  openGraph: {
    title: "Your AI Lead Machine — Sovereign Matrix",
    description: "From ICP definition to qualified meetings — 223 agents handle the entire pipeline. No cold calling. No manual research. No spreadsheets.",
    url: "https://sovereignmatrix.agency/use-cases/lead-gen",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
