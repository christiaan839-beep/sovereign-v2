import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Emissions numbers your auditor will sign off on — Sovereign Matrix",
  description:
    "CSRD. SEC climate rule. GHG Protocol. ISSB. Every AI-assisted emissions calculation produces a cryptographically signed receipt with activity data, emission factor, and methodology preserved.",
  openGraph: {
    title: "Emissions numbers your auditor will sign off on — Sovereign Matrix",
    description:
      "CSRD + SEC climate-rule + GHG Protocol-aligned receipts for every AI-assisted emissions calculation.",
    url: "https://sovereignmatrix.agency/climate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Emissions numbers your auditor will sign off on",
    description:
      "Auditor-verifiable receipts for every AI-assisted emissions calculation.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/climate" },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Industries", url: "https://sovereignmatrix.agency/industries" },
  {
    name: "Climate + ESG Assurance",
    url: "https://sovereignmatrix.agency/climate",
  },
]);

const service = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Climate-tech + Carbon Accounting AI Assurance",
  description:
    "CSRD, SEC climate rule, GHG Protocol, ISSB-aligned cryptographic receipts for every AI-assisted emissions calculation. Limited-assurance-ready by construction.",
  url: "https://sovereignmatrix.agency/climate",
  serviceType: "Climate disclosure assurance infrastructure",
  provider: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  areaServed: ["Global", "United States", "European Union", "South Africa"],
  audience: {
    "@type": "Audience",
    audienceType:
      "Sustainability leads, ESG analysts, CFOs, and third-party assurance providers at CSRD/SEC-regulated companies",
  },
};

export default function ClimateLayout({
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
