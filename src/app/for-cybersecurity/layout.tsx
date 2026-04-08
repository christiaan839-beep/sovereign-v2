import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Cybersecurity — Vulnerability Detection & Audit | Sovereign Matrix",
  description: "AI agents for cybersecurity. Glasswing-grade vulnerability detection, 5-layer safety pipeline, threat response, security audit automation, and compliance monitoring. Every action audited.",
  keywords: ["AI cybersecurity platform", "vulnerability detection AI", "Glasswing AI security", "security audit automation", "threat detection AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-cybersecurity" },
  openGraph: {
    title: "AI Agents for Cybersecurity — Sovereign Matrix",
    description: "Glasswing-grade vulnerability detection. 5-layer safety pipeline. Audit every action.",
    url: "https://sovereignmatrix.agency/for-cybersecurity",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Cybersecurity", url: "https://sovereignmatrix.agency/for-cybersecurity" },
]);

export default function ForCybersecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
