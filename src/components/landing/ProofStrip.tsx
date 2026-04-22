"use client";

import Link from "next/link";

/**
 * ProofStrip — consolidates 3 previously-separate sections into one.
 *
 * Replaces:
 *   - PlatformScale   (137 agents / 90+ integrations / 8 providers / 5 verif)
 *   - IndustrySection (8 industry cards)
 *   - StackKiller     (cost displacement — the strongest claim stayed in
 *                      ThreeMoatsGrid; this strip shows the proof numbers)
 *
 * Two-column layout on desktop (stacks on mobile):
 *   Left : scale metrics — hard numbers, each clickable to the
 *          corresponding deep-dive page (/platform, /integrations, /trust).
 *   Right: industry tags — 8 small chips, each linking to its /for-<vertical>
 *          solutions page.
 *
 * No entrance animations (per the redesign spec's "motion strip-back"
 * section). Static render, hover-only micro-interactions.
 */

const SCALE_METRICS = [
  {
    n: "198",
    label: "Agents",
    sub: "18 industries · 84 featured in the public catalog",
    href: "/platform",
  },
  {
    n: "90+",
    label: "Integrations",
    sub: "Slack, HubSpot, Salesforce, Stripe, Notion, Apollo, Hunter",
    href: "/integrations",
  },
  {
    n: "8",
    label: "Model providers",
    sub: "NIM · Claude · Gemini · Groq · Cerebras · Ollama · DeepSeek · Tavily",
    href: "/platform",
  },
  {
    n: "5",
    label: "Verification layers",
    sub: "Jailbreak · PII · content · quality · critic — every run",
    href: "/trust",
  },
] as const;

const INDUSTRIES: ReadonlyArray<{ code: string; label: string; href: string }> = [
  { code: "HC", label: "Healthcare",    href: "/for-healthcare" },
  { code: "LG", label: "Legal",         href: "/for-legal" },
  { code: "AG", label: "Agriculture",   href: "/for-agriculture" },
  { code: "MF", label: "Manufacturing", href: "/for-manufacturing" },
  { code: "CS", label: "Cybersecurity", href: "/for-cybersecurity" },
  { code: "FI", label: "Fintech",       href: "/for-fintech" },
  { code: "RE", label: "Real Estate",   href: "/for-realestate" },
  { code: "GV", label: "Government",    href: "/for-government" },
];

export function ProofStrip() {
  return (
    <section className="px-6 py-20 md:py-24 bg-[#030303] border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            08 / 10
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            the shape of the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          {/* Left column — scale metrics */}
          <div>
            <h2 className="font-serif text-2xl md:text-3xl leading-tight tracking-[-0.02em] mb-8 text-white">
              The scale.
            </h2>
            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
              {SCALE_METRICS.map((m) => (
                <Link
                  key={m.label}
                  href={m.href}
                  className="group block"
                >
                  <div className="font-serif text-4xl md:text-5xl text-white leading-none tracking-[-0.02em] mb-2 group-hover:text-[#E8DDD0] transition-colors tabular-nums">
                    {m.n}
                  </div>
                  <div className="text-[12px] font-medium text-neutral-400 mb-1 tracking-tight">
                    {m.label}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-600 leading-[1.6] max-w-[220px]">
                    {m.sub}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right column — industries */}
          <div>
            <h2 className="font-serif text-2xl md:text-3xl leading-tight tracking-[-0.02em] mb-8 text-white">
              The surface.
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map((ind) => (
                <Link
                  key={ind.label}
                  href={ind.href}
                  className="group flex items-center gap-2.5 px-3 py-2.5 rounded-[4px] border border-white/[0.06] bg-white/[0.015] hover:border-[#B5532C]/30 hover:bg-[#B5532C]/[0.04] transition-colors"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-white/[0.1] text-neutral-500 font-mono text-[9px] tracking-wide group-hover:border-[#B5532C]/40 group-hover:text-[#B5532C] transition-colors flex-shrink-0">
                    {ind.code}
                  </span>
                  <span className="text-[12.5px] text-neutral-300 tracking-tight group-hover:text-white transition-colors truncate">
                    {ind.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto text-[10px] font-mono text-neutral-700 group-hover:text-[#B5532C] transition-colors"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-4 text-[10px] font-mono text-neutral-700 leading-relaxed">
              Each vertical has dedicated agents tuned to its regulatory
              requirements, terminology, and output formats.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
