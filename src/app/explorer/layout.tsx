import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receipt Explorer — Sovereign Matrix",
  description:
    "Live stream of public agent receipts being signed by the Sovereign platform. Bitcoin-block-explorer-style feed for AI agent outputs. Every row links to a cryptographically verifiable receipt at /r/<id>.",
  openGraph: {
    title: "Receipt Explorer — Sovereign Matrix",
    description:
      "Real-time stream of Ed25519-signed agent receipts (post-quantum-ready via ML-DSA-65 dual-sign). Proof the platform is alive — every row independently verifiable.",
    url: "https://sovereignmatrix.agency/explorer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Receipt Explorer — Sovereign Matrix",
    description:
      "Live stream of cryptographically signed AI agent receipts. Every row verifiable.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/explorer" },
};

export default function ExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
