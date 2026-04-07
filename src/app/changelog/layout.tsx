import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog — Product Updates | Sovereign Matrix",
  description: "Latest updates, new features, and improvements to the Sovereign Matrix platform.",
  openGraph: {
    title: "Changelog — Product Updates | Sovereign Matrix",
    description: "Latest updates, new features, and improvements to the Sovereign Matrix platform.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
