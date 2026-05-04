"use client";

import Link from "next/link";

/**
 * FounderCTA — persistent floating CTA visible in the global layout.
 * Tracked via cta-track ("FounderCTA" surface) for launch-week analysis.
 * Hidden inside the dashboard / portal layouts where it would be noise.
 */
export function FounderCTA() {
  return (
    <Link
      href="/pricing"
      data-cta="FounderCTA"
      className="fixed bottom-5 right-5 z-40 hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-black text-xs font-semibold tracking-wide shadow-lg shadow-emerald-500/20 backdrop-blur transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-black/70" />
      Claim founder access
    </Link>
  );
}
