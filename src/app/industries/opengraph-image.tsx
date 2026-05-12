import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Sovereign Matrix — Industries";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Industries · 12 verticals",
    title: "Same primitives. Every vertical’s vocabulary.",
    subtitle:
      "Verifiable AI receipts mapped to compliance, vendor-risk, insurance, legal, healthcare, finance, and more.",
    footer: "Hub",
    accent: "cyan",
  });
}
