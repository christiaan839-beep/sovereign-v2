import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Stats — Sovereign Matrix",
  description:
    "Live aggregate metrics for the Sovereign Matrix platform. Total signed receipts, receipts published as public, last 24-hour activity. Updated every minute.",
  openGraph: {
    title: "Sovereign Matrix — Platform Stats",
    description:
      "Live aggregate metrics. Total signed receipts, public receipts, 24-hour activity.",
    url: "https://sovereignmatrix.agency/stats",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — Platform Stats",
    description: "Live aggregate metrics for the audit-grade AI platform.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/stats" },
};

export default function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
