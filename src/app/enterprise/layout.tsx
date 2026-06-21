import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Enterprise — Custom AI Deployments | Sovereign Matrix",
  description:
    "Enterprise-grade AI agent deployments. SOC 2-aligned, GDPR-aware, HIPAA-ready controls. Local / air-gap-ready deployment options. Custom SLAs, dedicated support, private models.",
  keywords: [
    "enterprise AI",
    "SOC 2 AI platform",
    "HIPAA-ready AI",
    "air-gap-ready AI",
    "enterprise agents",
    "private LLM deployment",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/enterprise" },
  openGraph: {
    title: "Enterprise AI — Sovereign Matrix",
    description:
      "SOC 2-aligned + HIPAA-ready agent deployments. Local / air-gap-ready deployment options.",
    url: "https://sovereignmatrix.agency/enterprise",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Enterprise", url: "https://sovereignmatrix.agency/enterprise" },
]);

export default function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
