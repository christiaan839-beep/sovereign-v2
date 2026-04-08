import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Real Estate — Listings, Leads & Showings | Sovereign Matrix",
  description: "AI agents for real estate. Property analysis, listing generation, lead qualification via voice and email, and market trend analysis. Voice agents book showings 24/7.",
  keywords: ["AI real estate platform", "real estate AI agents", "property listing AI", "lead qualification AI", "real estate automation"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-realestate" },
  openGraph: {
    title: "AI Agents for Real Estate — Sovereign Matrix",
    description: "Find buyers. Qualify leads. Generate listings. Voice agents book showings 24/7.",
    url: "https://sovereignmatrix.agency/for-realestate",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Real Estate", url: "https://sovereignmatrix.agency/for-realestate" },
]);

export default function ForRealEstateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
