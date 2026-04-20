"use client";

import { motion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";

/**
 * Dashboard mockup — what visitors see in /dashboard/playbooks when
 * a run is live. Not a screenshot (server-rendered DIVs scale better
 * across viewports and stay crisp on retina); every element matches
 * the actual dashboard typography + spacing so the mockup reads as
 * "this is the product" rather than "this is marketing art."
 *
 * Animation budget:
 *   - The "running" step's progress bar pulses once and stops
 *   - The output panel reveals line-by-line on viewport entry
 *   - Nothing moves on a loop — the page scrolls past this, it
 *     doesn't sit here forever burning animation
 *
 * The five steps mirror the real Lead Blitz playbook:
 *   1. Classify niche → done
 *   2. Discover companies → done
 *   3. Enrich contacts → running (the one in-flight)
 *   4. Score priority → pending
 *   5. Draft outreach angle → pending
 */

interface Step {
  n: number;
  agent: string;
  status: "done" | "running" | "pending";
  model?: string;
  duration?: string;
}

const STEPS: Step[] = [
  { n: 1, agent: "Classify niche", status: "done", model: "nemotron-ultra", duration: "0.9s" },
  { n: 2, agent: "Discover companies", status: "done", model: "smart-router", duration: "38.2s" },
  { n: 3, agent: "Enrich contacts", status: "running", model: "claude-opus-4.5", duration: "12.4s" },
  { n: 4, agent: "Score priority", status: "pending" },
  { n: 5, agent: "Draft outreach angle", status: "pending" },
];

const OUTPUT_LINES = [
  { text: "→ Resolved niche: B2B SaaS / mid-market / North America", color: "text-emerald-400" },
  { text: "→ Discovered 47 companies matching ICP signals", color: "text-emerald-400" },
  { text: "  · 12 in Series A–C, 18 bootstrapped, 17 acquired-entity", color: "text-neutral-500" },
  { text: "→ Enriching 47/47 · Hunter → Apollo → Clearbit fallback chain", color: "text-cyan-400" },
  { text: "  · Found 34 verified emails, 11 LinkedIn profiles, 2 skipped", color: "text-neutral-500" },
  { text: "  · Running [Claude-Opus-4.5] quality critic on contact angles...", color: "text-[#B5532C]" },
];

export function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto max-w-5xl"
    >
      {/* Window frame — matches the real dashboard's rounded corners + border */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0A0807] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Chrome bar — traffic lights + address */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-[#060605]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3633]" aria-hidden="true" />
          <div className="mx-auto flex items-center gap-2 text-[11px] font-mono text-neutral-500">
            <span className="text-neutral-700">sovereign.matrix</span>
            <span>/</span>
            <span>dashboard</span>
            <span>/</span>
            <span className="text-white">playbooks</span>
            <span className="text-neutral-700">?auto=lead-blitz</span>
          </div>
        </div>

        {/* Header row — run name + status + elapsed */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-white/[0.04]">
          <div className="flex items-baseline gap-3 min-w-0">
            <h3 className="font-serif text-[17px] text-white truncate tracking-tight">
              Lead Blitz
            </h3>
            <span className="text-[10px] font-mono text-neutral-600 tracking-[0.15em] uppercase">
              3/5 steps
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Running
            </span>
            <span className="tabular-nums text-neutral-400">02:34</span>
          </div>
        </div>

        {/* Body — split panel: steps on the left, streaming output on the right */}
        <div className="grid md:grid-cols-[220px_1fr]">
          {/* Step column */}
          <div className="border-r border-white/[0.04] p-5 md:p-6 space-y-4">
            {STEPS.map((step, i) => (
              <StepRow key={step.n} step={step} index={i} />
            ))}
          </div>

          {/* Streaming output panel */}
          <div className="p-5 md:p-6 min-h-[260px]">
            <div className="flex items-center gap-2 mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                Live output · Step 3
              </p>
              <span aria-hidden="true" className="text-neutral-800">·</span>
              <p className="font-mono text-[10px] text-[#B5532C]">
                claude-opus-4.5 critic · 96% confidence
              </p>
            </div>

            <div className="space-y-2 font-mono text-[12px] leading-relaxed">
              {OUTPUT_LINES.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.08, duration: 0.35 }}
                  className={line.color}
                >
                  {line.text}
                </motion.p>
              ))}

              {/* Blinking cursor at the end */}
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + OUTPUT_LINES.length * 0.08 }}
                className="inline-block h-[12px] w-[2px] bg-[#B5532C] animate-pulse align-middle ml-0.5"
              />
            </div>
          </div>
        </div>

        {/* Footer — model roster + guarantee badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.04] bg-[#060605]">
          <p className="text-[10px] font-mono text-neutral-600 tracking-tight">
            Models this run:{" "}
            <span className="text-neutral-400">nemotron-ultra-253b</span>
            <span className="text-neutral-800"> · </span>
            <span className="text-neutral-400">smart-router</span>
            <span className="text-neutral-800"> · </span>
            <span className="text-white">claude-opus-4.5</span>
          </p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80">
            <Check className="h-3 w-3" />
            5-layer verified
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const isDone = step.status === "done";
  const isRunning = step.status === "running";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.15 + index * 0.07 }}
      className="flex items-start gap-3"
    >
      {/* Step status icon — different per state */}
      <div className="relative mt-0.5 flex-shrink-0">
        {isDone && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <Check className="h-3 w-3 text-emerald-400" />
          </span>
        )}
        {isRunning && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#B5532C]/15 border border-[#B5532C]/40">
            <Loader2 className="h-3 w-3 text-[#B5532C] animate-spin" />
          </span>
        )}
        {step.status === "pending" && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08]">
            <Circle className="h-2 w-2 text-neutral-700" fill="currentColor" />
          </span>
        )}
      </div>

      {/* Label column */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] tracking-tight leading-tight mb-0.5 ${
            isDone
              ? "text-neutral-400"
              : isRunning
                ? "text-white"
                : "text-neutral-600"
          }`}
        >
          {step.n}. {step.agent}
        </p>
        {step.model && (
          <p className="text-[10px] font-mono text-neutral-600 tracking-tight truncate">
            {step.model}
            {step.duration && (
              <>
                <span className="text-neutral-800"> · </span>
                <span className="tabular-nums">{step.duration}</span>
              </>
            )}
          </p>
        )}
      </div>
    </motion.div>
  );
}
