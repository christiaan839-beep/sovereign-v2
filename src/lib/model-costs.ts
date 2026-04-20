/**
 * MODEL COSTS — per-million-token pricing table + cost estimation.
 *
 * Used to populate the `usage.input_tokens / output_tokens / cost_cents`
 * columns so margin reporting, usage-based billing, and the Anthropic
 * partnership metrics are accurate (not "count of runs" but "dollars
 * spent on Claude vs dollars spent on NIM").
 *
 * Prices are in USD per 1M tokens and reflect the last public rate
 * cards we observed. When a provider changes price, update the table
 * and bump RATE_CARD_VERSION; historical rows keep their original
 * cost estimates. Rates are stored as integer cents-per-1M-tokens to
 * avoid floating-point drift during aggregation.
 *
 * What to do if a model isn't here:
 *   - Router defaults to the UNKNOWN_COST fallback (~free-tier bucket)
 *   - The `unknownModels` telemetry returns the string, nudging us
 *     to update the table during the next release
 *
 * Why not dynamic billing API lookups?
 *   - We want cost estimation AT INVOCATION TIME (so we can enforce
 *     tier-based spend caps), not after the fact. Provider billing
 *     APIs are eventual-consistent and can lag hours.
 *   - Rate cards change rarely; this file is cheap to maintain.
 */

export const RATE_CARD_VERSION = "2026-04-20";

interface ModelRate {
  /** Cents per 1M input tokens — use Math.round() to avoid floats. */
  inputCentsPerMTok: number;
  /** Cents per 1M output tokens. */
  outputCentsPerMTok: number;
  /** Provider bucket — matches model-attribution.ts canonical names. */
  provider: string;
  /** Marketing display name for reports (Anthropic Partnership page uses this). */
  displayName: string;
}

/** Pattern → rate mapping. Matched by substring (case-insensitive) on model IDs. */
const RATE_TABLE: Array<{ pattern: RegExp; rate: ModelRate }> = [
  // Anthropic — source: anthropic.com/pricing (2026)
  {
    pattern: /claude.?opus/i,
    rate: { inputCentsPerMTok: 1500, outputCentsPerMTok: 7500, provider: "anthropic", displayName: "Claude Opus" },
  },
  {
    pattern: /claude.?sonnet/i,
    rate: { inputCentsPerMTok: 300, outputCentsPerMTok: 1500, provider: "anthropic", displayName: "Claude Sonnet" },
  },
  {
    pattern: /claude.?haiku/i,
    rate: { inputCentsPerMTok: 80, outputCentsPerMTok: 400, provider: "anthropic", displayName: "Claude Haiku" },
  },

  // Google — Gemini pricing (2026)
  {
    pattern: /gemini.*pro/i,
    rate: { inputCentsPerMTok: 125, outputCentsPerMTok: 500, provider: "google", displayName: "Gemini Pro" },
  },
  {
    pattern: /gemini|gemma/i,
    rate: { inputCentsPerMTok: 7, outputCentsPerMTok: 30, provider: "google", displayName: "Gemini Flash" },
  },

  // NVIDIA NIM — free tier at time of writing; we still track for fairness
  // against the partnership metrics (inputs/outputs matter even if $0).
  {
    pattern: /nvidia|nemotron|deepseek-v3|qwen.*nim|mistral-small.*nim/i,
    rate: { inputCentsPerMTok: 0, outputCentsPerMTok: 0, provider: "nvidia-nim", displayName: "NVIDIA NIM" },
  },

  // OpenAI — if ever used
  {
    pattern: /gpt-4(?:[.-]?[o0])/i,
    rate: { inputCentsPerMTok: 500, outputCentsPerMTok: 1500, provider: "openai", displayName: "GPT-4o" },
  },
  {
    pattern: /gpt-4/i,
    rate: { inputCentsPerMTok: 3000, outputCentsPerMTok: 6000, provider: "openai", displayName: "GPT-4" },
  },
  {
    pattern: /gpt-3\.5/i,
    rate: { inputCentsPerMTok: 50, outputCentsPerMTok: 150, provider: "openai", displayName: "GPT-3.5" },
  },

  // Groq — ultra-fast + cheap
  {
    pattern: /groq|llama.*70b|mixtral/i,
    rate: { inputCentsPerMTok: 59, outputCentsPerMTok: 79, provider: "groq", displayName: "Groq" },
  },

  // Cerebras — free tier
  {
    pattern: /cerebras/i,
    rate: { inputCentsPerMTok: 0, outputCentsPerMTok: 0, provider: "cerebras", displayName: "Cerebras" },
  },

  // Local models — always free
  {
    pattern: /ollama|local/i,
    rate: { inputCentsPerMTok: 0, outputCentsPerMTok: 0, provider: "local", displayName: "Local (Ollama)" },
  },

  // DeepSeek via their own API — cheap reasoning
  {
    pattern: /deepseek/i,
    rate: { inputCentsPerMTok: 14, outputCentsPerMTok: 28, provider: "deepseek", displayName: "DeepSeek" },
  },

  // Generic Llama — fallback via various providers
  {
    pattern: /llama/i,
    rate: { inputCentsPerMTok: 20, outputCentsPerMTok: 20, provider: "meta", displayName: "Llama" },
  },
];

const UNKNOWN_COST: ModelRate = {
  inputCentsPerMTok: 100, // Conservative mid-tier default to prevent surprise
  outputCentsPerMTok: 300,
  provider: "unknown",
  displayName: "Unknown",
};

/**
 * Look up the rate for a given model identifier. Patterns are matched
 * in the order they appear, so specific patterns (claude-opus) must
 * come BEFORE generic ones (claude) in the table above.
 */
export function getRate(modelId: string): ModelRate {
  if (!modelId) return UNKNOWN_COST;
  for (const { pattern, rate } of RATE_TABLE) {
    if (pattern.test(modelId)) return rate;
  }
  return UNKNOWN_COST;
}

/**
 * Estimate the cost in cents for a (modelId, inputTokens, outputTokens)
 * triple. Returns a non-negative integer. Math is done in integer cents
 * to avoid floating-point drift when we aggregate millions of rows.
 *
 * Example:
 *   estimateCostCents("claude-sonnet", 12_000, 4_000)
 *   // → (12000 * 300 / 1_000_000) + (4000 * 1500 / 1_000_000)
 *   // → 3.6 + 6  → 9.6 → rounded up to 10 cents
 */
export function estimateCostCents(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): { cents: number; rate: ModelRate } {
  const rate = getRate(modelId);
  const input = (inputTokens * rate.inputCentsPerMTok) / 1_000_000;
  const output = (outputTokens * rate.outputCentsPerMTok) / 1_000_000;
  // Round up to the nearest cent. Ceil avoids the "we gave someone a
  // 0-cent run" class of errors during margin reporting.
  const cents = Math.ceil(input + output);
  return { cents, rate };
}

/**
 * Estimate tokens from raw character counts when the provider didn't
 * return token metadata. 4 chars ≈ 1 token is GPT's heuristic; wide
 * enough for non-English text too.
 */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}
