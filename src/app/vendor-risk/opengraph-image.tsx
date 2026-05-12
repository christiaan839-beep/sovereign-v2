import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Survive every security questionnaire — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Vendor Risk · Procurement-ready",
    title: "Survive every security questionnaire.",
    subtitle:
      "One URL paste = answers to 80% of standard procurement asks. Live primitives, not a glossy PDF.",
    footer: "Procurement",
    accent: "cyan",
  });
}
