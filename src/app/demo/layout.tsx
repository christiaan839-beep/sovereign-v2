import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Demo — Watch AI Agents Work | Sovereign Matrix",
  description: "Try Sovereign Matrix live. Watch AI agents find leads, write content, and analyze competitors in real-time.",
  openGraph: {
    title: "Live Demo — Watch AI Agents Work | Sovereign Matrix",
    description: "Try Sovereign Matrix live. Watch AI agents find leads, write content, and analyze competitors in real-time.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
