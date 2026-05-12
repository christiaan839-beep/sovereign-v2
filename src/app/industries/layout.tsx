import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Industries — Sovereign Matrix",
  description:
    "Verifiable AI receipts mapped to every regulated industry: compliance, vendor-risk, insurance, legal, healthcare, financial services, government, education, real estate, and more. Same primitives, vertical-specific procurement language.",
  openGraph: {
    title: "Sovereign Matrix — Industries",
    description:
      "Pick your vertical. Every page maps Sovereign's verifiable-output primitives to that industry's procurement, audit, and compliance vocabulary.",
    url: "https://sovereignmatrix.agency/industries",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Industries — Sovereign Matrix",
    description:
      "Verifiable AI receipts, mapped to every regulated industry's procurement language.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/industries" },
};

export default function IndustriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
