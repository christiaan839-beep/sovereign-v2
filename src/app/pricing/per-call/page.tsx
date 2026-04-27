/**
 * /pricing/per-call — Per-agent cost transparency page.
 *
 * Server component. Reads AGENT_MANIFESTS at build time, computes the
 * cost estimate for each agent, renders the full table.
 *
 * Companion to /pricing (plan tiers — what customers pay) and
 * /api/_meta/pricing.json (machine-readable for auditor LLMs). This
 * is the human-readable transparency surface.
 *
 * Why publish this when most platforms don't:
 *
 *   1. **FMTI pricing transparency** — the missing piece (was 70%).
 *      A standalone per-call rate card pushes that subdomain to 90%+.
 *   2. **Procurement requirement** — enterprise teams modeling unit
 *      economics need our cost data, not just our retail price.
 *   3. **Honest framing** — we charge a markup on inference; this
 *      page makes the markup visible. That's the trust play.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AGENT_MANIFESTS } from "@/lib/agent-manifests.generated";
import {
  estimateAgentCost,
  formatCents,
  TYPICAL_INPUT_TOKENS,
  TYPICAL_OUTPUT_TOKENS,
  type AgentCostTier,
} from "@/lib/agent-pricing-estimate";
import { RATE_CARD_VERSION } from "@/lib/model-costs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Per-call Cost Transparency — Sovereign Matrix",
  description:
    "Public rate card for every agent. Provider bands, worst-case + best-case cents per call, free-fallback availability. The number behind your plan tier.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/pricing/per-call",
  },
};

const TIER_STYLES: Record<AgentCostTier, { bg: string; text: string; ring: string; label: string }> = {
  free: { bg: "bg-emerald-500/10", text: "text-emerald-300", ring: "ring-emerald-500/30", label: "Free" },
  low: { bg: "bg-sky-500/10", text: "text-sky-300", ring: "ring-sky-500/30", label: "Low" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-200", ring: "ring-amber-500/30", label: "Medium" },
  high: { bg: "bg-rose-500/10", text: "text-rose-300", ring: "ring-rose-500/30", label: "High" },
};

interface AgentRow {
  slug: string;
  tier: 1 | 2 | 3;
  providers: string[];
  costTier: AgentCostTier;
  worstCaseCentsPerCall: number;
  bestCaseCentsPerCall: number;
  hasFreeFallback: boolean;
}

export default function PerCallPricingPage() {
  const agents: AgentRow[] = Object.values(AGENT_MANIFESTS).map((m) => {
    const providers = (m.models ?? []).map((mod) => mod.provider).filter(Boolean);
    const estimate = estimateAgentCost({ providers });
    return {
      slug: m.slug,
      tier: m.tier as 1 | 2 | 3,
      providers: estimate.providers,
      costTier: estimate.costTier,
      worstCaseCentsPerCall: estimate.worstCaseCentsPerCall,
      bestCaseCentsPerCall: estimate.bestCaseCentsPerCall,
      hasFreeFallback: estimate.hasFreeFallback,
    };
  });

  // Tier order: free → low → medium → high; alphabetical within tier.
  const tierOrder: Record<AgentCostTier, number> = {
    free: 0, low: 1, medium: 2, high: 3,
  };
  agents.sort((a, b) => {
    if (a.costTier !== b.costTier) return tierOrder[a.costTier] - tierOrder[b.costTier];
    return a.slug.localeCompare(b.slug);
  });

  const byTier: Record<AgentCostTier, number> = { free: 0, low: 0, medium: 0, high: 0 };
  for (const a of agents) byTier[a.costTier] += 1;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
        <Link
          href="/pricing"
          className="text-[11px] text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.18em] mb-8 block"
        >
          ← Plan pricing
        </Link>

        <h1 className="font-serif text-3xl md:text-4xl text-white mb-3 tracking-tight">
          Per-call cost transparency
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          What an agent invocation actually costs the platform to produce.
          This is the underlying inference cost — your{" "}
          <Link href="/pricing" className="text-[#B5532C] hover:underline">
            plan tier
          </Link>{" "}
          determines what you pay; this page shows what we pay.
        </p>

        {/* ─── Tier summary cards ─── */}
        <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["free", "low", "medium", "high"] as const).map((tier) => {
            const style = TIER_STYLES[tier];
            return (
              <div
                key={tier}
                className={`rounded-lg border border-white/10 ${style.bg} p-4`}
              >
                <div className={`text-xs uppercase tracking-wider ${style.text}`}>
                  {style.label}
                </div>
                <div className="mt-2 text-2xl font-bold text-neutral-100">
                  {byTier[tier]}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">agents</div>
              </div>
            );
          })}
        </section>

        {/* ─── Methodology ─── */}
        <section className="mt-10 rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">
            Methodology
          </h2>
          <div className="space-y-2 text-xs text-neutral-400 leading-relaxed">
            <p>
              <strong className="text-white">Rate card version:</strong>{" "}
              {RATE_CARD_VERSION}. Provider bands derived from public rate
              cards (Anthropic, Google, NVIDIA, Groq, Cerebras, Ollama).
            </p>
            <p>
              <strong className="text-white">Token assumptions:</strong>{" "}
              {TYPICAL_INPUT_TOKENS.toLocaleString()} input /{" "}
              {TYPICAL_OUTPUT_TOKENS.toLocaleString()} output tokens per
              call. Conservative defaults — actual runs vary.
            </p>
            <p>
              <strong className="text-white">Worst-case framing:</strong> the
              cost shown is the most expensive provider in the agent&apos;s
              failover chain. The smart router picks the cheapest model
              that meets the quality bar at runtime, so real cost is
              typically lower.
            </p>
            <p>
              <strong className="text-white">Free fallback:</strong> a green
              dot indicates the agent has at least one zero-cost provider
              in its chain (NIM / Ollama / Cerebras free tier). With
              <code className="mx-1 text-[11px] text-neutral-300">
                SOVEREIGN_FREE_ONLY=true
              </code>
              the platform exclusively uses free providers.
            </p>
            <p className="pt-2 border-t border-white/5">
              Machine-readable version:{" "}
              <Link
                href="/api/_meta/pricing.json"
                className="text-[#B5532C] hover:underline"
              >
                /api/_meta/pricing.json
              </Link>
            </p>
          </div>
        </section>

        {/* ─── Agent table ─── */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">
            All {agents.length} agents
          </h2>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-left">
                  <th className="px-3 py-2 font-semibold text-neutral-400">
                    Agent
                  </th>
                  <th className="px-3 py-2 font-semibold text-neutral-400">
                    Tier
                  </th>
                  <th className="px-3 py-2 font-semibold text-neutral-400">
                    Cost band
                  </th>
                  <th className="px-3 py-2 font-semibold text-neutral-400 text-right">
                    Best case
                  </th>
                  <th className="px-3 py-2 font-semibold text-neutral-400 text-right">
                    Worst case
                  </th>
                  <th className="px-3 py-2 font-semibold text-neutral-400">
                    Free fallback
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const style = TIER_STYLES[a.costTier];
                  return (
                    <tr
                      key={a.slug}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/agents/${a.slug}`}
                          className="font-mono text-neutral-300 hover:text-white"
                        >
                          {a.slug}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-neutral-500">
                        T{a.tier}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${style.bg} ${style.text} ${style.ring}`}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-400">
                        {formatCents(a.bestCaseCentsPerCall)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-200">
                        {formatCents(a.worstCaseCentsPerCall)}
                      </td>
                      <td className="px-3 py-2">
                        {a.hasFreeFallback ? (
                          <span
                            className="text-emerald-400"
                            aria-label="has free fallback"
                          >
                            ●
                          </span>
                        ) : (
                          <span
                            className="text-neutral-600"
                            aria-label="no free fallback"
                          >
                            ○
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-8 text-xs text-neutral-500">
          <p>
            Questions about pricing:{" "}
            <a
              href="mailto:billing@sovereignmatrix.agency"
              className="text-[#B5532C] hover:underline"
            >
              billing@sovereignmatrix.agency
            </a>
          </p>
          <p className="mt-2">
            See also:{" "}
            <Link href="/pricing" className="hover:underline">
              plan pricing
            </Link>
            {" · "}
            <Link
              href="/pricing/calculator"
              className="hover:underline"
            >
              plan calculator
            </Link>
            {" · "}
            <Link href="/trust/audit" className="hover:underline">
              trust audit hub
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
