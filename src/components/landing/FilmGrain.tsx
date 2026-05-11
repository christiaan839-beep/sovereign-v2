"use client";

/**
 * FilmGrain — subtle SVG-noise overlay for cinematic depth.
 *
 * Why this over a PNG: it's pure SVG (~280 bytes inlined), needs no
 * extra HTTP round-trip, scales to any DPR without pixel mush, and
 * the noise seed is deterministic across renders so the grain
 * doesn't shimmer on re-paint.
 *
 * Performance: pointer-events:none and fixed-position keep this off
 * the GPU paint-budget critical path. Opacity is set very low (2.5%)
 * so it reads as analog texture, not visible noise. On
 * prefers-reduced-motion the grain stays static (it never animates
 * to begin with) — no work to do.
 *
 * Usage:
 *   <FilmGrain />
 * Drop once at the page root. Renders behind every section, in front
 * of nothing meaningful — purely atmospheric.
 */

export function FilmGrain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] mix-blend-overlay opacity-[0.025]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.85'/%3E%3C/svg%3E\")",
        backgroundSize: "200px 200px",
      }}
    />
  );
}
