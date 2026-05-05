/**
 * Model attribution — request-scoped tracking of which AI provider/model
 * served the current request.
 *
 * The unified router (`src/lib/ai.ts`) and the NIM client
 * (`src/lib/nvidia.ts`) both call `recordModel(modelId)` after they
 * decide which provider to use. We hold the latest call inside an
 * `AsyncLocalStorage` so concurrent requests don't clobber each other's
 * attribution. Reading via `getLastModel()` is safe from anywhere
 * inside the same async chain (including tool calls, helper functions,
 * try/catch blocks).
 *
 * Used by:
 *   - `src/lib/cost-ledger.ts` (defaults provider when none was given)
 *   - `src/lib/agent-factory.ts` (puts the model into the response envelope)
 *   - `src/app/api/_misc/admin/*` (admin telemetry)
 *
 * Outside an `AsyncLocalStorage` context (e.g. background jobs not
 * wrapped via `withAttribution`), `recordModel()` falls back to a
 * module-level memo so the value is still readable from `getLastModel()`
 * within the same tick — but that fallback is a debugging aid, not a
 * correctness guarantee.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface AttributionState {
  /** Bucketed provider — anthropic, nvidia-nim, gemini, groq, etc. */
  provider: string | null;
  /** Specific model identifier as the upstream API knows it. */
  modelId: string | null;
}

const storage = new AsyncLocalStorage<AttributionState>();
const fallback: AttributionState = { provider: null, modelId: null };

const PROVIDER_PREFIX_MAP: Record<string, string> = {
  "claude-": "anthropic",
  "ollama-": "ollama-local",
  cerebras: "cerebras",
  "nvidia-nim": "nvidia-nim",
  "nim-": "nvidia-nim",
  nemotron: "nvidia-nim",
  llama: "nvidia-nim",
  "gemini-": "gemini",
  "groq-": "groq",
  "deepseek-": "groq",
  "qwen-": "groq",
  mistral: "nvidia-nim",
};

/**
 * Map a model identifier (free-form string used by the upstream API)
 * to the analytics-bucket provider name we standardise on. Keeping
 * the bucket list small means dashboards stay readable.
 */
export function inferProvider(modelId: string): string {
  const lower = modelId.toLowerCase();
  for (const [prefix, provider] of Object.entries(PROVIDER_PREFIX_MAP)) {
    if (lower.startsWith(prefix) || lower.includes(prefix)) return provider;
  }
  return "unknown";
}

/**
 * Record the model that just served the current request. Safe to call
 * multiple times — the last call within a request wins (matches the
 * "what model finished the request" mental model).
 */
export function recordModel(modelId: string): void {
  const state = storage.getStore();
  const next = { provider: inferProvider(modelId), modelId };
  if (state) {
    state.provider = next.provider;
    state.modelId = next.modelId;
  } else {
    fallback.provider = next.provider;
    fallback.modelId = next.modelId;
  }
}

/** Return the most recent recorded model id, or null. */
export function getLastModel(): string | null {
  return storage.getStore()?.modelId ?? fallback.modelId;
}

/** Return the analytics bucket for the most recent recorded model. */
export function getLastProvider(): string | null {
  return storage.getStore()?.provider ?? fallback.provider;
}

/**
 * Wrap a handler so all `recordModel()` calls inside it are scoped to
 * a fresh attribution context. Use this in API route entry points so
 * attribution from concurrent requests never leaks across them.
 *
 *   export async function POST(req: Request) {
 *     return withAttribution(async () => { ... });
 *   }
 */
export function withAttribution<T>(fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve(storage.run({ provider: null, modelId: null }, fn));
}

/** Test hook — clears the fallback memo between unit tests. */
export function _resetForTests(): void {
  fallback.provider = null;
  fallback.modelId = null;
}
