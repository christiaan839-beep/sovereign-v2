import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Registry — Verifiable agent identities | Sovereign Matrix",
  description:
    "Public Know-Your-Agent registry. Every agent's identity is signed and cryptographically verifiable by any third party using @sovereign/inspector.",
  openGraph: {
    title: "Agent Registry — Sovereign Matrix",
    description:
      "The first production-grade agent identity registry. Verify any agent's manifest locally — Sovereign is not a required trust anchor.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
