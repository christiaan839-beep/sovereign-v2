import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Every Competitor — Side-by-side Benchmarks",
  description:
    "Live comparison: Sovereign Matrix vs CrewAI, Zapier, n8n, LangChain, Lindy. Agent count, safety pipeline, crypto signatures, uptime, test coverage, vertical depth. Every claim is code-verifiable.",
  keywords: [
    "AI agent platform comparison",
    "Sovereign Matrix vs CrewAI",
    "vs Zapier vs n8n",
    "AI platform benchmarks",
    "agent marketplace comparison",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/compare" },
  openGraph: {
    title: "Sovereign Matrix vs Every Competitor",
    description:
      "Live comparison on 12 measurable metrics. Every number has a verification command.",
    url: "https://sovereignmatrix.agency/compare",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Compare", url: "https://sovereignmatrix.agency/compare" },
]);

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
