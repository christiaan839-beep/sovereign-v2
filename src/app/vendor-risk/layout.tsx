import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Survive every security questionnaire — Sovereign Matrix",
  description:
    "Sovereign's Verified-Output stamp is the answer to 'show us your AI audit posture' — one URL paste, every claim independently verifiable. Built for AI vendors selling into procurement-heavy enterprise.",
  openGraph: {
    title: "Vendor Risk — Sovereign Matrix",
    description:
      "One URL paste = every security questionnaire answer. Public verifier, signed audit chain, sub-processor list, DPA, SOC 2 controls map.",
    url: "https://sovereignmatrix.agency/vendor-risk",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Survive every security questionnaire",
    description:
      "One URL paste. Every claim independently verifiable. Built for AI vendors.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/vendor-risk" },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Industries", url: "https://sovereignmatrix.agency/industries" },
  {
    name: "Vendor Risk",
    url: "https://sovereignmatrix.agency/vendor-risk",
  },
]);

const service = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "AI Vendor Risk & Procurement Readiness",
  description:
    "Pre-answered security questionnaires for AI vendors. Cryptographically verifiable trust hub at /trust answers the four most-asked procurement questions — every claim is independently verifiable against live platform primitives.",
  url: "https://sovereignmatrix.agency/vendor-risk",
  serviceType: "Vendor risk management",
  provider: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  audience: {
    "@type": "Audience",
    audienceType:
      "Founders, GTM leads, and security teams at AI vendors selling into procurement-heavy enterprise",
  },
};

export default function VendorRiskLayout({
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
