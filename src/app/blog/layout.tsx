import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Intelligence Hub — AI Agent Insights & Playbooks | Sovereign Matrix",
  description:
    "Deep-dive articles on autonomous AI agents, NVIDIA NIM architecture, agency automation, and the economics of open-source AI at scale.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/blog",
    types: {
      "application/rss+xml": [
        {
          url: "https://sovereignmatrix.agency/blog/feed.xml",
          title: "Sovereign Matrix — Blog (RSS)",
        },
      ],
    },
  },
  openGraph: {
    title: "Intelligence Hub — Sovereign Matrix Blog",
    description: "Autonomous AI agent insights, playbooks, and case studies.",
    url: "https://sovereignmatrix.agency/blog",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Intelligence Hub", url: "https://sovereignmatrix.agency/blog" },
]);

export default function BlogLayout({
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
