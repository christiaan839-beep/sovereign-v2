import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program — Sovereign Matrix",
  description:
    "Earn 30% recurring commission for every paid customer you refer to Sovereign Matrix. 90-day attribution window, monthly payouts in ZAR or USD, no cap.",
  openGraph: {
    title: "Sovereign Matrix Affiliate Program",
    description:
      "30% recurring · 90-day attribution · monthly payouts · no cap. Refer audit-grade AI infrastructure.",
    url: "https://sovereignmatrix.agency/affiliate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix Affiliate Program",
    description:
      "30% recurring · 90-day attribution · monthly payouts · no cap.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/affiliate" },
};

export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
