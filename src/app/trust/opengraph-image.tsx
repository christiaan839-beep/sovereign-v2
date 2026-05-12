import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Trust posture — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Trust · Procurement-ready",
    title: "Every claim, independently verifiable.",
    subtitle:
      "SOC 2 / POPIA / GDPR posture, public verifier, sub-processors, audit-bundle export — one URL.",
    footer: "Trust hub",
    accent: "cyan",
  });
}
