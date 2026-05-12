import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Receipt explorer — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Explorer · Live feed",
    title: "Every signed receipt, as it happens.",
    subtitle:
      "Block-explorer-style public feed of HMAC-signed agent runs. Polls every 12 seconds. Proof the platform is alive.",
    footer: "Live feed",
    accent: "cyan",
  });
}
