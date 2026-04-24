/**
 * Data-sovereignty guard — parity with nvidia.ts for new providers.
 *
 * `src/lib/nvidia.ts` already splits SOVEREIGNTY_SAFE_MODELS and
 * CHINESE_WEIGHT_MODELS and gates routing on `DATA_SOVEREIGNTY_MODE=true`.
 * Regulated customers (insurance, healthcare, US federal) use this flag
 * to guarantee that inference never hits models with Chinese-origin
 * weights.
 *
 * When the 8 new frontier providers landed (2026-04-24 UMP-4), Together /
 * OpenRouter / Databricks all expose DeepSeek + Qwen + other CN-weight
 * models in their catalogs. Without this guard, those adapters were
 * silently bypassing the sovereignty flag that nvidia.ts respects.
 *
 * This module centralizes the check. Every new adapter that catalogs a
 * model that *might* include CN-weight variants calls `assertSovereignty()`
 * before its fetch — if the flag is on and the slug matches a banned
 * pattern, we throw a structured ProviderError that the router catches
 * + falls through.
 */

import { ProviderError } from "./provider-utils";

/**
 * Known CN-origin model-family substrings. If a slug contains any of
 * these AND `DATA_SOVEREIGNTY_MODE=true`, the call is blocked.
 *
 * Deliberately permissive (substring match) — new CN-weight variants
 * tend to keep the family name prominent (deepseek-v3-new, qwen2.5-max,
 * etc). Err on the side of blocking rather than accidentally allowing.
 */
const CHINESE_WEIGHT_PATTERNS: readonly string[] = [
  "deepseek",
  "qwen",
  "yi-",
  "yi_",
  "yi-large",
  "moonshot",
  "kimi",
  "glm",
  "minimax",
  "01-ai",
  "zhipu",
];

/**
 * Is `DATA_SOVEREIGNTY_MODE` on? Module-load-time read mirrors the
 * pattern in nvidia.ts (same source, same evaluation time) so the
 * flag can't flip mid-request.
 */
const SOVEREIGNTY_ON = process.env.DATA_SOVEREIGNTY_MODE === "true";

/**
 * Is this model slug blocked by the current sovereignty mode?
 * Pure function — safe to call from anywhere, including tests.
 */
export function isSovereigntyBlocked(slug: string): boolean {
  if (!SOVEREIGNTY_ON) return false;
  const lower = slug.toLowerCase();
  return CHINESE_WEIGHT_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Throws a ProviderError if the slug is blocked. Called at the top of
 * each new adapter's `*Chat()` function. The router catches the error
 * and tries the next failover step; the platform keeps running with
 * sovereignty-safe models only.
 */
export function assertSovereignty(
  slug: string,
  provider: string,
): void {
  if (isSovereigntyBlocked(slug)) {
    throw new ProviderError(
      "provider_not_configured",
      provider,
      `Model "${slug}" is blocked under DATA_SOVEREIGNTY_MODE. Use a sovereignty-safe slug or disable the flag.`,
    );
  }
}
