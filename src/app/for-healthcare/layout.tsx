import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Healthcare — HIPAA-Aware Controls | Sovereign Matrix",
  description: "AI agents for healthcare built on HIPAA-aware controls, with a BAA available for enterprise deployments. Patient intake automation, appointment scheduling, medical record summarization, and billing assistance. Local execution keeps patient data on your machine.",
  keywords: ["AI healthcare platform", "HIPAA-aware AI", "medical AI agents", "patient intake automation", "medical record AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-healthcare" },
  openGraph: {
    title: "AI Agents for Healthcare — Sovereign Matrix",
    description: "HIPAA-aware AI agents, BAA available for enterprise. Patient intake, scheduling, record summarization, and billing. Local execution keeps data on your infrastructure.",
    url: "https://sovereignmatrix.agency/for-healthcare",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Healthcare", url: "https://sovereignmatrix.agency/for-healthcare" },
]);

export default function ForHealthcareLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
