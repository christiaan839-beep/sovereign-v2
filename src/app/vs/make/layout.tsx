import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Make.com — Honest Comparison (2026)",
  description: "Compare Sovereign Matrix (130 AI agents, $199/mo) vs Make.com Pro ($16.67/mo). Feature-by-feature comparison with honest strengths and weaknesses for both platforms.",
  keywords: ["Make.com alternative", "Make vs AI agents", "Sovereign Matrix vs Make", "AI automation platform", "Make.com alternative for agencies"],
  alternates: { canonical: "https://sovereignmatrix.agency/vs/make" },
  openGraph: {
    title: "Sovereign Matrix vs Make.com — Honest Comparison",
    description: "130 AI agents at $199/mo vs Make.com Pro at $16.67/mo. See the full feature comparison.",
    url: "https://sovereignmatrix.agency/vs/make",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
