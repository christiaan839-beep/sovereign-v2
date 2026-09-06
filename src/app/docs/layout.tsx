import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Documentation — API, SDK, Playbooks | Sovereign Matrix",
  description: "Complete documentation for the Sovereign Matrix platform. API reference, SDK guides, agent playbooks, webhook integration, and self-hosted NemoClaw OS.",
  alternates: { canonical: "https://sovereignmatrix.agency/docs" },
  openGraph: {
    title: "Documentation — Sovereign Matrix",
    description: "API reference, SDK guides, and 140 agent playbooks.",
    url: "https://sovereignmatrix.agency/docs",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Documentation", url: "https://sovereignmatrix.agency/docs" },
]);

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
