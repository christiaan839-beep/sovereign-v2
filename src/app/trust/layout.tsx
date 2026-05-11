import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust — Sovereign Matrix",
  description:
    "Audit-grade infrastructure for AI in regulated industries. SOC 2-mapped controls, POPIA + GDPR endpoints, public verifier API, HMAC-signed receipts on every agent run, OpenTimestamps Bitcoin anchoring. The full trust posture in one page.",
  openGraph: {
    title: "Trust — Sovereign Matrix",
    description:
      "SOC 2 controls, GDPR + POPIA, public verifier, HMAC-signed receipts, Bitcoin notarization. Every link goes to a live primitive — not a marketing claim.",
    url: "https://sovereignmatrix.agency/trust",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trust — Sovereign Matrix",
    description:
      "The trust posture in one page. Live primitives, not marketing claims.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/trust" },
};

export default function TrustLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
