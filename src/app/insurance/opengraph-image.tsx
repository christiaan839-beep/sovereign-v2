import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt =
  "Price AI risk with cryptographic signals — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Insurance · AI E&O",
    title: "Price AI risk with cryptographic signals.",
    subtitle:
      "Per-tenant Merkle root + tamper-evidence + Bitcoin-anchored attestation as an underwriting input.",
    footer: "Carrier-facing",
    accent: "cyan",
  });
}
