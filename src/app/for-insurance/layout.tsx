import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Insurance — FNOL, COI, Claims | Sovereign Matrix",
  description:
    "AI agents for insurance carriers and brokers. First Notice of Loss intake, Certificate of Insurance verification, claims triage, and fraud signal detection. Structured outputs plug directly into Guidewire, Duck Creek, and Origami.",
  keywords: [
    "insurance AI",
    "FNOL automation",
    "certificate of insurance verification",
    "claims triage AI",
    "insurance automation platform",
  ],
  alternates: { canonical: "https://sovereignmatrix.agency/for-insurance" },
  openGraph: {
    title: "AI Agents for Insurance — Sovereign Matrix",
    description:
      "Automate FNOL intake, COI verification, and claims triage. Structured outputs for Guidewire / Duck Creek / Origami.",
    url: "https://sovereignmatrix.agency/for-insurance",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Insurance", url: "https://sovereignmatrix.agency/for-insurance" },
]);

export default function ForInsuranceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
