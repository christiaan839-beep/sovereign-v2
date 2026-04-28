import type { Metadata } from "next";
import { TOTAL_AGENTS, TOTAL_MODELS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: "ROI Calculator — Sovereign Matrix",
  description:
    "See how many hours and dollars Sovereign Matrix saves your business. Replace Apollo, Clay, Jasper, SEMrush, Zapier, Outreach, Clearbit, and n8n with flat-rate pricing.",
  alternates: { canonical: "https://sovereignmatrix.agency/roi" },
  openGraph: {
    title: "Sovereign Matrix ROI — Replace 8 tools, save $516/mo",
    description: `Typical SaaS stack is $715/mo. Sovereign Matrix is flat-rate with ${TOTAL_AGENTS} agents and ${TOTAL_MODELS} models included.`,
    url: "https://sovereignmatrix.agency/roi",
    type: "website",
  },
};

export default function RoiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
