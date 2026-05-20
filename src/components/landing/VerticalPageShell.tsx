"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { PrimaryCTA } from "@/components/landing/PrimaryCTA";

/**
 * VerticalPageShell — wave 109.
 *
 * Before: 26 `/for-*` pages each carried ~250 LOC of nearly-identical
 * JSX. The audit found three structural problems shared by all of them:
 *   1. Background was `bg-[#010101]` — wrong per brand-colors.md
 *      (the landing uses `bg-[#030303]`).
 *   2. CTA was a white pill (`bg-white text-black`) — brand-violating;
 *      the marketing surface mandates a copper CTA (`#B5532C`) per
 *      docs/design-system/brand-colors.md.
 *   3. Accent classes used dynamic Tailwind interpolation like
 *      `bg-${cap.color}-500/10` — Tailwind v4 cannot see these at
 *      build time, so the colors silently failed in production. The
 *      accent map below is STATIC so every class is literally present
 *      in the source and survives purge.
 *
 * This shell takes a typed `VerticalConfig` data prop and renders the
 * full marketing page from it. Each vertical page becomes a 30-line
 * config file instead of a 250-line clone. The accent (per-vertical
 * secondary color used on the eyebrow + capability icons) is one of
 * five whitelisted tokens; copper is reserved for the CTA so the
 * brand stays legible across the whole `/for-*` family.
 */

export type VerticalAccent = "cyan" | "amber" | "emerald" | "violet" | "red";

interface AccentSet {
  /** Eyebrow chip background (alpha) */
  chipBg: string;
  /** Eyebrow chip border */
  chipBorder: string;
  /** Eyebrow text */
  chipText: string;
  /** Hero highlight word */
  hero: string;
  /** Section eyebrow label */
  eyebrow: string;
  /** Capability card icon background */
  iconBg: string;
  /** Capability card icon foreground */
  iconFg: string;
  /** Capability card hover border */
  cardHoverBorder: string;
  /** Workflow trigger label */
  workflowLabel: string;
  /** Workflow step number */
  workflowStepNum: string;
  /** Workflow result row background */
  workflowResultBg: string;
  /** Workflow result text */
  workflowResultText: string;
  /** Workflow result icon */
  workflowResultIcon: string;
  /** Architecture grid icon */
  archIcon: string;
}

/**
 * STATIC accent map — every class string is literally present in this
 * source file. Tailwind's content scanner sees them and includes them
 * in the production bundle. Do NOT replace this with template-literal
 * interpolation; the dynamic form gets purged.
 */
const ACCENTS: Record<VerticalAccent, AccentSet> = {
  cyan: {
    chipBg: "bg-cyan-500/[0.06]",
    chipBorder: "border-cyan-500/20",
    chipText: "text-cyan-400",
    hero: "text-cyan-400",
    eyebrow: "text-cyan-500/60",
    iconBg: "bg-cyan-500/10",
    iconFg: "text-cyan-400",
    cardHoverBorder: "hover:border-cyan-500/20",
    workflowLabel: "text-cyan-400",
    workflowStepNum: "text-cyan-500/50",
    workflowResultBg: "bg-cyan-500/[0.02]",
    workflowResultText: "text-cyan-300",
    workflowResultIcon: "text-cyan-400",
    archIcon: "text-cyan-400",
  },
  amber: {
    chipBg: "bg-amber-500/[0.06]",
    chipBorder: "border-amber-500/20",
    chipText: "text-amber-400",
    hero: "text-amber-400",
    eyebrow: "text-amber-500/60",
    iconBg: "bg-amber-500/10",
    iconFg: "text-amber-400",
    cardHoverBorder: "hover:border-amber-500/20",
    workflowLabel: "text-amber-400",
    workflowStepNum: "text-amber-500/50",
    workflowResultBg: "bg-amber-500/[0.02]",
    workflowResultText: "text-amber-300",
    workflowResultIcon: "text-amber-400",
    archIcon: "text-amber-400",
  },
  emerald: {
    chipBg: "bg-emerald-500/[0.06]",
    chipBorder: "border-emerald-500/20",
    chipText: "text-emerald-400",
    hero: "text-emerald-400",
    eyebrow: "text-emerald-500/60",
    iconBg: "bg-emerald-500/10",
    iconFg: "text-emerald-400",
    cardHoverBorder: "hover:border-emerald-500/20",
    workflowLabel: "text-emerald-400",
    workflowStepNum: "text-emerald-500/50",
    workflowResultBg: "bg-emerald-500/[0.02]",
    workflowResultText: "text-emerald-300",
    workflowResultIcon: "text-emerald-400",
    archIcon: "text-emerald-400",
  },
  violet: {
    chipBg: "bg-violet-500/[0.06]",
    chipBorder: "border-violet-500/20",
    chipText: "text-violet-400",
    hero: "text-violet-400",
    eyebrow: "text-violet-500/60",
    iconBg: "bg-violet-500/10",
    iconFg: "text-violet-400",
    cardHoverBorder: "hover:border-violet-500/20",
    workflowLabel: "text-violet-400",
    workflowStepNum: "text-violet-500/50",
    workflowResultBg: "bg-violet-500/[0.02]",
    workflowResultText: "text-violet-300",
    workflowResultIcon: "text-violet-400",
    archIcon: "text-violet-400",
  },
  red: {
    chipBg: "bg-red-500/[0.06]",
    chipBorder: "border-red-500/20",
    chipText: "text-red-400",
    hero: "text-red-400",
    eyebrow: "text-red-500/60",
    iconBg: "bg-red-500/10",
    iconFg: "text-red-400",
    cardHoverBorder: "hover:border-red-500/20",
    workflowLabel: "text-red-400",
    workflowStepNum: "text-red-500/50",
    workflowResultBg: "bg-red-500/[0.02]",
    workflowResultText: "text-red-300",
    workflowResultIcon: "text-red-400",
    archIcon: "text-red-400",
  },
};

/**
 * Public access to the accent map for tests + the per-page configs.
 * Marked Readonly so a future caller can't mutate it at runtime —
 * frozen so the TS-only `Readonly<...>` annotation is backed by a
 * runtime guard. A poisoned accent map would silently corrupt
 * every page rendered after the mutation.
 */
export const ACCENT_TOKENS: Readonly<
  Record<VerticalAccent, Readonly<AccentSet>>
> = Object.freeze({
  cyan: Object.freeze(ACCENTS.cyan),
  amber: Object.freeze(ACCENTS.amber),
  emerald: Object.freeze(ACCENTS.emerald),
  violet: Object.freeze(ACCENTS.violet),
  red: Object.freeze(ACCENTS.red),
});

export interface VerticalCapability {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface VerticalWorkflow {
  trigger: string;
  steps: string[];
  result: string;
}

export interface VerticalArchItem {
  icon: LucideIcon;
  label: string;
  desc: string;
}

export interface VerticalConfig {
  /** URL slug for the vertical (e.g. "real-estate") — informational only */
  slug: string;
  /** Eyebrow label uppercase (e.g. "Real Estate", "Cybersecurity") */
  label: string;
  /** Lucide icon paired with the eyebrow chip */
  EyebrowIcon: LucideIcon;
  /** Per-vertical secondary accent. Copper stays reserved for the CTA. */
  accent: VerticalAccent;
  /** Hero h1 — split into two lines around `<br />`. Pass the second line via heroHighlight. */
  heroLine1: string;
  heroHighlight: string;
  /** One-line description under the hero, max ~120 chars. */
  heroBlurb: string;
  /** Hero CTA label (always copper PrimaryCTA). Default: "Deploy <industry> agents". */
  heroCta?: string;
  /** "Capabilities" section copy. */
  capabilitiesHeadline: string;
  capabilitiesBlurb: string;
  capabilities: VerticalCapability[];
  /** "How It Works" workflow examples. */
  workflowsHeadline: string;
  workflows: VerticalWorkflow[];
  /** "Under The Hood" architecture badges. */
  archItems: VerticalArchItem[];
  /** Final CTA copy. */
  ctaHeadline: string;
  ctaHighlight: string;
  ctaBlurb: string;
}

export function VerticalPageShell({ config }: { config: VerticalConfig }) {
  const a = ACCENTS[config.accent];
  const reduceMotion = useReducedMotion();

  const fadeIn = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-50px" },
      };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Nav */}
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/signup"
          className="px-4 py-1.5 rounded-[3px] bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-neutral-300 hover:bg-white/[0.07] hover:text-white transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${a.chipBorder} ${a.chipBg} mb-6`}
          >
            <config.EyebrowIcon className={`w-3.5 h-3.5 ${a.chipText}`} />
            <span
              className={`text-[11px] font-semibold ${a.chipText} uppercase tracking-[0.2em]`}
            >
              {config.label}
            </span>
          </motion.div>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            {config.heroLine1}
            <br />
            <span className={a.hero}>{config.heroHighlight}</span>
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            {config.heroBlurb}
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <PrimaryCTA href="/signup" variant="hero">
              {config.heroCta ?? `Deploy ${config.label.toLowerCase()} agents`}
            </PrimaryCTA>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p
              className={`text-[11px] font-medium uppercase tracking-[0.3em] ${a.eyebrow} mb-4`}
            >
              Capabilities
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              {config.capabilitiesHeadline}
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              {config.capabilitiesBlurb}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {config.capabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                {...fadeIn}
                transition={reduceMotion ? undefined : { delay: i * 0.08 }}
                className={`p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl transition-all ${a.cardHoverBorder}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl ${a.iconBg} flex items-center justify-center mb-4`}
                >
                  <cap.icon className={`w-5 h-5 ${a.iconFg}`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  {cap.title}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {cap.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p
              className={`text-[11px] font-medium uppercase tracking-[0.3em] ${a.eyebrow} mb-4`}
            >
              How It Works
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              {config.workflowsHeadline}
            </h2>
          </div>

          <div className="space-y-8">
            {config.workflows.map((flow, i) => (
              <motion.div
                key={i}
                {...fadeIn}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#060606]/60">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 ${a.workflowLabel}`}
                    />
                    <span
                      className={`text-[10px] ${a.eyebrow} uppercase tracking-wider font-semibold`}
                    >
                      You say
                    </span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div
                      key={j}
                      className="flex items-start gap-2.5 text-xs text-neutral-400"
                    >
                      <span
                        className={`${a.workflowStepNum} font-mono shrink-0 mt-0.5`}
                      >
                        {String(j + 1).padStart(2, "0")}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>

                <div
                  className={`px-6 py-4 border-t border-white/[0.04] ${a.workflowResultBg}`}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${a.workflowResultIcon} shrink-0 mt-0.5`}
                    />
                    <p className={`text-xs ${a.workflowResultText}`}>
                      {flow.result}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#020202]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p
              className={`text-[11px] font-medium uppercase tracking-[0.3em] ${a.eyebrow} mb-4`}
            >
              Under The Hood
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built on real infrastructure.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {config.archItems.map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl"
              >
                <item.icon className={`w-5 h-5 ${a.archIcon} mb-3`} />
                <div className="text-xs font-semibold text-white mb-0.5">
                  {item.label}
                </div>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            {config.ctaHeadline}
            <br />
            <span className={a.hero}>{config.ctaHighlight}</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            {config.ctaBlurb}
          </p>
          <div className="flex items-center justify-center">
            <PrimaryCTA href="/signup" variant="final">
              Get started free <ArrowRight className="w-4 h-4" />
            </PrimaryCTA>
          </div>
        </div>
      </section>
    </div>
  );
}
