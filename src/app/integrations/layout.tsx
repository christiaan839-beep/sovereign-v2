import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "25+ Integrations — Connect Your Stack | Sovereign Matrix",
  description: "Sovereign Matrix integrates with 25+ platforms across AI models, communication, data, business tools, payments, and infrastructure. Zero lock-in. Connect your existing tools.",
  keywords: ["AI platform integrations", "Sovereign Matrix integrations", "AI agent connectors", "AI model integrations", "business tool connectors"],
  alternates: { canonical: "https://sovereignmatrix.agency/integrations" },
  openGraph: {
    title: "25+ Integrations. Zero Lock-in. — Sovereign Matrix",
    description: "Connect your existing tools. Sovereign works alongside your stack — not instead of it. AI models, CRM, payments, communication, and more.",
    url: "https://sovereignmatrix.agency/integrations",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
