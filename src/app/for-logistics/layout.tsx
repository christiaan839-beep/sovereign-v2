import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Logistics & Freight — BOL, HS Codes, TMS | Sovereign Matrix",
  description:
    "AI agents for freight brokers, 3PLs, and customs teams. Bill of Lading OCR, HS code classification, freight invoice auditing. Ready for McLeod, MercuryGate, and Oracle OTM.",
  keywords: [
    "freight AI",
    "BOL automation",
    "HS code classification",
    "customs broker AI",
    "3PL automation",
    "TMS integration",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/for-logistics" },
  openGraph: {
    title: "AI Agents for Logistics — Sovereign Matrix",
    description:
      "BOL OCR, HS codes, freight-invoice audit. Built for McLeod / MercuryGate / Oracle OTM.",
    url: "https://sovereignmatrix.agency/for-logistics",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Logistics", url: "https://sovereignmatrix.agency/for-logistics" },
]);

export default function ForLogisticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
