"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Quote, Sparkles } from "lucide-react";

interface RealWin {
  slug: string;
  company: string;
  industry: string | null;
  outcome: string;
  metric: string;
  playbook: string;
  publishedAt: Date | null;
}

interface Props {
  wins: RealWin[];
}

/**
 * Renders DB-backed customer wins above the curated examples. Pure
 * presentation — RSC parent does the data load. Animated entry on a
 * stagger so the page doesn't feel static.
 */
export function RealWins({ wins }: Props) {
  if (wins.length === 0) return null;

  return (
    <section className="mb-20">
      <div className="mb-8 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Real customer wins
        </p>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        {wins.length === 1
          ? "1 customer has shared their numbers"
          : `${wins.length} customers have shared their numbers`}
      </h2>
      <p className="text-sm text-neutral-400 mb-8 max-w-2xl">
        Every entry here is a real Sovereign deployment with the company&apos;s
        explicit approval. Click through for the full narrative.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {wins.map((win, i) => (
          <motion.div
            key={win.slug}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.45 }}
            className="group rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-6 hover:border-emerald-500/30 transition-colors"
          >
            <Link href={`/case-studies/${win.slug}`} className="block">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">
                    {win.industry ?? "Customer"}
                  </p>
                  <h3 className="text-lg font-semibold text-white">
                    {win.company}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-black text-emerald-400 leading-none">
                    {win.metric}
                  </div>
                </div>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed mb-4">
                <Quote className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5 text-emerald-400/60" />
                {win.outcome}
              </p>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-3 border-t border-white/[0.05]">
                <span>
                  Playbook ·{" "}
                  <span className="text-neutral-300">{win.playbook}</span>
                </span>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  Read it →
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
