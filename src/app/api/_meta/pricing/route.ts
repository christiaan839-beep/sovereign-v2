/**
 * GET /api/_meta/pricing.json — Public per-agent cost transparency.
 *
 * Companion to /api/_meta/transparency.json + /api/_meta/agents.json.
 * Closes FMTI's "pricing transparency" subdomain (was 70%) by giving
 * auditor LLMs and procurement teams a machine-readable rate card
 * for every agent.
 *
 * SCHEMA:
 *   {
 *     schemaVersion: "1.0",
 *     generatedAt: ISO,
 *     rateCard: {
 *       version: "2026-04-20",
 *       providerBands: { free: {...}, metered: {...}, paid: {...} },
 *       methodology: "string"
 *     },
 *     agents: [{
 *       slug, tier, providers: [...],
 *       costTier: "free" | "low" | "medium" | "high",
 *       worstCaseCentsPerCall, bestCaseCentsPerCall,
 *       hasFreeFallback
 *     }],
 *     summary: { byTier: {...}, totalAgents }
 *   }
 *
 * Cached 1 hour at the edge — provider rates change rarely.
 *
 * NO PII — public surface. Safe to share unauthenticated.
 */

import { NextResponse } from "next/server";
import { AGENT_MANIFESTS } from "@/lib/agent-manifests.generated";
import {
  estimateAgentCost,
  TYPICAL_INPUT_TOKENS,
  TYPICAL_OUTPUT_TOKENS,
  type AgentCostTier,
} from "@/lib/agent-pricing-estimate";
import { RATE_CARD_VERSION } from "@/lib/model-costs";

export const runtime = "nodejs";
export const revalidate = 3600;

interface PricingResponse {
  schemaVersion: "1.0";
  generatedAt: string;
  canonicalUrl: string;
  // The platform's underlying inference cost — not what the customer
  // pays (those are plan tiers on /pricing). This is the "what does
  // a single agent invocation cost the platform to produce?" number,
  // which procurement teams ask for to model their margins.
  scope: "platform_inference_cost";
  rateCard: {
    version: string;
    methodology: string;
    typicalInputTokens: number;
    typicalOutputTokens: number;
  };
  agents: Array<{
    slug: string;
    tier: 1 | 2 | 3;
    providers: string[];
    costTier: AgentCostTier;
    worstCaseCentsPerCall: number;
    bestCaseCentsPerCall: number;
    hasFreeFallback: boolean;
  }>;
  summary: {
    totalAgents: number;
    byTier: Record<AgentCostTier, number>;
    freeTierAgentCount: number;
    weightedAvgCentsPerCall: number;
  };
}

export async function GET(): Promise<Response> {
  const agents = Object.values(AGENT_MANIFESTS).map((m) => {
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

  // Sort by slug for stable ordering — auditor LLMs ingest this and
  // diff between snapshots; sorted output makes diffs human-readable.
  agents.sort((a, b) => a.slug.localeCompare(b.slug));

  const byTier: Record<AgentCostTier, number> = {
    free: 0,
    low: 0,
    medium: 0,
    high: 0,
  };
  let totalCents = 0;
  let freeCount = 0;
  for (const a of agents) {
    byTier[a.costTier] += 1;
    totalCents += a.worstCaseCentsPerCall;
    if (a.hasFreeFallback) freeCount += 1;
  }

  const body: PricingResponse = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    canonicalUrl: "https://sovereignmatrix.agency/api/_meta/pricing.json",
    scope: "platform_inference_cost",
    rateCard: {
      version: RATE_CARD_VERSION,
      methodology:
        "Per-provider band rates (free / metered / paid) applied to typical " +
        "token assumptions. Worst-case across the agent's failover chain — " +
        "actual runs may be cheaper. See src/lib/agent-pricing-estimate.ts " +
        "for the band table.",
      typicalInputTokens: TYPICAL_INPUT_TOKENS,
      typicalOutputTokens: TYPICAL_OUTPUT_TOKENS,
    },
    agents,
    summary: {
      totalAgents: agents.length,
      byTier,
      freeTierAgentCount: freeCount,
      weightedAvgCentsPerCall:
        agents.length > 0 ? Math.round(totalCents / agents.length) : 0,
    },
  };

  return NextResponse.json(body, {
    headers: {
      // Same audience-marker as transparency.json — auditor LLMs use
      // this header to know they're a first-class consumer.
      "X-Sovereign-Transparency-Audience": "human, ai-agent",
    },
  });
}
