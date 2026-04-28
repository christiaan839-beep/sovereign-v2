import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";
import { TOTAL_AGENTS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: "Case Studies — Real Results from Autonomous AI | Sovereign Matrix",
  description: "See how agencies scale 10x with Sovereign Matrix. Real customer results: lead generation, content velocity, cost savings, and autonomous workflow deployment.",
  alternates: { canonical: "https://sovereignmatrix.agency/case-studies" },
  openGraph: {
    title: "Case Studies — Sovereign Matrix",
    description: `Real agency scaling results with ${TOTAL_AGENTS} autonomous AI agents.`,
    url: "https://sovereignmatrix.agency/case-studies",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Case Studies", url: "https://sovereignmatrix.agency/case-studies" },
]);

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
