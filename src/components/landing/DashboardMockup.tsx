"use client";

import { motion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";

/**
 * Dashboard mockup — sample run from /dashboard/playbooks, rendered
 * as server-side DIVs so the page scales to retina without a
 * screenshot pipeline. Every element matches the real dashboard
 * typography + spacing.
 *
 * IMPORTANT: this is a static illustration of what a Lead Blitz run
 * looks like. It's labeled "Sample run" in the chrome so no visitor
 * thinks they're watching live telemetry on the marketing page.
 * Numbers and step outputs are representative, not telemetered — for
 * real data, run a real playbook from the dashboard.
 *
 * Step layout mirrors the real Lead Blitz playbook (5 steps): classify,
 * discover, enrich, score, draft — step 3 is shown in-flight so the
 * reader sees the in-progress state.
 */

interface Step {
  n: number;
  agent: string;
  status: "done" | "running" | "pending";
  model?: string;
  duration?: string;
}

const STEPS: Step[] = [
  { n: 1, agent: "Classify niche", status: "done", model: "nemotron-ultra-253b-v1", duration: "~1s" },
  { n: 2, agent: "Discover companies", status: "done", model: "gemini-2.5-flash", duration: "~40s" },
  { n: 3, agent: "Enrich contacts", status: "running", model: "claude-sonnet-4-6" },
  { n: 4, agent: "Score priority", status: "pending" },
  { n: 5, agent: "Draft outreach angle", status: "pending" },
];

const OUTPUT_LINES = [
  { text: "→ Classified niche: B2B SaaS / mid-market", color: "text-emerald-400" },
  { text: "→ Discovered companies matching ICP signals", color: "text-emerald-400" },
  { text: "  · Tiered by funding stage + headcount + signal recency", color: "text-neutral-500" },
  { text: "→ Enriching via Hunter → Apollo → Clearbit fallback chain", color: "text-cyan-400" },
  { text: "  · Verified emails + LinkedIn profiles per company", color: "text-neutral-500" },
  { text: "  · Running claude-sonnet-4-6 quality critic on contact angles", color: "text-[#B5532C]" },
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
        {/* Chrome bar — traffic lights + address + sample tag.
            The copper "Sample run" badge makes it unambiguous: this is
            an illustration of the dashboard pattern, not live data. */}
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
          <span className="ml-auto text-[9px] font-mono uppercase tracking-[0.18em] text-[#B5532C]/80 border border-[#B5532C]/30 px-1.5 py-0.5 rounded">
            Sample
          </span>
        </div>

        {/* Header row — playbook name + step count */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-white/[0.04]">
          <div className="flex items-baseline gap-3 min-w-0">
            <h3 className="font-serif text-[17px] text-white truncate tracking-tight">
              Lead Blitz
            </h3>
            <span className="text-[10px] font-mono text-neutral-600 tracking-[0.15em] uppercase">
              5 steps
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-neutral-500">
            <span className="text-neutral-600">Step 3 in progress</span>
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

          {/* Output panel — static sample, not streaming telemetry */}
          <div className="p-5 md:p-6 min-h-[260px]">
            <div className="flex items-center gap-2 mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                Output · Step 3
              </p>
              <span aria-hidden="true" className="text-neutral-800">·</span>
              <p className="font-mono text-[10px] text-[#B5532C]">
                claude-sonnet-4-6 critic gates every step
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

        {/* Footer — model roster + pipeline badge.
            Models listed are real providers we route through per task.
            "5-layer verified" refers to the pipeline gates every real
            run passes through (jailbreak, PII, content, quality, critic) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.04] bg-[#060605]">
          <p className="text-[10px] font-mono text-neutral-600 tracking-tight">
            Typical run:{" "}
            <span className="text-neutral-400">nemotron-ultra-253b-v1</span>
            <span className="text-neutral-800"> · </span>
            <span className="text-neutral-400">gemini-2.5-flash</span>
            <span className="text-neutral-800"> · </span>
            <span className="text-white">claude-sonnet-4-6</span>
          </p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80">
            <Check className="h-3 w-3" />
            5-layer pipeline
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
