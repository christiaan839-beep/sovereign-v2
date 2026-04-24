"use client";

/**
 * PricingCalculator — interactive cost-estimator.
 *
 * WHY
 * ───
 * Enterprise buyers don't want to guess monthly spend. Twilio has this.
 * Stripe has this. Without it, pricing conversations start with "well,
 * how many runs?" and end with "I'll email a custom quote". Calculator
 * turns that into "here's your number, pick the plan that fits".
 *
 * MATH
 * ────
 * Each plan has an included run quota + overage rate. User inputs:
 *   - runs per month
 *   - optional: agent mix (affects A2E credit burn)
 *
 * We show:
 *   - Cheapest plan that covers the volume without overages
 *   - Effective cost/run at that plan
 *   - Overage cost if they stick with the current tier
 *
 * KEEPS HONEST
 * ────────────
 * Numbers come from PLAN_LIMITS + plan prices. No made-up "savings"
 * or "AI valuations" — just the math.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";

interface PlanDef {
  id: string;
  name: string;
  priceUsd: number; // monthly; 0 for free
  includedRuns: number; // per month
  overageCentsPerRun: number; // cost per extra run above includedRuns
  featured?: boolean;
  ctaLabel: string;
  ctaHref: string;
}

// Plan data mirrors src/lib/plans.ts. Duplicated here deliberately —
// pricing UI is marketing copy + lightweight math; the authoritative
// source is PLAN_LIMITS in plans.ts (used for enforcement). If they
// drift, the pricing page's dev-warn check catches it.
const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    includedRuns: 50,
    overageCentsPerRun: 5, // hypothetical; free tier doesn't overage — it blocks
    ctaLabel: "Start free",
    ctaHref: "/signup",
  },
  {
    id: "starter",
    name: "Starter",
    priceUsd: 19,
    includedRuns: 200,
    overageCentsPerRun: 8,
    ctaLabel: "Start for $19",
    ctaHref: "/signup?plan=starter",
  },
  {
    id: "growth",
    name: "Growth",
    priceUsd: 49,
    includedRuns: 500,
    overageCentsPerRun: 6,
    featured: true,
    ctaLabel: "Start for $49",
    ctaHref: "/signup?plan=growth",
  },
  {
    id: "node",
    name: "Sovereign Node",
    priceUsd: 199,
    includedRuns: 2000,
    overageCentsPerRun: 4,
    ctaLabel: "Start for $199",
    ctaHref: "/signup?plan=node",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: 499,
    includedRuns: 10000,
    overageCentsPerRun: 3,
    ctaLabel: "Contact sales",
    ctaHref: "mailto:hello@sovereignmatrix.agency?subject=Enterprise%20Inquiry",
  },
];

/**
 * Find the cheapest plan that covers N runs without overages, and
 * compute the total cost if a user stays on each plan at that volume.
 */
function compute(runs: number): {
  plans: Array<PlanDef & { totalUsd: number; isOverage: boolean; costPerRunCents: number }>;
  recommended: string;
} {
  const enriched = PLANS.map((p) => {
    const overageRuns = Math.max(0, runs - p.includedRuns);
    const overageUsd = (overageRuns * p.overageCentsPerRun) / 100;
    const totalUsd = p.priceUsd + overageUsd;
    const costPerRunCents = runs > 0 ? Math.round((totalUsd * 100) / runs) : 0;
    return {
      ...p,
      totalUsd,
      isOverage: overageRuns > 0,
      costPerRunCents,
    };
  });

  // Cheapest plan that covers volume without overage. Fall back to
  // cheapest-total if every plan has overages.
  const noOverage = enriched.filter((p) => !p.isOverage && p.id !== "free");
  const recommended =
    noOverage.length > 0
      ? noOverage.reduce((a, b) => (a.priceUsd < b.priceUsd ? a : b)).id
      : enriched
          .filter((p) => p.id !== "free")
          .reduce((a, b) => (a.totalUsd < b.totalUsd ? a : b)).id;

  return { plans: enriched, recommended };
}

const PRESET_VOLUMES = [100, 500, 1000, 5000, 20000];

export function PricingCalculator() {
  const [runs, setRuns] = useState<number>(500);
  const { plans, recommended } = useMemo(() => compute(runs), [runs]);

  return (
    <section className="py-20 px-6 border-y border-white/[0.04] bg-[#030303]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-3">
            Cost calculator
          </p>
          <h2 className="ed-display text-3xl md:text-5xl mb-4">
            See what you&apos;ll{" "}
            <span className="ed-display-italic text-[#B5532C]">actually pay.</span>
          </h2>
          <p className="text-neutral-500 text-sm max-w-xl mx-auto">
            Slide to your monthly playbook volume. We&apos;ll show the cheapest plan
            that fits — and what each plan would cost if you exceeded its included runs.
          </p>
        </div>

        {/* Slider + presets */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Monthly playbook runs
            </span>
            <span className="ed-display text-3xl text-white">
              {runs.toLocaleString()}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={30000}
            step={50}
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/[0.08] accent-[#B5532C]"
            aria-label="Runs per month"
          />

          <div className="flex justify-between mt-2 text-[10px] font-mono text-neutral-600">
            <span>0</span>
            <span>30,000</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-4 justify-center">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600">Presets:</span>
            {PRESET_VOLUMES.map((v) => (
              <button
                key={v}
                onClick={() => setRuns(v)}
                className={`px-3 py-1 rounded-full text-[11px] font-mono transition-colors ${
                  runs === v
                    ? "bg-[#B5532C] text-white"
                    : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]"
                }`}
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Plan comparison */}
        <div className="grid md:grid-cols-5 gap-3">
          {plans.map((p) => {
            const isRecommended = p.id === recommended;
            return (
              <motion.div
                key={p.id}
                layout
                className={`relative p-4 rounded-[6px] border transition-all ${
                  isRecommended
                    ? "border-[#B5532C]/40 bg-[#B5532C]/[0.04]"
                    : "border-white/[0.06] bg-[#060606]"
                }`}
              >
                {isRecommended && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#B5532C] text-[9px] font-semibold uppercase tracking-wider text-white">
                    <Sparkles className="w-2.5 h-2.5" />
                    Best fit
                  </span>
                )}
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                  {p.name}
                </p>
                <p className="ed-display text-2xl text-white leading-none mb-2">
                  {p.priceUsd === 0 ? "Free" : `$${p.priceUsd}`}
                </p>
                <p className="text-[10px] text-neutral-500 mb-3">
                  {p.includedRuns.toLocaleString()} runs included
                </p>
                <div className="pt-3 border-t border-white/[0.04] space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-neutral-600">You&apos;d pay</span>
                    <span
                      className={`font-mono text-sm ${
                        p.isOverage ? "text-amber-400" : "text-white"
                      }`}
                    >
                      ${p.totalUsd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-neutral-600">Effective /run</span>
                    <span className="font-mono text-[11px] text-neutral-400">
                      {runs === 0 ? "—" : `${p.costPerRunCents}¢`}
                    </span>
                  </div>
                  {p.isOverage && (
                    <p className="text-[9px] font-mono text-amber-400/80 mt-2">
                      ⚠ overage at {p.overageCentsPerRun}¢/run
                    </p>
                  )}
                </div>
                <Link
                  href={p.ctaHref}
                  className={`mt-4 block text-center px-3 py-2 rounded-[3px] text-[11px] font-semibold transition-colors ${
                    isRecommended
                      ? "bg-[#B5532C] hover:bg-[#C96234] text-white"
                      : "bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200"
                  }`}
                >
                  {p.ctaLabel}
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-neutral-500 font-mono">
            <TrendingDown className="inline w-3 h-3 mr-1 text-[#B5532C]" />
            At <span className="text-white">{runs.toLocaleString()}</span> runs/mo,{" "}
            <span className="text-[#B5532C]">
              {plans.find((p) => p.id === recommended)?.name}
            </span>{" "}
            is the cheapest fit at{" "}
            <span className="text-white">
              ${plans.find((p) => p.id === recommended)?.totalUsd.toFixed(2)}/mo
            </span>
            .
          </p>
          <Link
            href="/compare"
            className="mt-4 inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-[#B5532C] transition-colors font-mono"
          >
            How we stack up vs. competitors
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
