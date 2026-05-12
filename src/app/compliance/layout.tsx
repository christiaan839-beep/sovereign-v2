import type { Metadata } from "next";

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

export default function ComplianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
