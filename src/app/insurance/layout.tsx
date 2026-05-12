import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Price AI risk with cryptographic signals — Sovereign Matrix",
  description:
    "Sovereign's receipt-chain integrity score is the audit signal AI E&O underwriters have been missing. Per-tenant Merkle chain root + tamper-evidence at O(log N) + Bitcoin-anchored notarization. Embed as a risk-pricing input for AI Errors & Omissions policies.",
  openGraph: {
    title: "AI Insurance Underwriting — Sovereign Matrix",
    description:
      "Cryptographic audit signal for AI E&O underwriting. Per-tenant chain integrity, tamper-evidence, Bitcoin anchoring.",
    url: "https://sovereignmatrix.agency/insurance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Insurance Underwriting",
    description:
      "Receipt-chain integrity as a risk-pricing input for AI E&O policies.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/insurance" },
};

export default function InsuranceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
