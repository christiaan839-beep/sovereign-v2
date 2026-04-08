import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Sovereign Matrix",
  description: "Get in touch with the Sovereign Matrix team. Enterprise inquiries, partnerships, support, or security questions. We respond within 24 hours.",
  alternates: { canonical: "https://sovereignmatrix.agency/contact" },
  openGraph: {
    title: "Contact — Sovereign Matrix",
    description: "Questions, partnerships, enterprise deals. We respond within 24 hours.",
    url: "https://sovereignmatrix.agency/contact",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
