import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Incidents — Live platform event log | Sovereign Matrix",
  description:
    "Public, tamper-evident incidents feed. Every entry is part of a SHA-256 hash-chained audit log; tampering is detected within 6 hours by the verify-chain cron.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
