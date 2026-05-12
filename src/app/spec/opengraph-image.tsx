import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt = "VAOS 1.0 — Verifiable Agent Output Standard";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "VAOS 1.0 · Open standard",
    title: "Verifiable Agent Output Standard.",
    subtitle:
      "Canonical projection + HMAC-SHA256 + Ed25519 + Merkle inclusion + OpenTimestamps. CC0 spec, MIT verifier.",
    footer: "Open standard",
    accent: "cyan",
  });
}
