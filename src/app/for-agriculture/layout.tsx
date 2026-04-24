import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Agriculture — Soil, Scouting, Precision Ag | Sovereign Matrix",
  description:
    "AI agents for row-crop farmers, CCAs, and ag retailers. Soil report extraction, field-photo crop scouting, yield-impact triage. JSON-ready for John Deere Operations Center and Climate FieldView.",
  keywords: [
    "precision agriculture AI",
    "soil test extraction",
    "crop scouting AI",
    "AgTech automation",
    "John Deere Operations Center integration",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/for-agriculture" },
  openGraph: {
    title: "AI Agents for Agriculture — Sovereign Matrix",
    description:
      "Soil reports, crop scouting, yield triage. Ready for John Deere Operations Center and Climate FieldView.",
    url: "https://sovereignmatrix.agency/for-agriculture",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Agriculture", url: "https://sovereignmatrix.agency/for-agriculture" },
]);

export default function ForAgricultureLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
