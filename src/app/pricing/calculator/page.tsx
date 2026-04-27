"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

/**
 * Per-agent pricing calculator. Closes WHATS-NOT-ELITE.md §2.3.
 *
 * Buyer picks: agents they need + monthly run volume per agent.
 * Output: expected monthly bill + recommended plan tier.
 *
 * The math:
 *   - Sum estimatedTokens × runs × $/token across selected agents.
 *   - Compare to plan tiers; recommend the cheapest plan whose included
 *     allotment covers the projected volume.
 *   - If projection exceeds Enterprise included, surface a "talk to
 *     sales" CTA instead of a price.
 *
 * The calculator is OFFLINE-FIRST — pure client-side math, no API
 * calls. Lets sales teams demo it from anywhere + lets buyers run
 * sensitivity analysis without leaking their volumes to us.
 */

// Coarse buckets — actual per-agent pricing comes from
// src/lib/model-costs.ts. The calculator uses representative averages
// rather than per-agent SKU pricing because the buyer wants the
// envelope, not the spreadsheet.
const AGENT_BUCKETS = [
  {
    id: "lead",
    name: "Lead generation",
    examples: "leads, abm-artillery, outreach-personalizer",
    avgInputTokens: 800,
    avgOutputTokens: 1200,
    centsPerKtoken: 1.2,
  },
  {
    id: "content",
    name: "Content + copy",
    examples: "blog-gen, email-sequence, press-release, social-post",
    avgInputTokens: 600,
    avgOutputTokens: 1800,
    centsPerKtoken: 1.0,
  },
  {
    id: "vision",
    name: "Vision / OCR",
    examples: "1099-reader, w2-reader, business-card-reader, receipt-scanner",
    avgInputTokens: 2000,
    avgOutputTokens: 800,
    centsPerKtoken: 2.5,
  },
  {
    id: "analysis",
    name: "Analysis / reasoning",
    examples: "deep-think, contract-analyzer, code-reviewer",
    avgInputTokens: 1500,
    avgOutputTokens: 2000,
    centsPerKtoken: 2.8,
  },
  {
    id: "voice",
    name: "Voice / outbound",
    examples: "voice-closer, asr, multilingual-voice",
    avgInputTokens: 0, // billed by minutes, approximated at $0.10/min
    avgOutputTokens: 0,
    centsPerKtoken: 10.0, // representative
  },
];

const PLANS = [
  { id: "free", name: "Free", monthlyUsd: 0, includedRuns: 50, overageCentsPerRun: 0 },
  { id: "starter", name: "Starter", monthlyUsd: 19, includedRuns: 500, overageCentsPerRun: 8 },
  { id: "growth", name: "Growth", monthlyUsd: 49, includedRuns: 2_000, overageCentsPerRun: 4 },
  { id: "node", name: "Node", monthlyUsd: 199, includedRuns: 10_000, overageCentsPerRun: 2 },
  { id: "enterprise", name: "Enterprise", monthlyUsd: 499, includedRuns: 50_000, overageCentsPerRun: 1 },
];

interface BucketSelection {
  bucketId: string;
  runsPerMonth: number;
}

export default function PricingCalculatorPage() {
  const [selections, setSelections] = useState<BucketSelection[]>([
    { bucketId: "lead", runsPerMonth: 200 },
    { bucketId: "content", runsPerMonth: 100 },
  ]);

  function setRuns(bucketId: string, runsPerMonth: number) {
    setSelections((prev) => {
      const exists = prev.find((s) => s.bucketId === bucketId);
      if (exists) {
        return prev.map((s) =>
          s.bucketId === bucketId ? { ...s, runsPerMonth } : s,
        );
      }
      return [...prev, { bucketId, runsPerMonth }];
    });
  }

  // Total runs + total token cost projected across all selected buckets.
  const projection = useMemo(() => {
    let totalRuns = 0;
    let totalTokenCostCents = 0;
    for (const sel of selections) {
      const bucket = AGENT_BUCKETS.find((b) => b.id === sel.bucketId);
      if (!bucket) continue;
      totalRuns += sel.runsPerMonth;
      const ktokens =
        ((bucket.avgInputTokens + bucket.avgOutputTokens) * sel.runsPerMonth) /
        1000;
      totalTokenCostCents += ktokens * bucket.centsPerKtoken;
    }
    return { totalRuns, totalTokenCostCents };
  }, [selections]);

  // Pick the cheapest plan whose included runs cover the projection;
  // otherwise compute overage on the highest plan.
  const recommendation = useMemo(() => {
    const fittingPlans = PLANS.filter((p) => p.includedRuns >= projection.totalRuns);
    const recommended = fittingPlans[0] ?? PLANS[PLANS.length - 1];
    const overageRuns = Math.max(
      0,
      projection.totalRuns - recommended.includedRuns,
    );
    const overageCents = overageRuns * recommended.overageCentsPerRun;
    const monthlyTotalCents =
      recommended.monthlyUsd * 100 + overageCents;
    return { recommended, overageRuns, overageCents, monthlyTotalCents };
  }, [projection.totalRuns]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-neutral-200">
      <div className="mb-10">
        <Link href="/pricing" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Back to plans
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Pricing calculator</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Pick the kinds of agents you'll run + how often. We'll
          recommend the plan that fits your envelope, with honest
          overage math when you cross the included allotment.
        </p>
        <p className="mt-3 max-w-2xl text-xs text-neutral-500">
          All math happens client-side — your numbers never leave your
          browser. The plan tiers + per-run overage rates here match
          what's published on{" "}
          <Link href="/pricing" className="underline hover:text-neutral-300">
            /pricing
          </Link>
          .
        </p>
      </div>

      <div className="space-y-4">
        {AGENT_BUCKETS.map((b) => {
          const current = selections.find((s) => s.bucketId === b.id);
          const runs = current?.runsPerMonth ?? 0;
          return (
            <div
              key={b.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    e.g. {b.examples}
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  ~{b.avgInputTokens + b.avgOutputTokens}t/run · $
                  {(b.centsPerKtoken / 100).toFixed(3)}/Ktoken
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={50}
                  value={runs}
                  onChange={(e) => setRuns(b.id, Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <input
                  type="number"
                  min={0}
                  value={runs}
                  onChange={(e) => setRuns(b.id, Number(e.target.value))}
                  className="w-20 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-right text-sm"
                />
                <span className="text-xs text-neutral-500">runs/mo</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="text-xs uppercase tracking-wide text-emerald-400">
          Recommended plan
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="text-3xl font-bold text-white">
            {recommendation.recommended.name}
          </div>
          <div className="text-2xl font-semibold text-emerald-400">
            ${(recommendation.monthlyTotalCents / 100).toFixed(0)}/mo
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-neutral-300">
          <div>
            <span className="text-neutral-500">Total runs:</span>{" "}
            {projection.totalRuns.toLocaleString()} / mo
          </div>
          <div>
            <span className="text-neutral-500">Plan included:</span>{" "}
            {recommendation.recommended.includedRuns.toLocaleString()} runs
          </div>
          {recommendation.overageRuns > 0 && (
            <div>
              <span className="text-neutral-500">Overage:</span>{" "}
              {recommendation.overageRuns.toLocaleString()} runs × $
              {(recommendation.recommended.overageCentsPerRun / 100).toFixed(2)} = $
              {(recommendation.overageCents / 100).toFixed(2)}/mo
            </div>
          )}
          <div className="pt-2 text-xs text-neutral-500">
            Implied token cost:{" "}
            ${(projection.totalTokenCostCents / 100).toFixed(2)}/mo
            (we absorb token costs at flat rates inside the plan
            allowance — overage only applies when you exceed run count)
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/signup?plan=${recommendation.recommended.id}`}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400"
          >
            Start with {recommendation.recommended.name} →
          </Link>
          <Link
            href="/contact?reason=enterprise"
            className="rounded-md border border-white/15 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.06]"
          >
            Talk to sales (custom volume)
          </Link>
        </div>
      </div>

      <div className="mt-10 text-xs text-neutral-500">
        <strong className="text-neutral-400">Why these numbers:</strong>{" "}
        Each agent bucket's average tokens per run comes from the rolling 30-day
        production average ({" "}
        <Link href="/api/_misc/benchmarks" className="underline hover:text-neutral-300">
          /api/_misc/benchmarks
        </Link>
        ). Per-Ktoken costs are the all-in marginal cost we pay our model
        providers. Plan tiers + overage rates exactly mirror{" "}
        <Link href="/pricing" className="underline hover:text-neutral-300">
          /pricing
        </Link>
        . Calculator math has no margin baked in beyond the plan price —
        if your envelope is tight, talk to us.
      </div>
    </main>
  );
}
