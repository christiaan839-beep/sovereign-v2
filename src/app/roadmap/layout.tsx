import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Roadmap — Sovereign Matrix",
  description:
    "Sovereign Matrix public roadmap for 2026. See what we're building now, what's planned next, and where the AI agent platform is heading.",
  keywords: [
    "Sovereign Matrix roadmap",
    "AI agent platform roadmap",
    "agentic AI roadmap 2026",
    "AI agent infrastructure",
    "agent marketplace roadmap",
  ],
  openGraph: {
    title: "Product Roadmap — Sovereign Matrix",
    description:
      "Sovereign Matrix public roadmap for 2026. See what we're building now, what's planned next, and where the AI agent platform is heading.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
