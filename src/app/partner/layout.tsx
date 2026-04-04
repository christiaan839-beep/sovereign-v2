import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Program — Earn Recurring Revenue | Sovereign Matrix",
  description: "Refer agencies and earn 30% recurring commission. White-label options available. Simple dashboard, transparent tracking, monthly payouts.",
  alternates: { canonical: "https://sovereignmatrix.agency/partner" },
  openGraph: {
    title: "Partner Program — Sovereign Matrix",
    description: "30% recurring commission. Refer agencies, earn monthly.",
    url: "https://sovereignmatrix.agency/partner",
    type: "website",
  },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
