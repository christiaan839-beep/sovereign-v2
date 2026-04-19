import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Enterprise — Custom AI Deployments | Sovereign Matrix",
  // Honesty note (April 2026): SOC 2 Type II is in progress, expected Q3 2026.
  // We do NOT claim completed certification until the auditor signs off.
  // HIPAA technical controls are available via dedicated deployment but
  // the platform is not HIPAA-configured by default. See /trust for status.
  description: "Enterprise AI agent deployments. SOC 2 Type II in progress (Q3 2026). GDPR / POPIA compliant. HIPAA technical controls via dedicated deployment. Custom SLAs, dedicated support, private models.",
  keywords: ["enterprise AI", "GDPR AI platform", "air-gapped AI", "enterprise agents", "private LLM deployment"],
  alternates: { canonical: "https://sovereignmatrix.agency/enterprise" },
  openGraph: {
    title: "Enterprise AI — Sovereign Matrix",
    description: "GDPR compliant. SOC 2 Type II in progress. Air-gapped deployment option via Ollama. Custom SLAs.",
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
