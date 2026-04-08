import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Education — FERPA-Compliant | Sovereign Matrix",
  description: "FERPA-compliant AI agents for education. Curriculum generation, student assessment creation, administrative automation, and progress tracking. Runs locally for complete data privacy.",
  keywords: ["AI education platform", "FERPA compliant AI", "curriculum AI agents", "student assessment AI", "education automation"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-education" },
  openGraph: {
    title: "AI Agents for Education — Sovereign Matrix",
    description: "FERPA-compliant AI agents. Curriculum generation, student assessment, administrative automation. Runs locally.",
    url: "https://sovereignmatrix.agency/for-education",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Education", url: "https://sovereignmatrix.agency/for-education" },
]);

export default function ForEducationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
