/**
 * SOVEREIGN MATRIX — Model rate card.
 *
 * Per-1K-token cost in USD micros (1/1_000_000 of a dollar) for every model
 * the platform routes to. Used by the per-tenant cost dashboard to estimate
 * gross margin per account: revenue (subscription) − infra cost (sum of
 * model-call cost per request).
 *
 * Numbers are rough industry rates as of 2026-01; refine when we wire up
 * real provider invoicing. Open-source models served via NIM are billed at
 * Sovereign's NIM seat fee, not per-token, so they're listed at $0 here.
 *
 * NOTE: input/output blended for simplicity — we don't yet split call sites
 * by token direction. When we do (P-future), expand this to { input, output }.
 */

/** USD per 1,000 tokens, in micros (millionths of a dollar). */
export const MODEL_RATE_USD_MICROS_PER_1K: Record<string, number> = {
  // ── Anthropic ────────────────────────────────────────────────────
  "claude-opus": 22_500, // $0.0225/1K blended
  "claude-sonnet": 4_500, // $0.0045/1K blended
  // ── Google ───────────────────────────────────────────────────────
  "gemini-flash": 600, // $0.0006/1K blended
  "gemini-pro": 5_000, // $0.005/1K blended
  // ── Cerebras / Groq (effectively free at platform scale) ────────
  cerebras: 100, // ~$0.0001/1K
  "groq-default": 200,
  "groq-deepseek": 200,
  "groq-qwen": 200,
  // ── Open-weights via NIM (we pay seat, not per-token) ───────────
  "nvidia-nim-default": 0,
  "nvidia-nim-fallback": 0,
  "mistral-large": 0,
  "ollama-local": 0,
};

/** Default per-call token estimate when we have no measurement (matches
 *  agent-factory.ts:511 which records 500 tokens per agent call). */
export const DEFAULT_TOKENS_PER_CALL = 500;

export function tokenCostMicros(
  model: string,
  tokens: number = DEFAULT_TOKENS_PER_CALL,
): number {
  const ratePer1K = MODEL_RATE_USD_MICROS_PER_1K[model] ?? 0;
  return Math.round((tokens / 1000) * ratePer1K);
}

export function microsToUsdString(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
