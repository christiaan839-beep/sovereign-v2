import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status | Sovereign Matrix",
  description: "Current system status and uptime for Sovereign Matrix services and API endpoints.",
  openGraph: {
    title: "System Status | Sovereign Matrix",
    description: "Current system status and uptime for Sovereign Matrix services and API endpoints.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
