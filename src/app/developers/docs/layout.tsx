import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "API Reference — Sovereign Matrix Developer Docs",
  description:
    "Complete REST API documentation for the Sovereign Matrix agent platform. Endpoints for agent execution, playbooks, webhooks, metrics, and more. Includes authentication, rate limits per plan, and code examples.",
  alternates: { canonical: "https://sovereignmatrix.agency/developers/docs" },
  openGraph: {
    title: "API Reference — Sovereign Matrix",
    description:
      "REST API documentation for 130+ AI agents. Authentication, playbooks, webhooks, rate limits, and code examples.",
    url: "https://sovereignmatrix.agency/developers/docs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "API Reference — Sovereign Matrix",
    description:
      "Complete REST API docs for the Sovereign Matrix agent infrastructure stack.",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Developers", url: "https://sovereignmatrix.agency/developers" },
  { name: "API Docs", url: "https://sovereignmatrix.agency/developers/docs" },
]);

export default function DocsLayout({
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
