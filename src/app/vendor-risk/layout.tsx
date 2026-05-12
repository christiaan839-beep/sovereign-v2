import type { Metadata } from "next";

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

export default function VendorRiskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
