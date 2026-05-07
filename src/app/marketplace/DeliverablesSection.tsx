"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Target,
  PenTool,
  Search,
  Phone,
  Shield,
  Brain,
  Workflow,
  Mail,
  ArrowRight,
  Clock,
  Zap,
} from "lucide-react";
import { DELIVERABLES, type Deliverable } from "@/lib/marketplace-deliverables";

/**
 * Buyer-outcome tiles — what the platform DOES for a business, presented
 * before the technology-grouped agent grid. Reframes the marketplace
 * from "browse 137 agents" to "pick the deliverable, the agents come
 * with it."
 */

const ICONS = {
  Target,
  PenTool,
  Search,
  Phone,
  Shield,
  Brain,
  Workflow,
  Mail,
};

const PALETTE = {
  emerald: {
    bg: "bg-emerald-500/[0.04]",
    border: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
    text: "text-emerald-400",
    badge: "bg-emerald-500/10",
  },
  violet: {
    bg: "bg-violet-500/[0.04]",
    border: "border-violet-500/20",
    hoverBorder: "hover:border-violet-500/40",
    text: "text-violet-400",
    badge: "bg-violet-500/10",
  },
  amber: {
    bg: "bg-amber-500/[0.04]",
    border: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
    text: "text-amber-400",
    badge: "bg-amber-500/10",
  },
  pink: {
    bg: "bg-pink-500/[0.04]",
    border: "border-pink-500/20",
    hoverBorder: "hover:border-pink-500/40",
    text: "text-pink-400",
    badge: "bg-pink-500/10",
  },
  cyan: {
    bg: "bg-cyan-500/[0.04]",
    border: "border-cyan-500/20",
    hoverBorder: "hover:border-cyan-500/40",
    text: "text-cyan-400",
    badge: "bg-cyan-500/10",
  },
  indigo: {
    bg: "bg-indigo-500/[0.04]",
    border: "border-indigo-500/20",
    hoverBorder: "hover:border-indigo-500/40",
    text: "text-indigo-400",
    badge: "bg-indigo-500/10",
  },
} as const;

function DeliverableCard({
  deliverable,
  index,
}: {
  deliverable: Deliverable;
  index: number;
}) {
  const Icon = ICONS[deliverable.icon];
  const palette = PALETTE[deliverable.palette];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
      id={deliverable.slug}
      className={`group rounded-2xl border ${palette.border} ${palette.bg} ${palette.hoverBorder} p-7 transition-colors`}
    >
      <header className="flex items-start justify-between gap-4 mb-5">
        <div
          className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${palette.badge} ${palette.text}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span
          className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${palette.badge} ${palette.text}`}
        >
          {deliverable.tier}+
        </span>
      </header>

      <h3 className="text-xl font-bold text-white mb-2 leading-tight">
        {deliverable.outcome}
      </h3>
      <p className="text-sm text-neutral-400 leading-relaxed mb-5">
        {deliverable.promise}
      </p>

      <div className="space-y-2 mb-6 text-[12px]">
        <div className="flex items-center gap-2 text-neutral-300">
          <Zap className={`w-3.5 h-3.5 ${palette.text} shrink-0`} />
          <span className="font-mono">{deliverable.metric}</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-500">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono">{deliverable.timeToFirst}</span>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">
          Agents in the stack
        </p>
        <div className="flex flex-wrap gap-1.5">
          {deliverable.agents.map((slug) => (
            <Link
              key={slug}
              href={`/marketplace/${slug}`}
              className="text-[11px] font-mono px-2 py-1 rounded bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              {slug}
            </Link>
          ))}
        </div>
      </div>

      <Link
        href={`/dashboard?stack=${deliverable.slug}`}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${palette.text} group-hover:translate-x-0.5 transition-transform`}
      >
        Run this stack
        <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.article>
  );
}

export function DeliverablesSection() {
  return (
    <section className="px-6 pb-20" id="deliverables">
      <div className="max-w-7xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 max-w-3xl"
        >
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
            Pick the outcome
          </p>
          <h2 className="font-serif text-3xl md:text-5xl text-white mb-5 tracking-[-0.02em] leading-[1.05]">
            What do you want{" "}
            <em className="not-italic text-[#B5532C]">delivered</em>?
          </h2>
          <p className="text-[15px] md:text-[17px] text-neutral-400 leading-[1.55]">
            Six pre-composed stacks — each is a real business outcome, not a
            tutorial. Pick one and the agents that deliver it run together. Or
            scroll down to browse all 137 agents individually.
          </p>
        </motion.header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DELIVERABLES.map((d, i) => (
            <DeliverableCard key={d.slug} deliverable={d} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
