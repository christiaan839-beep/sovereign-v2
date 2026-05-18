import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Trust-chip pill — a single procurement-grade link, rendered as a
 * subtle bordered chip with the brand glyph + hover lift.
 *
 * Two visual variants:
 *   accent="cyan"   → standards layer (the immortal stuff)
 *   accent="copper" → live surfaces (clickable evidence)
 *
 * External links get an ArrowUpRight icon and open in a new tab.
 * Internal links navigate in-place. Both honor focus-visible per
 * the WCAG 2.4.7 rule documented in CLAUDE.md.
 */

interface ChipProps {
  href: string;
  label: string;
  accent: "cyan" | "copper";
  external?: boolean;
}

function Chip({ href, label, accent, external }: ChipProps) {
  const dotClass =
    accent === "cyan"
      ? "bg-cyan-500/70 group-hover:bg-cyan-400"
      : "bg-[#E08558]/70 group-hover:bg-[#E08558]";
  const ringClass =
    accent === "cyan"
      ? "border-white/[0.08] hover:border-cyan-500/30 hover:bg-cyan-500/[0.04]"
      : "border-white/[0.08] hover:border-[#B5532C]/30 hover:bg-[#B5532C]/[0.04]";

  const className = `group inline-flex items-center gap-2 px-3 py-1.5 border ${ringClass} bg-white/[0.015] rounded-full font-mono text-[11px] text-neutral-400 hover:text-white transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40`;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full transition-colors ${dotClass}`}
      />
      <span>{label}</span>
      {external && (
        <ArrowUpRight
          className="w-3 h-3 text-neutral-600 group-hover:text-neutral-300 transition-colors"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

const STANDARDS = [
  { href: "/spec", label: "VAOS 1.0 · 2.0 · 3.0", external: false },
  {
    href: "https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts",
    label: "OSS toolkit (Apache-2.0)",
    external: true,
  },
  {
    href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/draft-dewet-vaos-receipts-00.md",
    label: "IETF Internet-Draft",
    external: true,
  },
  {
    href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/WHITEPAPER.md",
    label: "Whitepaper",
    external: true,
  },
  { href: "/vaos", label: "Adoption registry", external: false },
] as const;

const LIVE = [
  { href: "/transparency", label: "Transparency log" },
  { href: "/transparency/verify", label: "In-browser verifier" },
  { href: "/security/live", label: "Security posture" },
  { href: "/diff", label: "Receipt diff" },
  { href: "/pilot", label: "Pilot" },
  { href: "/auditor/replay", label: "Auditor replay" },
] as const;

export function TrustChips() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-mono text-neutral-600 tracking-[0.25em] uppercase mb-2 text-center">
          Standards layer
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {STANDARDS.map((c) => (
            <Chip
              key={c.href}
              href={c.href}
              label={c.label}
              accent="cyan"
              external={c.external}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-mono text-neutral-600 tracking-[0.25em] uppercase mb-2 text-center">
          Live surfaces
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {LIVE.map((c) => (
            <Chip key={c.href} href={c.href} label={c.label} accent="copper" />
          ))}
        </div>
      </div>
    </div>
  );
}
