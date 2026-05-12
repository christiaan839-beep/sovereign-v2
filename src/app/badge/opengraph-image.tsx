import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Verification badge builder — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Badge · Embed builder",
    title: "One line. Verified everywhere.",
    subtitle:
      "Paste a receipt id, copy the snippet. The Sovereign Verified stamp lives on your site, customers verify in one click.",
    footer: "Embed",
    accent: "cyan",
  });
}
