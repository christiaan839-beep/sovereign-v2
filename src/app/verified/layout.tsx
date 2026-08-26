import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Verified — Ed25519-signed receipts for every AI agent run",
  description:
    "Every agent run produces a cryptographically signed receipt (Ed25519, post-quantum-ready via ML-DSA-65 dual-sign). Drop one line on your site; visitors verify against the public /api/verify endpoint with no signup, no API key, no iframe. Open CORS, sub-50ms.",
  openGraph: {
    title: "Sovereign Verified — proof every AI output is auditable",
    description:
      "Ed25519-signed receipts, with optional ML-DSA-65 dual-signing (FIPS 204 post-quantum). Public verifier. Cross-origin readable. Bitcoin-anchored via OpenTimestamps. Audit-grade AI infrastructure.",
    url: "https://sovereignmatrix.agency/verified",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Verified",
    description:
      "Cryptographically signed receipts for every AI agent run. Drop-in verifier badge.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/verified" },
};

export default function VerifiedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
