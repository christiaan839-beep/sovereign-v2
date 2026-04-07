import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Sovereign Matrix",
  description: "How Sovereign Matrix handles your data, privacy rights, and security practices.",
  openGraph: {
    title: "Privacy Policy | Sovereign Matrix",
    description: "How Sovereign Matrix handles your data, privacy rights, and security practices.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
