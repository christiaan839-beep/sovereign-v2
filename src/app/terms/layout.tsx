import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Sovereign Matrix",
  description: "Terms of service for using the Sovereign Matrix AI agent platform.",
  openGraph: {
    title: "Terms of Service | Sovereign Matrix",
    description: "Terms of service for using the Sovereign Matrix AI agent platform.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
