import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — Enterprise-Grade AI Safety | Sovereign Matrix",
  description: "Enterprise-grade security with 5-layer safety pipeline, HITL approvals, and NemoClaw sandboxing.",
  openGraph: {
    title: "Security — Enterprise-Grade AI Safety | Sovereign Matrix",
    description: "Enterprise-grade security with 5-layer safety pipeline, HITL approvals, and NemoClaw sandboxing.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
