"use client";

/**
 * AgentDossierCard — a single agent row in the Staff Directory.
 *
 * Reads like a personnel file, not a SaaS product card:
 *   - Serial number (No. 047) in the top-left, mono.
 *   - Category label top-right, mono, copper if featured.
 *   - Large initial letter in a bordered square — the "badge".
 *   - Serif name + mono slug stacked beneath.
 *   - Tagline or description in body text, clamped to 3 lines.
 *   - Dotted rule separator.
 *   - Mono stats row with 30-day runs + success rate (blank when the
 *     table has no data yet — honest empty state, not fabricated "0").
 *   - Copper corner fold on hover, subtle card lift, slug colors over.
 *
 * Wraps an anchor to `/agents/{slug}` so the existing SEO-ready detail
 * page is one click away. No drawer/modal here — this is the directory
 * index; the detail page is where deep exploration lives.
 */

import Link from "next/link";
import type { PublicAgent } from "@/lib/agent-catalog";

interface Props {
  agent: PublicAgent;
  /** Zero-based index for display numbering + animation delay calc. */
  index: number;
}

const ANIMATION_DELAY_STEPS = 6;

function serialNumber(i: number): string {
  return String(i + 1).padStart(3, "0");
}

function successPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Short initial letter for the badge. Skips non-alphabetic chars. */
function initialOf(displayName: string): string {
  const first = displayName.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "∗";
}

export function AgentDossierCard({ agent, index }: Props) {
  const hasStats = agent.runs30d > 0;
  // Only the first N cards get staggered entrance animation; after that
  // we'd just be wasting animation frames. The rest fade in together.
  const animationClass =
    index < ANIMATION_DELAY_STEPS
      ? `ed-enter ed-d-${Math.min(index + 1, 8)}`
      : "ed-fade-in";

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className={`group relative block p-6 pb-7 transition-all duration-300 ${animationClass}`}
      style={{
        background: "var(--ed-bg-raised)",
        border: "1px solid var(--ed-rule)",
        borderRadius: "2px",
      }}
    >
      {/* Top strip — serial + category (+ featured star) */}
      <div className="flex items-start justify-between mb-5">
        <span className="ed-caption tracking-[0.14em]">
          No. <span className="ed-mono">{serialNumber(index)}</span>
        </span>
        <span
          className="ed-label"
          style={{ color: agent.featured ? "var(--ed-copper)" : "var(--ed-ink-dim)" }}
        >
          {agent.category}
          {agent.featured && (
            <span className="ml-2" aria-label="Featured">
              ★
            </span>
          )}
        </span>
      </div>

      {/* Badge — large initial letter */}
      <div className="flex items-start gap-5 mb-5">
        <div
          className="flex-shrink-0 w-14 h-14 flex items-center justify-center transition-colors"
          style={{
            border: `1px solid ${agent.featured ? "var(--ed-copper)" : "var(--ed-rule)"}`,
            color: agent.featured ? "var(--ed-copper)" : "var(--ed-ink)",
          }}
        >
          <span className="ed-display text-3xl">{initialOf(agent.displayName)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="ed-display text-2xl leading-tight mb-1" style={{ color: "var(--ed-ink)" }}>
            {agent.displayName}
          </h3>
          <p
            className="ed-mono text-xs tracking-tight truncate transition-colors group-hover:ed-copper"
            style={{ color: "var(--ed-ink-dim)" }}
          >
            {agent.slug}
          </p>
        </div>
      </div>

      {/* Body — tagline or description, clamped */}
      <p
        className="ed-body text-[0.95rem] line-clamp-3 mb-6"
        style={{ color: "var(--ed-ink-soft)" }}
      >
        {agent.tagline ??
          agent.description ??
          "A specialized operator on the Sovereign Matrix workforce."}
      </p>

      {/* Dotted separator */}
      <div className="ed-rule-dotted mb-4" />

      {/* Mono stats row */}
      <div className="flex items-baseline justify-between gap-4 ed-caption">
        {hasStats ? (
          <>
            <span>
              <span className="ed-mono" style={{ color: "var(--ed-ink)" }}>
                {agent.runs30d.toLocaleString()}
              </span>
              <span className="ml-1">runs · 30d</span>
            </span>
            <span>
              pass{" "}
              <span
                className="ed-mono"
                style={{
                  color: agent.successRate >= 0.9 ? "var(--ed-copper)" : "var(--ed-ink)",
                }}
              >
                {successPercent(agent.successRate)}
              </span>
            </span>
          </>
        ) : (
          // Honest empty state: we don't fabricate "0 runs, 100% success".
          // The dotted rule suggests "metrics pending" visually.
          <span>
            metrics pending —{" "}
            <span className="ed-mono">first run &gt; 30 days ago</span>
          </span>
        )}
      </div>

      {/* Copper corner fold on hover — subtle, 6px */}
      <span
        className="absolute top-0 right-0 w-0 h-0 transition-all duration-300 opacity-0 group-hover:opacity-100"
        style={{
          borderTop: "12px solid var(--ed-copper)",
          borderLeft: "12px solid transparent",
        }}
        aria-hidden="true"
      />
    </Link>
  );
}
