import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "Public Verification API — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "API · OpenAPI 3.1",
    title: "Public verification API.",
    subtitle:
      "Five endpoints. Open CORS. No API key required. Postman + Insomnia + Bruno collections — one-click import.",
    footer: "Spec",
    accent: "cyan",
  });
}
