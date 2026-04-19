import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust — Sovereign Matrix",
  description:
    "How Sovereign Matrix handles your data, your customers' data, and the agents acting on your behalf. Security architecture, compliance posture, and honest limits.",
  alternates: { canonical: "https://sovereignmatrix.agency/trust" },
  openGraph: {
    title: "Sovereign Matrix — Trust",
    description: "Security architecture, compliance posture, and honest limits.",
    url: "https://sovereignmatrix.agency/trust",
    type: "website",
  },
};

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return children;
}
