import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Clinical-trial-grade AI receipts — Sovereign Matrix",
  description:
    "21 CFR Part 11. ICH-GCP E6(R3). GxP. ALCOA+. Every AI agent output cryptographically signed, time-stamped, and replayable. The audit trail your QA team needed AI to ship with.",
  openGraph: {
    title: "Clinical-trial-grade AI receipts — Sovereign Matrix",
    description:
      "Part 11 + ICH-GCP + GxP-aligned receipts for every AI agent output. Audit-ready by construction.",
    url: "https://sovereignmatrix.agency/pharma",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinical-trial-grade AI receipts",
    description:
      "Part 11 + ICH-GCP + GxP receipts for every AI agent output, by construction.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/pharma" },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Industries", url: "https://sovereignmatrix.agency/industries" },
  { name: "Life Sciences", url: "https://sovereignmatrix.agency/pharma" },
]);

const service = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Pharmaceutical + Life Sciences AI Receipts",
  description:
    "21 CFR Part 11, ICH-GCP, GxP-aligned cryptographic receipts for every AI agent output in clinical trial operations, regulatory submissions, and pharmacovigilance workflows.",
  url: "https://sovereignmatrix.agency/pharma",
  serviceType: "Regulated industries AI infrastructure",
  provider: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  areaServed: ["Global", "United States", "European Union", "South Africa"],
  audience: {
    "@type": "Audience",
    audienceType:
      "Quality Assurance leads, Clinical Operations, CRA managers, and Pharmacovigilance teams at pharma, biotech, CROs, and medical-device companies",
  },
};

export default function PharmaLayout({
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
