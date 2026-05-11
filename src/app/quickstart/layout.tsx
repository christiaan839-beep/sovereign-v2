import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quickstart — Sovereign Matrix in 5 minutes",
  description:
    "Sign up, run your first agent, get a verifiable HMAC-signed receipt, install the badge / MCP server / CLI / GitHub Action. End-to-end Sovereign in five minutes.",
  openGraph: {
    title: "Sovereign Matrix Quickstart",
    description:
      "From zero to verified receipt in five minutes. Sign up → run → verify → distribute.",
    url: "https://sovereignmatrix.agency/quickstart",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix Quickstart",
    description: "Zero to verified receipt in 5 minutes.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/quickstart" },
};

export default function QuickstartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
