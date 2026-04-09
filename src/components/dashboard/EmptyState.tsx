"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  color?: "emerald" | "cyan" | "violet" | "amber";
}

const COLORS = {
  emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/[0.04]", text: "text-emerald-400", cta: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" },
  cyan: { border: "border-cyan-500/20", bg: "bg-cyan-500/[0.04]", text: "text-cyan-400", cta: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20" },
  violet: { border: "border-violet-500/20", bg: "bg-violet-500/[0.04]", text: "text-violet-400", cta: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20" },
  amber: { border: "border-amber-500/20", bg: "bg-amber-500/[0.04]", text: "text-amber-400", cta: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20" },
};

/**
 * EmptyState — Shown when a dashboard section has no data.
 * Provides a helpful CTA to get the user started.
 */
export function EmptyState({ icon: Icon, title, description, ctaText, ctaHref, color = "emerald" }: EmptyStateProps) {
  const c = COLORS[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-8 rounded-xl border ${c.border} ${c.bg} text-center`}
    >
      <div className={`w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4`}>
        <Icon className={`w-6 h-6 ${c.text}`} />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-neutral-400 mb-4 max-w-xs mx-auto">{description}</p>
      <Link
        href={ctaHref}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-semibold transition-colors ${c.cta}`}
      >
        {ctaText} <ArrowRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
}
