import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Verified-receipt live demo — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Verified · Live demo",
    title: "See a receipt verify itself.",
    subtitle:
      "Real HMAC-SHA256 round-trip against /api/verify. Tamper one byte, watch the signature reject.",
    footer: "Demo",
    accent: "cyan",
  });
}
