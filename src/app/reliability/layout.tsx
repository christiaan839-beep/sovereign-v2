import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reliability — Live platform health evidence | Sovereign Matrix",
  description:
    "Live, machine-readable evidence of platform reliability. 30-day uptime, anti-drift telemetry, audit-chain verification, and the Project Constitution that bounds every decision.",
  openGraph: {
    title: "Reliability — Live platform health evidence | Sovereign Matrix",
    description:
      "Most platforms hide their reliability story behind sales calls. We publish it. Verify our claims directly: anti-drift invariants, hash-chained audit trail, Project Constitution.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
