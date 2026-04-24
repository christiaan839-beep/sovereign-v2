import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Construction — Permits, Safety, Submittals | Sovereign Matrix",
  description:
    "AI agents for GCs, subs, and construction owners. Permit application drafting, OSHA 300/301 incident reporting, blueprint parsing, submittal logging. Procore / Autodesk Construction Cloud ready.",
  keywords: [
    "construction AI",
    "permit automation",
    "OSHA incident reporting",
    "blueprint OCR",
    "submittal log AI",
    "Procore integration",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/for-construction" },
  openGraph: {
    title: "AI Agents for Construction — Sovereign Matrix",
    description:
      "Permit drafts, safety incident reports, blueprint parsing, submittal logs. Procore and Autodesk Construction Cloud ready.",
    url: "https://sovereignmatrix.agency/for-construction",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Construction", url: "https://sovereignmatrix.agency/for-construction" },
]);

export default function ForConstructionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
