import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * SOVEREIGN MATRIX — `/immersive` route metadata (Wave 122).
 *
 * The page itself is `"use client"` (Three.js + sticky-scroll + hooks)
 * so metadata lives here in the layout. Next.js merges this with the
 * sibling `opengraph-image.tsx` to produce the og:image + twitter:image
 * meta tags automatically.
 */
export const metadata: Metadata = {
  title: "Immersive — A Verifiable Interface · Sovereign Matrix",
  description:
    "The cinematic trailer for the verification layer for AI. Three-section sticky-scroll: A Verifiable Interface · Every Output, Provable · Enter the Audit Grade. Built on the same receipt fabric every Sovereign agent runs on.",
  alternates: { canonical: "/immersive" },
  openGraph: {
    title: "Sovereign Matrix — A Verifiable Interface",
    description:
      "Every agent output ships with a signed receipt. ML-DSA-65, post-quantum, on every run.",
    type: "website",
    url: "/immersive",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign Matrix — A Verifiable Interface",
    description: "The verification layer for AI. Receipts, not promises.",
  },
};

export default function ImmersiveLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
