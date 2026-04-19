import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nexus Protocol — Sovereign Matrix",
  description:
    "Four frontier models race in parallel. Nemotron, Qwen, Mistral, and DeepSeek answer simultaneously — Gemini synthesizes the one answer that survives.",
  openGraph: {
    title: "Nexus Protocol — Four frontier models, thinking in parallel",
    description: "Live multi-model consensus. Watch four 200B+ parameter models answer one question simultaneously.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Protocol — Sovereign Matrix",
    description: "Four frontier models race in parallel. Live consensus synthesis.",
  },
};

export default function NexusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
