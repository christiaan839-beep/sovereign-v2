import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "For Developers — Build on Sovereign Matrix | API + SDK",
  description: "Full-stack developer platform. REST API, TypeScript SDK, webhook triggers, agent factory, custom MCP tools. Build autonomous agents that ship.",
  alternates: { canonical: "https://sovereignmatrix.agency/developer" },
  openGraph: {
    title: "For Developers — Sovereign Matrix",
    description: "REST API + TypeScript SDK + webhook triggers + MCP tools.",
    url: "https://sovereignmatrix.agency/developer",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Developers", url: "https://sovereignmatrix.agency/developer" },
]);

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
