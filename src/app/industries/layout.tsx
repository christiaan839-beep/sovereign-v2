import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

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

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Industries", url: "https://sovereignmatrix.agency/industries" },
]);

const collection = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Sovereign Matrix — Industries",
  description:
    "Vertical hub mapping cryptographically verifiable AI primitives to every regulated industry. Twelve sector landings plus three audit-grade procurement surfaces.",
  url: "https://sovereignmatrix.agency/industries",
  isPartOf: {
    "@type": "WebSite",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        url: "https://sovereignmatrix.agency/compliance",
        name: "Compliance Automation",
      },
      {
        "@type": "ListItem",
        position: 2,
        url: "https://sovereignmatrix.agency/vendor-risk",
        name: "Vendor Risk / Procurement",
      },
      {
        "@type": "ListItem",
        position: 3,
        url: "https://sovereignmatrix.agency/insurance",
        name: "AI E&O Insurance",
      },
      {
        "@type": "ListItem",
        position: 4,
        url: "https://sovereignmatrix.agency/for-healthcare",
        name: "Healthcare",
      },
      {
        "@type": "ListItem",
        position: 5,
        url: "https://sovereignmatrix.agency/for-legal",
        name: "Legal",
      },
      {
        "@type": "ListItem",
        position: 6,
        url: "https://sovereignmatrix.agency/for-fintech",
        name: "Financial Services",
      },
      {
        "@type": "ListItem",
        position: 7,
        url: "https://sovereignmatrix.agency/for-cybersecurity",
        name: "Cybersecurity",
      },
      {
        "@type": "ListItem",
        position: 8,
        url: "https://sovereignmatrix.agency/for-education",
        name: "Education",
      },
      {
        "@type": "ListItem",
        position: 9,
        url: "https://sovereignmatrix.agency/for-government",
        name: "Government",
      },
    ],
  },
};

export default function IndustriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={crumbs} />
      <JsonLd data={collection} />
      {children}
    </>
  );
}
