import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Compliance, Automated — Sovereign Matrix",
  description:
    "Continuous monitoring of AI agent outputs with cryptographically signed receipts. SOC 2 evidence packs auto-generated. EU AI Act, POPIA, GDPR audit trails — built into every agent run. Vanta-style automation for AI compliance.",
  openGraph: {
    title: "AI Compliance, Automated — Sovereign Matrix",
    description:
      "SOC 2 + EU AI Act + POPIA + GDPR audit trails, auto-generated from cryptographically signed agent receipts.",
    url: "https://sovereignmatrix.agency/compliance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Compliance, Automated",
    description:
      "Auto-generated AI audit trails for SOC 2 / EU AI Act / POPIA / GDPR.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/compliance" },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Industries", url: "https://sovereignmatrix.agency/industries" },
  {
    name: "Compliance Automation",
    url: "https://sovereignmatrix.agency/compliance",
  },
]);

const service = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "AI Compliance Automation",
  description:
    "Continuous monitoring of AI agent outputs with cryptographically signed receipts. SOC 2, EU AI Act, POPIA, GDPR audit trails — auto-generated from every agent run.",
  url: "https://sovereignmatrix.agency/compliance",
  serviceType: "Compliance automation",
  provider: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  areaServed: ["Global", "United States", "European Union", "South Africa"],
  audience: {
    "@type": "Audience",
    audienceType:
      "Compliance officers, GRC teams, and security leaders at AI-using enterprises",
  },
};

export default function ComplianceLayout({
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
