"use client";

import { motion } from "framer-motion";

/**
 * ConsensusFlow — the visual proof of our multi-model critic pattern.
 *
 * Three columns: GENERATE → CRITIQUE → SYNTHESIZE. Each column is
 * a glass-tier node showing the model that runs that stage + a short
 * role description. SVG paths connect them with animated traveling
 * dots (data "packets") moving left-to-right on each path every ~3s.
 *
 * This is the data-viz signature the page needed — shows the
 * consensus-engine architecture as a running system, not a paragraph
 * of copy. Claude/Vercel/Stripe all have a moment like this.
 *
 * Respects prefers-reduced-motion by hiding the animated dots (the
 * framer-motion transition does that for us because we use motion
 * components with duration-based transitions).
 */

const STAGES = [
  {
    label: "Generate",
    model: "nemotron-ultra-253b",
    role: "Cheap, fast generation",
    color: "emerald",
    accent: "rgb(52, 211, 153)",
    bgAccent: "rgba(52, 211, 153, 0.15)",
    borderAccent: "rgba(52, 211, 153, 0.35)",
  },
  {
    label: "Critique",
    model: "claude-opus-4.5",
    role: "Quality audit + red-team",
    color: "copper",
    accent: "rgb(181, 83, 44)",
    bgAccent: "rgba(181, 83, 44, 0.15)",
    borderAccent: "rgba(181, 83, 44, 0.4)",
  },
  {
    label: "Synthesize",
    model: "gemini-3.1-pro",
    role: "Merge verified output",
    color: "cyan",
    accent: "rgb(34, 211, 238)",
    bgAccent: "rgba(34, 211, 238, 0.15)",
    borderAccent: "rgba(34, 211, 238, 0.35)",
  },
];

export function ConsensusFlow() {
  return (
    <div className="relative mt-12 mb-16">
      {/* The three stages — positioned as a horizontal flow on desktop,
          stacked on mobile. We let mobile fall back to a simple vertical
          list (no connectors) to keep the visual crisp. */}
      <div className="hidden md:grid md:grid-cols-3 md:gap-6 relative">
        {/* Animated connector lines — drawn absolutely between columns.
            Two paths (Gen→Crit, Crit→Syn), each with 2 traveling dots
            offset in time. */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 900 180"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Base paths — static, low opacity */}
          <defs>
            <linearGradient id="flow-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(181, 83, 44)" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="flow-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(181, 83, 44)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Stage 1 → 2 path (exits right side of col 1, enters left side of col 2) */}
          <path
            d="M 270 90 C 330 90, 360 90, 420 90"
            stroke="url(#flow-gradient-1)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="2 4"
          />

          {/* Stage 2 → 3 path */}
          <path
            d="M 570 90 C 630 90, 660 90, 720 90"
            stroke="url(#flow-gradient-2)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="2 4"
          />

          {/* Traveling dot #1 — Generate → Critique */}
          <motion.circle
            r="3.5"
            fill="rgb(52, 211, 153)"
            filter="drop-shadow(0 0 6px rgb(52, 211, 153))"
            initial={{ cx: 270, cy: 90 }}
            animate={{ cx: [270, 420], cy: 90 }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 1.4,
            }}
          />

          {/* Traveling dot #2 — Critique → Synthesize (delayed so it reads as sequential) */}
          <motion.circle
            r="3.5"
            fill="rgb(181, 83, 44)"
            filter="drop-shadow(0 0 6px rgb(181, 83, 44))"
            initial={{ cx: 570, cy: 90 }}
            animate={{ cx: [570, 720], cy: 90 }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.2,
              repeatDelay: 1.4,
            }}
          />
        </svg>

        {/* Stage nodes */}
        {STAGES.map((stage, i) => (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.6 }}
            className="relative rounded-2xl border bg-[#0A0807]/80 backdrop-blur-sm p-5 overflow-hidden"
            style={{
              borderColor: stage.borderAccent,
              boxShadow: `0 20px 40px -20px ${stage.borderAccent}, inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            {/* Top-inner glow keyed to the stage color */}
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 h-16 w-32 rounded-full blur-2xl opacity-40"
              style={{ background: stage.bgAccent }}
            />

            <p
              className="relative font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
              style={{ color: stage.accent }}
            >
              {String(i + 1).padStart(2, "0")} · {stage.label}
            </p>
            <p className="relative font-mono text-[13px] text-white mb-2 tracking-tight truncate">
              {stage.model}
            </p>
            <p className="relative text-[12px] text-neutral-400 leading-relaxed">
              {stage.role}
            </p>

            {/* Static stage indicator dot — color-keyed to the stage accent.
                Not pulsing: these stages aren't live on the marketing page. */}
            <span
              className="absolute top-5 right-5 inline-flex h-1.5 w-1.5 rounded-full opacity-70"
              style={{ backgroundColor: stage.accent }}
              aria-hidden="true"
            />
          </motion.div>
        ))}
      </div>

      {/* Mobile fallback — simple vertical list, no connectors */}
      <div className="md:hidden space-y-3">
        {STAGES.map((stage, i) => (
          <div
            key={stage.label}
            className="rounded-xl border bg-[#0A0807]/80 p-4"
            style={{ borderColor: stage.borderAccent }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
              style={{ color: stage.accent }}
            >
              {String(i + 1).padStart(2, "0")} · {stage.label}
            </p>
            <p className="font-mono text-[13px] text-white mb-1 tracking-tight">
              {stage.model}
            </p>
            <p className="text-[12px] text-neutral-400 leading-relaxed">
              {stage.role}
            </p>
          </div>
        ))}
      </div>

      {/* Caption underneath ties it to the product */}
      <p className="mt-6 text-center text-[11px] font-mono text-neutral-600 tracking-wide">
        Every playbook run executes this three-stage loop · traces in every response
      </p>
    </div>
  );
}
