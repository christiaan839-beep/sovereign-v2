/**
 * Provider cost classification — drives the free-first router.
 *
 * Three tiers:
 *   "free"       — $0 (Ollama local, NVIDIA NIM, Cerebras, Groq free tier)
 *   "paid"       — per-token billing (OpenAI, Anthropic, Gemini Pro, xAI,
 *                  Mistral La Plateforme, Cohere, Together, Databricks,
 *                  Replicate)
 *   "metered"    — free tier + usage-based paid tier (Groq with burst,
 *                  Together has $1 free credits)
 *
 * When `SOVEREIGN_FREE_ONLY=true`, the router MUST route to free
 * providers. If no free provider can serve the request (all circuit
 * breakers open, all keys missing), the call fails with
 * `upstream_unavailable` rather than silently escalating to paid.
 *
 * This is a real feature for:
 *   - Cost-conscious operators (students, solo builders)
 *   - Regulated environments where LLM spend is capital-approval gated
 *   - Sandbox / staging / load-testing environments
 *   - The free tier on sovereignmatrix.agency itself
 */

export type CostTier = "free" | "paid" | "metered";

/**
 * Map from provider slug (as used in recordModel + ai.ts routing) to
 * cost tier. Keep alphabetical.
 */
export const PROVIDER_COSTS: Record<string, CostTier> = {
  // Free — always $0
  ollama: "free",
  nim: "free",
  "nvidia-nim": "free",
  "nvidia-nim-default": "free",
  "nvidia-nim-fallback": "free",
  cerebras: "free",

  // Free tier, paid-burst — usable in free mode (router bails if we hit
  // their free rate limit rather than overflowing to paid).
  groq: "metered",
  "groq-deepseek": "metered",
  "groq-qwen": "metered",
  "groq-groq": "metered",

  // Paid — skip when free-only mode is on
  "gemini-flash": "paid", // free quota but closely metered; treat as paid for safety
  "gemini-pro": "paid",
  "claude-opus": "paid",
  "claude-sonnet": "paid",
  openai: "paid",
  xai: "paid",
  "mistral-direct": "paid",
  cohere: "paid",
  openrouter: "paid",
  together: "paid",
  databricks: "paid",
  replicate: "paid",
};

/**
 * True when SOVEREIGN_FREE_ONLY=true in the current process.
 * Module-load-time read (no mid-request flip, matches nvidia.ts
 * DATA_SOVEREIGNTY_MODE semantics).
 */
export const FREE_ONLY_MODE = process.env.SOVEREIGN_FREE_ONLY === "true";

/**
 * Is this provider allowed under the current mode? Pure function —
 * easy to unit-test. Unknown providers default to "paid" (conservative:
 * don't let an unmapped new provider silently slip past the gate).
 */
export function isProviderAllowedFree(provider: string): boolean {
  if (!FREE_ONLY_MODE) return true;
  const tier = PROVIDER_COSTS[provider] ?? "paid";
  return tier === "free" || tier === "metered";
}

/**
 * Debug helper — returns the human-readable mode string for telemetry
 * + status pages. Appears in /api/_health/slo when free-only is on.
 */
export function describeRoutingMode(): string {
  return FREE_ONLY_MODE
    ? "free-only (SOVEREIGN_FREE_ONLY=true): paid providers skipped"
    : "mixed (free preferred, paid available as fallback)";
}
