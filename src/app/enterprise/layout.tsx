import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Enterprise — Custom AI Deployments | Sovereign Matrix",
  description: "Enterprise-grade AI agent deployments. GDPR-aligned, HIPAA-aware controls, SOC 2 Type II readiness in progress. Air-gapped via NemoClaw OS. Custom SLAs, dedicated support, private models.",
  keywords: ["enterprise AI", "SOC 2 readiness", "HIPAA-aware AI", "air-gapped AI", "enterprise agents", "private LLM deployment"],
  alternates: { canonical: "https://sovereignmatrix.agency/enterprise" },
  openGraph: {
    title: "Enterprise AI — Sovereign Matrix",
    description: "GDPR-aligned, HIPAA-aware agent deployments with SOC 2 Type II readiness in progress. Air-gapped via NemoClaw OS.",
    url: "https://sovereignmatrix.agency/enterprise",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Enterprise", url: "https://sovereignmatrix.agency/enterprise" },
]);

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
