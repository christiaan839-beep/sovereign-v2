/**
 * Per-run cost estimation in cents.
 *
 * Maps model IDs to input/output token costs. Used by the credit system
 * to place holds before agent runs. Conservative estimate — actual
 * captured cost may be lower (we never overcharge: captureHold captures
 * the amount that was held, not more).
 *
 * Update strategy: when a provider changes pricing, edit this file and
 * run `npm test` — the cost tests will catch contradictions between
 * the new numbers and the hard-coded expectations.
 *
 * All numbers are stored as CENTS per 1,000 tokens, fractional allowed.
 * The estimators round UP to whole-cent integers so we never place a
 * hold smaller than what might be captured.
 */

export interface ModelCost {
  inputCentsPer1k: number;
  outputCentsPer1k: number;
}

export const MODEL_COSTS: Record<string, ModelCost> = {
  // ─── NVIDIA NIM — free tier upstream; we charge marginal infra cost ───
  "nvidia/nemotron-ultra-253b-v1":          { inputCentsPer1k: 0.5, outputCentsPer1k: 2.0 },
  "nvidia/nemotron-3-super-120b-a12b":       { inputCentsPer1k: 0.3, outputCentsPer1k: 1.2 },
  "nvidia/nemotron-3-nano-30b-a3b":          { inputCentsPer1k: 0.1, outputCentsPer1k: 0.4 },
  "nvidia/nvidia-nemotron-nano-9b-v2":       { inputCentsPer1k: 0.05, outputCentsPer1k: 0.2 },
  "nvidia/nemotron-video-vl-7b":             { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "nvidia/nemotron-retriever-rerank-4b":     { inputCentsPer1k: 0.1, outputCentsPer1k: 0.1 },

  // Meta via NIM
  "meta/llama-4-maverick-17b-128e":          { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "meta/llama-4-scout-17b-16e-instruct":     { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },

  // Google via NIM (Gemma 4 is NIM-hosted; Gemini direct has its own row below)
  "google/gemma-4-31b-it":                   { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "google/gemma-4-e4b-it":                   { inputCentsPer1k: 0.05, outputCentsPer1k: 0.2 },

  // Mistral via NIM
  "mistralai/mistral-small-3-1-24b-instruct": { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "mistralai/mistral-small-4-moe":           { inputCentsPer1k: 0.3, outputCentsPer1k: 1.0 },

  // Microsoft via NIM
  "microsoft/phi-4-reasoning-14b":           { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },

  // Chinese-weight (hosted on NVIDIA US infra — see sovereignty gate in nvidia.ts)
  "qwen/qwen-3.5-397b-a17b":                 { inputCentsPer1k: 0.4, outputCentsPer1k: 1.5 },
  "qwen/qwen3-235b-a22b":                    { inputCentsPer1k: 0.3, outputCentsPer1k: 1.2 },
  "qwen/qwen3-coder-30b-a3b-instruct":       { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "moonshotai/kimi-k2.5":                    { inputCentsPer1k: 0.3, outputCentsPer1k: 1.2 },
  "deepseek-ai/deepseek-v3-2-0324":          { inputCentsPer1k: 0.3, outputCentsPer1k: 1.2 },

  // ─── Cerebras (paid pass-through) ──────────────────────────────────
  "cerebras/llama3.1-70b":                   { inputCentsPer1k: 0.6, outputCentsPer1k: 2.4 },
  "llama-4-scout-17b-16e-instruct":           { inputCentsPer1k: 0.4, outputCentsPer1k: 1.8 }, // alias used by cerebrasText

  // ─── Claude (BYOK markup 1.15× vs list) ────────────────────────────
  "claude-sonnet-4-6":                       { inputCentsPer1k: 35, outputCentsPer1k: 175 },
  "claude-opus-4-6":                         { inputCentsPer1k: 175, outputCentsPer1k: 875 },

  // ─── Gemini (BYOK markup 1.15× vs list) ────────────────────────────
  "gemini-2.5-flash":                        { inputCentsPer1k: 9, outputCentsPer1k: 35 },
  "gemini-2.5-pro":                          { inputCentsPer1k: 145, outputCentsPer1k: 575 },
};

/** Defensive default when a model ID isn't in the table. */
const DEFAULT_COST: ModelCost = { inputCentsPer1k: 1, outputCentsPer1k: 4 };

/**
 * Estimate run cost in cents for a given token count.
 * Returns a whole-cent integer >= 1. Unknown models fall back to the
 * conservative default cost.
 */
export function estimateRunCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const cost = MODEL_COSTS[model] ?? DEFAULT_COST;
  const totalCents =
    (inputTokens * cost.inputCentsPer1k) / 1000 +
    (outputTokens * cost.outputCentsPer1k) / 1000;
  return Math.max(1, Math.ceil(totalCents));
}

/**
 * Pre-execution hold amount for one agent call. Conservative:
 * 2× input budget (prompt + injected memory + research) + full output
 * budget. Capture uses the real amount so over-hold never over-charges.
 *
 * Default maxTokens = 2000 matches the agent-factory default.
 */
export function estimatedHoldCents(model: string, maxTokens: number = 2000): number {
  return estimateRunCostCents(model, maxTokens * 2, maxTokens);
}
