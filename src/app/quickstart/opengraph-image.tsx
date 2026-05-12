import { ogCard, ogSize } from "@/lib/og-card";

export const runtime = "nodejs";
export const alt =
  "Sovereign Matrix Quickstart — Zero to verified in 5 minutes";
export const size = ogSize();
export const contentType = "image/png";

export default function OGImage() {
  return ogCard({
    eyebrow: "Quickstart · 5 minutes",
    title: "Zero to verified, in five minutes.",
    subtitle:
      "Sign up · run an agent · share the receipt · install the verifier. Five steps, every one copy-paste-runnable.",
    footer: "Guide",
    accent: "cyan",
  });
}
