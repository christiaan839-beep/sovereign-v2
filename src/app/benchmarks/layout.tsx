import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Benchmarks — Sovereign Matrix vs Every Competitor",
  description:
    "Live metrics: agent count, latency (P95), safety-pipeline depth, model diversity, cost per request, test coverage, uptime. Sovereign Matrix vs CrewAI, Zapier, n8n, LangChain, Lindy.",
  keywords: [
    "AI agent benchmarks",
    "Sovereign Matrix performance",
    "agent platform comparison",
    "LLM platform latency",
    "AI platform reliability",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/benchmarks" },
  openGraph: {
    title: "Benchmarks — Sovereign Matrix",
    description:
      "Live metrics. Honest numbers. Every claim has a command that verifies it.",
    url: "https://sovereignmatrix.agency/benchmarks",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Benchmarks", url: "https://sovereignmatrix.agency/benchmarks" },
]);

export default function BenchmarksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
