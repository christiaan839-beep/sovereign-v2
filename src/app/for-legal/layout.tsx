import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Legal — Contract Review & Due Diligence | Sovereign Matrix",
  description: "AI agents for legal teams. Contract analysis in seconds, due diligence at scale, compliance scanning, and legal research. Air-gapped execution for confidential work.",
  keywords: ["AI legal platform", "contract review AI", "legal AI agents", "due diligence automation", "compliance scanning AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-legal" },
  openGraph: {
    title: "AI Agents for Legal — Sovereign Matrix",
    description: "Contract review in seconds. Due diligence at scale. Air-gapped execution for confidential work.",
    url: "https://sovereignmatrix.agency/for-legal",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Legal", url: "https://sovereignmatrix.agency/for-legal" },
]);

export default function ForLegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
