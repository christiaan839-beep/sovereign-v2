import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "AI Compliance, Automated — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Compliance · Automated",
    title: "AI compliance, signed at the source.",
    subtitle:
      "SOC 2 evidence packs auto-generated. EU AI Act, POPIA, GDPR audit trails built into every agent run.",
    footer: "Vanta-for-AI",
    accent: "cyan",
  });
}
