import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers — Anonymized platform stats | Sovereign Matrix",
  description:
    "Anonymized live platform statistics — runs, users, success rate, latency. The numbers come from our database, not marketing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
