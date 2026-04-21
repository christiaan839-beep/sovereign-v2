"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * AgentCard — shared card used by /marketplace grid, /leaderboard rows
 * (as a detail modal), and anywhere a single agent is surfaced.
 *
 * Two variants:
 *   - default  : compact grid card
 *   - featured : top-row, bigger, copper-accented
 *
 * Clicking navigates to /agents/[slug] so the drawer/page pattern works
 * from anywhere the card is used. Install happens on the detail page
 * (or via the /world drawer) — cards stay passive to keep keyboard nav
 * simple (no nested interactive controls).
 */

export interface CardAgent {
  slug: string;
  displayName: string;
  tagline: string | null;
  description: string | null;
  category: string;
  heroColor: string | null;
  pricingCents: number;
  featured: boolean;
  verified: boolean;
  runs30d: number;
  successRate: number;
  creatorHandle?: string | null;
}

interface Props {
  agent: CardAgent;
  variant?: "default" | "featured";
  index?: number; // for staggered entrance
}

export function AgentCard({ agent, variant = "default", index = 0 }: Props) {
  if (variant === "featured") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          href={`/agents/${agent.slug}`}
          className="group relative block h-full p-6 rounded-[6px] border border-[#B5532C]/25 bg-white/[0.025] hover:border-[#B5532C]/55 hover:bg-[#B5532C]/[0.04] transition-all duration-300 overflow-hidden"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)" }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[6px]"
            style={{ background: "linear-gradient(to right, rgba(181,83,44,0.85), rgba(181,83,44,0.15))" }}
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "radial-gradient(circle at 20% 0%, rgba(181,83,44,0.14) 0%, transparent 50%)" }}
          />

          <div className="relative flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#B5532C]/15 border border-[#B5532C]/30 text-[10px] font-mono text-[#B5532C] tracking-[0.1em] uppercase">
              Featured
            </span>
            <span className="text-[10px] font-mono text-neutral-500 tracking-wide capitalize">
              {agent.category}
            </span>
          </div>

          <h3 className="relative font-serif text-[22px] text-white mb-1.5 leading-tight tracking-tight">
            {agent.displayName}
          </h3>
          {agent.tagline && (
            <p className="relative text-[12.5px] text-[#B5532C] font-mono mb-3 tracking-tight">
              {agent.tagline}
            </p>
          )}
          {agent.description && (
            <p className="relative text-[13px] text-neutral-400 leading-[1.6] mb-5 line-clamp-3">
              {agent.description}
            </p>
          )}

          <div className="relative flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-neutral-600 tracking-wide">
                {formatRuns(agent.runs30d)} runs · {Math.round(agent.successRate * 100)}% success
              </span>
              {agent.creatorHandle && (
                <span className="text-[10px] font-mono text-neutral-700 tracking-wide">
                  by {agent.creatorHandle}
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-neutral-500 group-hover:text-[#B5532C] transition-colors tracking-wide">
              Open →
            </span>
          </div>
        </Link>
      </motion.div>
    );
  }

  // Default compact card
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (index % 24) * 0.022, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/agents/${agent.slug}`}
        className="group relative flex flex-col h-full p-4 rounded-[6px] border border-white/[0.06] bg-white/[0.025] hover:border-[#B5532C]/30 hover:bg-[#B5532C]/[0.03] transition-all duration-250 overflow-hidden"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4)" }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
          style={{ background: "radial-gradient(circle at 30% 0%, rgba(181,83,44,0.1) 0%, transparent 45%)" }}
        />

        <div className="relative flex items-start justify-between mb-2">
          <span className="text-[9px] font-mono text-neutral-600 tracking-[0.15em] uppercase">
            {agent.category}
          </span>
          {agent.verified && (
            <span
              aria-label="Verified"
              className="text-[#B5532C] text-[10px]"
              title="Verified by Sovereign Matrix"
            >
              ◆
            </span>
          )}
        </div>

        <h3 className="relative font-serif text-[16px] text-white leading-tight tracking-tight mb-1 line-clamp-2">
          {agent.displayName}
        </h3>

        {agent.tagline && (
          <p className="relative text-[11px] text-neutral-500 leading-snug mb-3 line-clamp-2">
            {agent.tagline}
          </p>
        )}

        <div className="relative mt-auto flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <span className="text-[10px] font-mono text-neutral-600 tracking-tight tabular-nums">
            {formatRuns(agent.runs30d)}
          </span>
          <span className="text-[10px] font-mono text-neutral-600 tracking-tight">
            {agent.pricingCents === 0 ? "free" : `$${(agent.pricingCents / 100).toFixed(2)}`}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function formatRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
