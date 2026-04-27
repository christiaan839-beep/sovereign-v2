/**
 * AGENT PRICING ESTIMATE
 *
 * Public-facing per-agent cost transparency. Closes FMTI's
 * "pricing transparency" subdomain (was 70%) by giving every
 * stakeholder — procurement, end user, auditor LLM — a clear
 * estimate of what an agent invocation costs.
 *
 * APPROACH:
 *
 * Each agent's manifest declares a provider list (`models[].provider`)
 * but not specific model IDs (the smart router picks at runtime). So
 * we estimate cost-per-call as the **worst-case across declared
 * providers** — never under-promise. The result is a tier band plus
 * a typical-cents-per-call number.
 *
 * Worst-case is the right framing for transparency: a procurement
 * officer wants to know the maximum, not the average. Marketing
 * pages can show the average; this file is for honest disclosure.
 *
 * ASSUMPTIONS:
 *
 * Typical token counts vary by agent shape (tenant-private agents
 * tend toward 1K input / 0.5K output; long-form generators toward
 * 4K / 4K). We use one conservative default — 2K input / 1.5K
 * output — and document it transparently in the response. Users who
 * want exact numbers can run the agent and read the actual `_meta`.
 *
 * The result is COST not PRICE. Sovereign Matrix's plan tiers are
 * what end-users actually pay; this is the underlying inference cost
 * that the platform absorbs. Procurement teams ask for both numbers.
 */

import { getRate } from "./model-costs";
import { PROVIDER_COSTS, type CostTier as ProviderClass } from "./provider-costs";

// ─── Provider-level cost bands ───────────────────────────────────────
//
// Each provider class maps to a representative input/output rate. These
// are deliberately upper-band rates — when an agent declares NIM, it
// might use any of NIM's models from gemma-4-e4b (free) to nemotron-
// ultra-253b (low). We pick the higher one for the worst-case estimate.
//
// Numbers in cents per million tokens (matches model-costs.ts).
const PROVIDER_BAND_RATES: Record<
  ProviderClass,
  { inputCentsPerMTok: number; outputCentsPerMTok: number }
> = {
  free: { inputCentsPerMTok: 0, outputCentsPerMTok: 0 },
  // "Metered" providers (Groq, NIM-hosted-paid) — small marginal cost.
  metered: { inputCentsPerMTok: 50, outputCentsPerMTok: 200 },
  // Frontier providers (Anthropic, Google direct, OpenAI). Use a
  // mid-range rate that approximates Sonnet / Gemini Pro tier — the
  // most common smart-router pick.
  paid: { inputCentsPerMTok: 300, outputCentsPerMTok: 1500 },
};

/** Token assumptions for a "typical" call. Conservative defaults. */
export const TYPICAL_INPUT_TOKENS = 2_000;
export const TYPICAL_OUTPUT_TOKENS = 1_500;

/** Agent cost-tier band — surfaced as a chip on the agent catalog.
 *  Distinct from provider-costs.CostTier (which classifies upstream
 *  providers as free/paid/metered). */
export type AgentCostTier = "free" | "low" | "medium" | "high";

export interface AgentPricingEstimate {
  /** Worst-case cents per call across the agent's declared providers. */
  worstCaseCentsPerCall: number;
  /** Best-case (cheapest provider in the chain). */
  bestCaseCentsPerCall: number;
  /** Tier band derived from worst-case cents. */
  costTier: AgentCostTier;
  /** Distinct providers this agent could route to. */
  providers: string[];
  /** Whether the cheapest path is actually free. */
  hasFreeFallback: boolean;
  /** Token assumptions that drove the estimate (transparency). */
  basedOn: {
    typicalInputTokens: number;
    typicalOutputTokens: number;
    methodology: string;
  };
}

/**
 * Estimate cents-per-call for a single provider class.
 */
function centsForProviderClass(klass: ProviderClass): number {
  const rate = PROVIDER_BAND_RATES[klass];
  const inputCents = (TYPICAL_INPUT_TOKENS * rate.inputCentsPerMTok) / 1_000_000;
  const outputCents =
    (TYPICAL_OUTPUT_TOKENS * rate.outputCentsPerMTok) / 1_000_000;
  return Math.ceil(inputCents + outputCents);
}

/**
 * Bucket a cents-per-call number into a tier band. Thresholds chosen
 * so the labels actually mean something — "free" is genuinely $0,
 * "low" is sub-cent, "medium" rolls up to single-digit cents per
 * call, "high" is anything frontier-priced.
 */
function bandFor(cents: number, hasFreeFallback: boolean): AgentCostTier {
  if (cents === 0) return "free";
  // A free fallback bumps the band down — even if the WORST case is
  // pricey, the user can opt for the free path. Honest framing.
  if (hasFreeFallback && cents <= 5) return "low";
  if (cents <= 1) return "low";
  if (cents <= 5) return "medium";
  return "high";
}

/**
 * Compute a pricing estimate for an agent given its declared providers.
 * Provider names match what the manifest's models[].provider field
 * uses (e.g., "anthropic", "nvidia-nim", "gemini", "groq").
 *
 * Unknown providers default to PAID band so we never under-estimate.
 */
export function estimateAgentCost(input: {
  providers: string[];
}): AgentPricingEstimate {
  const providers = Array.from(
    new Set(input.providers.filter((p) => p && p.length > 0)),
  );

  if (providers.length === 0) {
    // No providers declared — agent is either local-only or its
    // manifest is incomplete. Treat as free for transparency.
    return {
      worstCaseCentsPerCall: 0,
      bestCaseCentsPerCall: 0,
      costTier: "free",
      providers: [],
      hasFreeFallback: true,
      basedOn: {
        typicalInputTokens: TYPICAL_INPUT_TOKENS,
        typicalOutputTokens: TYPICAL_OUTPUT_TOKENS,
        methodology:
          "no providers declared — manifest incomplete or local-only agent",
      },
    };
  }

  const classes = providers.map((p) => {
    const cls = PROVIDER_COSTS[p];
    return cls ?? "paid"; // unknown → assume worst-case
  });

  const centsPerProvider = classes.map(centsForProviderClass);
  const worstCase = Math.max(...centsPerProvider);
  const bestCase = Math.min(...centsPerProvider);
  const hasFreeFallback = classes.some((c) => c === "free");

  return {
    worstCaseCentsPerCall: worstCase,
    bestCaseCentsPerCall: bestCase,
    costTier: bandFor(worstCase, hasFreeFallback),
    providers,
    hasFreeFallback,
    basedOn: {
      typicalInputTokens: TYPICAL_INPUT_TOKENS,
      typicalOutputTokens: TYPICAL_OUTPUT_TOKENS,
      methodology:
        "Provider-band rates for the agent's declared providers; worst-case across the failover chain. " +
        "Conservative — actual runs may be cheaper if the smart router picks a smaller model. " +
        `Token assumptions: ${TYPICAL_INPUT_TOKENS} input / ${TYPICAL_OUTPUT_TOKENS} output. ` +
        "Re-derive precise numbers from src/lib/model-costs.ts at runtime via the agent's _meta envelope.",
    },
  };
}

/**
 * Estimate cost for a whole DAG (sum of per-node worst-case estimates).
 * Used by the visual editor's pre-run preview.
 *
 * `agentLookup(slug)` returns the providers the slug declares. The
 * caller threads in a map from agent-manifests.generated.ts.
 */
export function estimateDagCost(input: {
  nodes: Array<{ id: string; agent: string }>;
  agentLookup: (slug: string) => { providers: string[] } | undefined;
}): {
  totalWorstCaseCents: number;
  totalBestCaseCents: number;
  perNode: Array<{
    nodeId: string;
    agent: string;
    estimate: AgentPricingEstimate | null;
  }>;
} {
  const perNode = input.nodes.map((n) => {
    const lookup = input.agentLookup(n.agent);
    if (!lookup) {
      return { nodeId: n.id, agent: n.agent, estimate: null };
    }
    return {
      nodeId: n.id,
      agent: n.agent,
      estimate: estimateAgentCost({ providers: lookup.providers }),
    };
  });

  const totalWorstCaseCents = perNode.reduce(
    (acc, p) => acc + (p.estimate?.worstCaseCentsPerCall ?? 0),
    0,
  );
  const totalBestCaseCents = perNode.reduce(
    (acc, p) => acc + (p.estimate?.bestCaseCentsPerCall ?? 0),
    0,
  );

  return { totalWorstCaseCents, totalBestCaseCents, perNode };
}

/**
 * Pretty-format a cents value. Sub-cent shows as "<0.01¢", whole-cent
 * shows as "1¢", multi-cent as "12¢". Nothing fancy — UI consistency
 * across the app.
 *
 * Re-export getRate so consumers don't have to reach into model-costs
 * directly (single import for "what does this cost?" questions).
 */
export function formatCents(cents: number): string {
  if (cents <= 0) return "free";
  if (cents < 1) return "<1¢";
  if (cents < 100) return `${Math.round(cents)}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

export { getRate };
