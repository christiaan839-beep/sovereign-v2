import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Level Agreement — Sovereign Matrix",
  description:
    "Uptime commitments, incident response times, and credit policy for Sovereign Matrix customers. 99.9% platform uptime on paid tiers.",
  alternates: { canonical: "https://sovereignmatrix.agency/sla" },
  openGraph: {
    title: "Sovereign Matrix — Service Level Agreement",
    description: "99.9% uptime. Clear incident response. Credit policy documented.",
    url: "https://sovereignmatrix.agency/sla",
    type: "website",
  },
};

export default function SlaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
