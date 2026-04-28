import type { Metadata } from "next";
import { TOTAL_AGENTS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: `AI Chat — Talk to ${TOTAL_AGENTS} Agents | Sovereign Matrix`,
  description: `Chat with ${TOTAL_AGENTS} specialized AI agents. Get leads, write content, analyze competitors — all from one conversation.`,
  openGraph: {
    title: `AI Chat — Talk to ${TOTAL_AGENTS} Agents | Sovereign Matrix`,
    description: `Chat with ${TOTAL_AGENTS} specialized AI agents. Get leads, write content, analyze competitors — all from one conversation.`,
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
