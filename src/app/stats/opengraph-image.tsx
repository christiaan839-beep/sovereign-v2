import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Platform stats — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Stats · Public",
    title: "Every receipt, counted.",
    subtitle:
      "Lifetime signed-receipt count, public-receipt count, last-24h activity. Aggregate only — no PII.",
    footer: "Aggregate",
    accent: "cyan",
  });
}
