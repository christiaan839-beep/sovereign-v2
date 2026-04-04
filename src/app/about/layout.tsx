import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "About — Autonomous Intelligence Systems | Sovereign Matrix",
  description: "We build the autonomous agent infrastructure other agencies sell as their own. 130+ specialized agents. Zero per-token cost. Built on NVIDIA NIM.",
  alternates: { canonical: "https://sovereignmatrix.agency/about" },
  openGraph: {
    title: "About Sovereign Matrix",
    description: "The shadow intelligence platform powering modern agencies.",
    url: "https://sovereignmatrix.agency/about",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "About", url: "https://sovereignmatrix.agency/about" },
]);

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
