import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Fintech — Compliance & Fraud Detection | Sovereign Matrix",
  description: "AI fintech platform with compliance monitoring, fraud detection, and portfolio analysis agents. Air-gapped execution keeps fiduciary data secure. Financial AI agents built for regulated environments.",
  keywords: ["AI fintech platform", "financial AI agents", "compliance AI", "fraud detection AI", "portfolio analysis AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-fintech" },
  openGraph: {
    title: "AI Agents for Fintech — Sovereign Matrix",
    description: "AI fintech platform. Compliance monitoring, fraud detection, portfolio analysis, and client communication. Air-gapped execution for regulated data.",
    url: "https://sovereignmatrix.agency/for-fintech",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Fintech", url: "https://sovereignmatrix.agency/for-fintech" },
]);

export default function ForFintechLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
