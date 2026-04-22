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
    <section className="editorial-dark px-6 py-24 md:py-28 border-t"
             style={{ background: "var(--ed-bg)", borderColor: "var(--ed-rule)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex items-center gap-4 flex-wrap">
          <p className="ed-label" style={{ color: "var(--ed-copper)" }}>
            Section 08 · Shape of the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 md:gap-20">
          {/* Left column — scale metrics */}
          <div>
            <h2 className="ed-display text-3xl md:text-4xl leading-tight mb-10"
                style={{ color: "var(--ed-ink)" }}>
              The scale.
            </h2>
            <div className="grid grid-cols-2 gap-y-10 gap-x-4">
              {SCALE_METRICS.map((m) => (
                <Link
                  key={m.label}
                  href={m.href}
                  className="group block transition-colors"
                >
                  <div className="ed-display text-5xl md:text-6xl leading-none mb-3 tabular-nums transition-colors"
                       style={{ color: "var(--ed-ink)" }}>
                    {m.n}
                  </div>
                  <div className="ed-mono text-[12px] mb-2 tracking-tight transition-colors group-hover:text-[var(--ed-copper)]"
                       style={{ color: "var(--ed-ink-soft)" }}>
                    {m.label}
                  </div>
                  <div className="ed-caption leading-relaxed max-w-[260px]">
                    {m.sub}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right column — industries */}
          <div>
            <h2 className="ed-display text-3xl md:text-4xl leading-tight mb-10"
                style={{ color: "var(--ed-ink)" }}>
              <span className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
                The surface.
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map((ind) => (
                <Link
                  key={ind.label}
                  href={ind.href}
                  className="group flex items-center gap-2.5 px-3 py-2.5 transition-colors"
                  style={{
                    border: "1px solid var(--ed-rule)",
                    background: "var(--ed-bg-raised)",
                    borderRadius: "2px",
                  }}
                >
                  <span
                    className="ed-mono inline-flex items-center justify-center w-6 h-6 text-[9px] tracking-wide flex-shrink-0 transition-colors group-hover:text-[var(--ed-copper)]"
                    style={{
                      border: "1px solid var(--ed-rule)",
                      color: "var(--ed-ink-dim)",
                      borderRadius: "50%",
                    }}
                  >
                    {ind.code}
                  </span>
                  <span
                    className="text-[12.5px] tracking-tight truncate transition-colors"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {ind.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto ed-mono text-[10px] transition-colors group-hover:text-[var(--ed-copper)]"
                    style={{ color: "var(--ed-ink-dim)" }}
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
            <p className="ed-caption mt-5 leading-relaxed max-w-sm">
              Each vertical has dedicated agents tuned to its regulatory
              requirements, terminology, and output formats.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
