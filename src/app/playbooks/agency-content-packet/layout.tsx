import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Agency content packet — blog + emails + ads + competitor intel in 90s | Sovereign Matrix",
  description:
    "The weekly deliverable for B2B agencies. Drop in a client's domain and brand voice — get a 1,500-word SEO blog post, a 3-email welcome sequence, three platform-specific ad creatives, and a competitor weakness teaser. Whitelabel-ready.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/playbooks/agency-content-packet",
  },
  openGraph: {
    title: "Agency content packet — a full week of deliverables in 90 seconds",
    description:
      "Replace your $2K/mo stack of single-purpose AI tools. One client → SEO post + emails + ads + competitor intel, every week, whitelabel-ready.",
    url: "https://sovereignmatrix.agency/playbooks/agency-content-packet",
    type: "website",
  },
};

export default function AgencyContentPacketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
