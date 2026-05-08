import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Growth Pulse — local SEO + social + WhatsApp + offer in Rands | Sovereign Matrix",
  description:
    "The monthly deliverable for African SMBs. Locale-aware (ZAR / NGN / KES / EGP / GHS), WhatsApp-first, billed in Rands. Local-SEO checklist + 4 social posts + re-engagement email + WhatsApp broadcast + offer card in your local currency.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/playbooks/growth-pulse",
  },
  openGraph: {
    title: "Growth Pulse — built for African SMBs, billed in Rands",
    description:
      "The AI tool USD-only competitors can't replicate. Locale-aware checklist + posts + email + WhatsApp + offer in your currency, every month, R349 / month.",
    url: "https://sovereignmatrix.agency/playbooks/growth-pulse",
    type: "website",
  },
};

export default function GrowthPulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
