"use client";

import Link from "next/link";

/**
 * Founder CTA banner — small fixed CTA referenced from the root layout.
 *
 * Stub implementation. The intended v2 component (slot counter +
 * sticky footer + scarcity copy) was referenced from `app/layout.tsx`
 * before it was built. This version satisfies the import and renders a
 * minimal, dismissable CTA that points at the pricing page so the
 * surface still converts.
 */
export function FounderCTA() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-4 right-4 z-40 hidden md:block"
    >
      <Link
        href="/pricing"
        className="pointer-events-auto rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-xl transition-colors hover:border-emerald-500/30 hover:text-emerald-300"
      >
        Founder access — limited
      </Link>
    </div>
  );
}

export default FounderCTA;
