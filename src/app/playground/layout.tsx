import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Playground — Test Any Model | Sovereign Matrix",
  description: "Test 20 AI models side by side. Compare outputs, latency, and quality across NVIDIA, Google, Anthropic, and more.",
  openGraph: {
    title: "AI Playground — Test Any Model | Sovereign Matrix",
    description: "Test 20 AI models side by side. Compare outputs, latency, and quality across NVIDIA, Google, Anthropic, and more.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
