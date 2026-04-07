import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Chat — Talk to 130+ Agents | Sovereign Matrix",
  description: "Chat with 130+ specialized AI agents. Get leads, write content, analyze competitors — all from one conversation.",
  openGraph: {
    title: "AI Chat — Talk to 130+ Agents | Sovereign Matrix",
    description: "Chat with 130+ specialized AI agents. Get leads, write content, analyze competitors — all from one conversation.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
