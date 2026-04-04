import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whitepaper — The Autonomous Agent Architecture | Sovereign Matrix",
  description: "Technical whitepaper covering NVIDIA NIM integration, 5-layer NeMo Guardrails, multi-agent consensus verification, and open-source LLM economics at scale.",
  alternates: { canonical: "https://sovereignmatrix.agency/whitepaper" },
  openGraph: {
    title: "Whitepaper — Sovereign Matrix Architecture",
    description: "NVIDIA NIM + NeMo Guardrails + multi-agent consensus.",
    url: "https://sovereignmatrix.agency/whitepaper",
    type: "article",
  },
};

export default function WhitepaperLayout({ children }: { children: React.ReactNode }) {
  return children;
}
