import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

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

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Industries", url: "https://sovereignmatrix.agency/industries" },
  {
    name: "Insurance Underwriting",
    url: "https://sovereignmatrix.agency/insurance",
  },
]);

const service = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "AI Errors & Omissions Risk Signal",
  description:
    "Per-tenant Merkle root + tamper-evidence at O(log N) + Bitcoin-anchored notarization as cryptographic underwriting input for AI E&O policies. Subrogation-grade evidence packs included.",
  url: "https://sovereignmatrix.agency/insurance",
  serviceType: "Insurance underwriting data",
  provider: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  audience: {
    "@type": "Audience",
    audienceType:
      "AI Errors & Omissions underwriters, professional-liability carriers, and reinsurance partners",
  },
};

export default function InsuranceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={crumbs} />
      <JsonLd data={service} />
      {children}
    </>
  );
}
