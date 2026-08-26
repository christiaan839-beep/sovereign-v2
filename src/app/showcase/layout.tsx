import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Agent Showcase — 130+ Specialized AI Agents | Sovereign Matrix",
  description: "Browse the complete catalog of 130+ autonomous agents across sales, marketing, content, SEO, voice, and operations. Each with specific capabilities and outputs.",
  alternates: { canonical: "https://sovereignmatrix.agency/showcase" },
  openGraph: {
    title: "140 AI Agents Showcase",
    description: "Specialized autonomous agents for sales, marketing, content, SEO, voice.",
    url: "https://sovereignmatrix.agency/showcase",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Agent Showcase", url: "https://sovereignmatrix.agency/showcase" },
]);

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
