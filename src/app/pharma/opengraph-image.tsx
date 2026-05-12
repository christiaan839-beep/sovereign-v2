import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Clinical-trial-grade AI receipts — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Life Sciences · GxP-ready",
    title: "Clinical-trial-grade AI receipts.",
    subtitle:
      "21 CFR Part 11. ICH-GCP. GxP. ALCOA+. Every agent output signed, time-stamped, replayable.",
    footer: "Pharma",
    accent: "cyan",
  });
}
