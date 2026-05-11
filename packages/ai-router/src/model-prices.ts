/**
 * MODEL PRICES — single source of truth for AI inference cost.
 *
 * Used by the router to convert (model, tokens) into actual USD cents.
 * Prices are list prices in cents per million tokens, separated into
 * input vs output tiers (which differ 3-10x for most providers).
 *
 * Sources verified at time of writing — Anthropic, OpenAI, Google,
 * NVIDIA, Cerebras, Groq published price pages.
 *
 * Free models are explicitly listed at $0 — never let "unknown model"
 * fall through to a non-zero default for a free provider.
 */

/** Cost in cents per million tokens. */
export interface ModelPrice {
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
    | "unknown";
  /** Whether this model is part of a free tier. */
  free: boolean;
}

const FREE: Omit<ModelPrice, "provider"> = {
  inputPerMillionCents: 0,
  outputPerMillionCents: 0,
  free: true,
};

/**
 * Canonical prices. Keys are normalized lowercase model identifiers.
 */
export const PRICES: Record<string, ModelPrice> = {
  // ── Anthropic Claude ──
  "claude-opus-4-7": {
    inputPerMillionCents: 1500,
    outputPerMillionCents: 7500,
    provider: "anthropic",
    free: false,
  },
  "claude-sonnet-4-6": {
    inputPerMillionCents: 300,
    outputPerMillionCents: 1500,
    provider: "anthropic",
    free: false,
  },
  "claude-haiku-4-5": {
    inputPerMillionCents: 100,
    outputPerMillionCents: 500,
    provider: "anthropic",
    free: false,
  },

  // ── OpenAI ──
  "gpt-4o": {
    inputPerMillionCents: 250,
    outputPerMillionCents: 1000,
    provider: "openai",
    free: false,
  },
  "gpt-4o-mini": {
    inputPerMillionCents: 15,
    outputPerMillionCents: 60,
    provider: "openai",
    free: false,
  },

  // ── Google Gemini ──
  "gemini-2.5-pro": {
    inputPerMillionCents: 125,
    outputPerMillionCents: 1000,
    provider: "google",
    free: false,
  },
  "gemini-2.0-flash": {
    inputPerMillionCents: 10,
    outputPerMillionCents: 40,
    provider: "google",
    free: false,
  },

  // ── NVIDIA NIM (free dev tier) ──
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": {
    ...FREE,
    provider: "nvidia-nim",
  },
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

/** Default tier for unrecognized models — assume mid-range paid model so
 *  we err on the safe side of the budget gate. */
const UNKNOWN_PAID: ModelPrice = {
  inputPerMillionCents: 100,
  outputPerMillionCents: 300,
  provider: "unknown",
  free: false,
};

/** Resolve a model identifier (case-insensitive, prefix-tolerant) to a price.
 *  Returns UNKNOWN_PAID if no match — never silently treats unknown as free. */
export function getModelPrice(modelId: string): ModelPrice {
  if (!modelId) return UNKNOWN_PAID;
  const k = modelId.toLowerCase().trim();
  if (PRICES[k]) return PRICES[k];

  for (const [name, price] of Object.entries(PRICES)) {
    if (k.startsWith(name) || k.includes(name)) return price;
  }

  // Family-level fallbacks — keep treating unknown Claude/GPT/Gemini as
  // paid until the price table is updated.
  if (k.includes("claude")) return PRICES["claude-sonnet-4-6"];
  if (k.includes("gemini")) return PRICES["gemini-2.5-pro"];
  if (k.includes("gpt")) return PRICES["gpt-4o"];
  if (k.includes("nvidia") || k.includes("nemotron"))
    return { ...FREE, provider: "nvidia-nim" };
  if (k.includes("deepseek")) return { ...FREE, provider: "deepseek" };
  if (k.includes("gemma")) return { ...FREE, provider: "google" };
  if (k.includes("cerebras")) return { ...FREE, provider: "cerebras" };
  if (k.includes("groq")) return { ...FREE, provider: "groq" };
  if (k.includes("ollama")) return { ...FREE, provider: "ollama-local" };
  return UNKNOWN_PAID;
}

/**
 * Compute the USD cents cost of a single inference call. Rounds UP at
 * the cent boundary so the budget gate is conservative — small calls
 * always register at least 1 cent, never 0.
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
