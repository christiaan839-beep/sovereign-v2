/**
 * MODEL PRICES — single source of truth for AI inference cost.
 *
 * Used by cost-ledger and budget-controls to convert (model, tokens) into
 * actual USD cents. The prices below are list prices in cents per million
 * tokens, separated into input vs output tiers (which differ by 3-10x for
 * most providers).
 *
 * Sources verified at time of writing — Anthropic, OpenAI, Google, NVIDIA,
 * Cerebras, Groq published price pages. Update when providers change tiers
 * (a stale price here means budget enforcement is wrong).
 *
 * Free models are explicitly listed at $0 — never let "unknown model" fall
 * through to a non-zero default for a free provider.
 */

/** Cost in cents per 1,000,000 tokens. */
interface ModelPrice {
  inputPerMillionCents: number;
  outputPerMillionCents: number;
  /** Provider bucket — used for telemetry grouping. */
  provider:
    | "anthropic"
    | "openai"
    | "google"
    | "nvidia-nim"
    | "cerebras"
    | "groq"
    | "deepseek"
    | "ollama-local"
    | "elevenlabs"
    | "unknown";
  /** Whether this model is part of a free tier the platform pays nothing for. */
  free: boolean;
}

const FREE: ModelPrice = {
  inputPerMillionCents: 0,
  outputPerMillionCents: 0,
  provider: "unknown",
  free: true,
};

/**
 * Canonical prices. Keys are normalized lowercase model identifiers as
 * they appear in the ai() router after ID resolution.
 */
const PRICES: Record<string, ModelPrice> = {
  // ── Anthropic Claude (Sonnet 4.6 + Opus 4.7) ──
  "claude-opus-4-7": {
    inputPerMillionCents: 1500, // $15.00/M in
    outputPerMillionCents: 7500, // $75.00/M out
    provider: "anthropic",
    free: false,
  },
  "claude-opus-4-6": {
    inputPerMillionCents: 1500,
    outputPerMillionCents: 7500,
    provider: "anthropic",
    free: false,
  },
  "claude-sonnet-4-6": {
    inputPerMillionCents: 300, // $3.00/M in
    outputPerMillionCents: 1500, // $15.00/M out
    provider: "anthropic",
    free: false,
  },
  "claude-haiku-4-5": {
    inputPerMillionCents: 100, // $1.00/M in
    outputPerMillionCents: 500, // $5.00/M out
    provider: "anthropic",
    free: false,
  },

  // ── OpenAI ──
  "gpt-4o": {
    inputPerMillionCents: 250, // $2.50/M in
    outputPerMillionCents: 1000, // $10.00/M out
    provider: "openai",
    free: false,
  },
  "gpt-4o-mini": {
    inputPerMillionCents: 15, // $0.15/M in
    outputPerMillionCents: 60, // $0.60/M out
    provider: "openai",
    free: false,
  },

  // ── Google Gemini ──
  "gemini-2.5-pro": {
    inputPerMillionCents: 125, // $1.25/M in
    outputPerMillionCents: 1000, // $10.00/M out
    provider: "google",
    free: false,
  },
  "gemini-2.0-pro": {
    inputPerMillionCents: 125,
    outputPerMillionCents: 1000,
    provider: "google",
    free: false,
  },
  "gemini-2.0-flash": {
    inputPerMillionCents: 10, // $0.10/M in
    outputPerMillionCents: 40, // $0.40/M out
    provider: "google",
    free: false,
  },

  // ── NVIDIA NIM (free tier on build.nvidia.com) ──
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": {
    ...FREE,
    provider: "nvidia-nim",
  },
  "nvidia/nemotron-omni": { ...FREE, provider: "nvidia-nim" },
  "deepseek-ai/deepseek-v3.2": { ...FREE, provider: "deepseek" },
  "google/gemma-4-31b-it": { ...FREE, provider: "google" },

  // ── Cerebras (free dev tier) ──
  "cerebras-llama-3.3-70b": { ...FREE, provider: "cerebras" },
  "cerebras-llama-4-maverick": { ...FREE, provider: "cerebras" },

  // ── Groq (free dev tier) ──
  "groq-llama-3.3-70b": { ...FREE, provider: "groq" },

  // ── Local Ollama (always free) ──
  "ollama-local": { ...FREE, provider: "ollama-local" },
};

/** Default tier for unrecognized models — assume mid-range paid model so we
 *  err on the safe side of the budget gate. */
const UNKNOWN_PAID: ModelPrice = {
  inputPerMillionCents: 100, // $1.00/M in
  outputPerMillionCents: 300, // $3.00/M out
  provider: "unknown",
  free: false,
};

/** Resolve a model identifier (case-insensitive, prefix-tolerant) to a price.
 *  Returns UNKNOWN_PAID if no match — never silently treats unknown as free. */
export function getModelPrice(modelId: string): ModelPrice {
  if (!modelId) return UNKNOWN_PAID;
  const k = modelId.toLowerCase().trim();
  if (PRICES[k]) return PRICES[k];

  // Heuristic prefix matches for cases like "claude-sonnet-4-6-20250101".
  for (const [name, price] of Object.entries(PRICES)) {
    if (k.startsWith(name) || k.includes(name)) return price;
  }

  // Family-level fallbacks — keep treating unknown Claude models as paid
  // (and at the higher Sonnet tier, not Haiku) until the price table is updated.
  if (k.includes("claude")) return PRICES["claude-sonnet-4-6"];
  if (k.includes("gemini")) return PRICES["gemini-2.5-pro"];
  if (k.includes("gpt")) return PRICES["gpt-4o"];
  if (k.includes("nvidia") || k.includes("nemotron")) return FREE;
  if (k.includes("deepseek")) return FREE;
  if (k.includes("gemma")) return FREE;
  if (k.includes("cerebras")) return FREE;
  if (k.includes("groq")) return FREE;
  if (k.includes("ollama")) return FREE;
  return UNKNOWN_PAID;
}

/**
 * Compute the USD cents cost of a single inference call. Rounds UP at the
 * cent boundary so the budget gate is conservative — small calls always
 * register at least 1 cent, never 0 (a stream of "0-cent" calls would
 * silently bypass the budget cap).
 */
export function calculateCostCents(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = getModelPrice(modelId);
  if (price.free) return 0;
  const inCost = (inputTokens * price.inputPerMillionCents) / 1_000_000;
  const outCost = (outputTokens * price.outputPerMillionCents) / 1_000_000;
  return Math.max(1, Math.ceil(inCost + outCost));
}

/** Test-only helper. */
export const _PRICES_FOR_TESTS = PRICES;
