import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic Commerce — Money-grade primitives for AI agents | Sovereign Matrix",
  description:
    "The cryptographically-trustable compute layer for agentic commerce. Every agent action is hash-chained, scope-bounded, cost-capped, and reversible by default.",
  openGraph: {
    title: "Agentic Commerce — Sovereign Matrix",
    description:
      "Spend cards for AI agents. Hard ceilings, atomic charges, hash-chained receipts, 24h reversal window.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
