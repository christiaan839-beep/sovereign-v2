import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";
import { TOTAL_AGENTS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: "AI Agents for E-Commerce — Product Descriptions & Pricing | Sovereign Matrix",
  description: `AI ecommerce platform with product description generation, competitor price monitoring, ad copy optimization, and review analysis agents. ${TOTAL_AGENTS} agents handle your entire catalog at once. Ecommerce AI agents built for scale.`,
  keywords: ["AI ecommerce platform", "product description AI", "ecommerce AI agents", "competitor pricing AI", "ad copy AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-ecommerce" },
  openGraph: {
    title: "AI Agents for E-Commerce — Sovereign Matrix",
    description: `AI ecommerce platform. Product descriptions, competitor pricing, ad copy, and review analysis. ${TOTAL_AGENTS} agents handle your entire catalog at once.`,
    url: "https://sovereignmatrix.agency/for-ecommerce",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For E-Commerce", url: "https://sovereignmatrix.agency/for-ecommerce" },
]);

export default function ForEcommerceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
