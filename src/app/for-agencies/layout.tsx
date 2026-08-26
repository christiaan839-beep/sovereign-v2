import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "For Agencies — White-Label AI Agents | Sovereign Matrix",
  description: "Rebrand our 130+ autonomous agents as your own. Custom domain, client portals, your logo. Scale your agency without hiring. Enterprise license available.",
  keywords: ["white-label AI", "AI for agencies", "agency automation", "AI reseller", "agency franchise model", "white-label automation"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-agencies" },
  openGraph: {
    title: "White-Label AI Agents for Agencies",
    description: "Rebrand Sovereign Matrix as your own. Full white-label. 140 agents.",
    url: "https://sovereignmatrix.agency/for-agencies",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Agencies", url: "https://sovereignmatrix.agency/for-agencies" },
]);

export default function ForAgenciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
