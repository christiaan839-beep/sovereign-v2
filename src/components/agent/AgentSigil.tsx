/**
 * AgentSigil — React wrapper around the deterministic SVG generator.
 *
 * Server-safe (works in RSC), no "use client" directive.
 *
 * Uses an <img> with a data:image/svg+xml URL instead of inline SVG.
 * Benefits:
 *   - No XSS surface — the SVG payload is behind an image URL, never
 *     interpreted as DOM.
 *   - Browser-cacheable by data-URL hash.
 *   - Image renders at native resolution thanks to SVG's vector nature.
 *
 * Usage:
 *   <AgentSigil slug="fnol-intake" category="Insurance" size={64} />
 *
 * Memoization: module-level Map keyed by (slug, category, size, detail).
 * Generator is cheap (~200µs) but saves the repeat URI encoding for
 * directories rendering hundreds of sigils.
 */

import { agentSigilDataUrl, type SigilOptions } from "@/lib/agent-sigil";

interface Props extends SigilOptions {
  slug: string;
  className?: string;
  /** Optional alt override. Defaults to "<slug> agent sigil". */
  alt?: string;
}

const cache = new Map<string, string>();

function getSigilUrl(slug: string, opts: SigilOptions): string {
  const key = `${slug}|${opts.category ?? ""}|${opts.size ?? 64}|${opts.detail ?? "normal"}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = agentSigilDataUrl(slug, opts);
    cache.set(key, hit);
  }
  return hit;
}

export function AgentSigil({ slug, className, alt, ...opts }: Props) {
  const src = getSigilUrl(slug, opts);
  const size = opts.size ?? 64;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG data URLs
    // don't benefit from Next's <Image> optimization (nothing to resize,
    // no remote fetch). Plain <img> is the simplest correct choice here.
    <img
      src={src}
      alt={alt ?? `${slug} agent sigil`}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
