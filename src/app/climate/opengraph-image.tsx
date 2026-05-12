import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt =
  "Emissions numbers your auditor will sign off on — Sovereign Matrix";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Climate · Assurance-ready",
    title: "Emissions numbers your auditor will sign off on.",
    subtitle:
      "CSRD. SEC climate rule. GHG Protocol. ISSB. Every calculation signed, replayable, independently verifiable.",
    footer: "Climate",
    accent: "cyan",
  });
}
