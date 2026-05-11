import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verification Badge Builder — Sovereign Matrix",
  description:
    "Configure and preview the Sovereign Verified badge. Drop one line on your site; visitors verify your AI agent receipt without leaving the page. No iframe, no third-party JS, ~2KB.",
  openGraph: {
    title: "Sovereign Verified — Badge Builder",
    description:
      "One line. Verifiable AI output. The SSL-Labs-style trust signal for the AI agent era.",
    url: "https://sovereignmatrix.agency/badge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Verified Badge Builder",
    description: "Configure your verifiable AI badge. Copy one line. Ship.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/badge" },
};

export default function BadgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
