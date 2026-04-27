/**
 * model-attribution — Records which model handled the current request.
 *
 * The unified AI router (`src/lib/ai.ts`) and the NIM gateway (`src/lib/nvidia.ts`)
 * call `recordModel(modelId)` after they pick a provider. The agent factory and
 * usage telemetry can then read the most-recent attribution to populate the
 * `usage.provider` column (see `src/db/schema.ts:214`).
 *
 * This module is intentionally minimal:
 *   - No DB writes here — it's a request-scoped breadcrumb.
 *   - No throws — attribution is a side-channel; AI calls must never fail
 *     because attribution failed.
 *   - Lazy-imported by callers to avoid circular-dependency risk
 *     (`ai.ts` and `nvidia.ts` both `await import("@/lib/model-attribution")`).
 *
 * The bucketing of raw model IDs into coarse provider names matches the
 * convention referenced by `usage.provider` in the DB schema.
 */
export type ProviderBucket =
  | "anthropic"
  | "nvidia-nim"
  | "google-gemini"
  | "groq"
  | "cerebras"
  | "ollama-local"
  | "mistral"
  | "unknown";

let lastModel: string | undefined;
let lastBucket: ProviderBucket | undefined;

/**
 * Map a raw model identifier to a coarse provider bucket. Used by usage
 * telemetry so that aggregations don't have to enumerate every model name.
 */
export function bucketOf(modelId: string): ProviderBucket {
  if (!modelId) return "unknown";
  const m = modelId.toLowerCase();
  if (
    m.includes("claude") ||
    m.includes("anthropic") ||
    m.includes("opus") ||
    m.includes("sonnet")
  ) {
    return "anthropic";
  }
  if (m.includes("gemini") || m.includes("google")) return "google-gemini";
  if (m.includes("ollama")) return "ollama-local";
  if (m.includes("cerebras")) return "cerebras";
  if (m.includes("mistral")) return "mistral";
  if (
    m.startsWith("groq") ||
    m.includes("groq-") ||
    m.includes("deepseek") ||
    m.includes("qwen") ||
    m.includes("llama-3.1-8b-instant")
  ) {
    return "groq";
  }
  if (m.includes("nvidia") || m.includes("nim") || m.includes("nemotron"))
    return "nvidia-nim";
  return "unknown";
}

/**
 * Record that `modelId` handled the current request.
 *
 * Safe to call multiple times — each call overwrites the last. A request that
 * fans out to multiple providers will reflect the final-used model, which
 * matches what we want to bill the user for.
 */
export function recordModel(modelId: string): void {
  if (!modelId || typeof modelId !== "string") return;
  lastModel = modelId;
  lastBucket = bucketOf(modelId);
}

/** Last raw model ID recorded via `recordModel`, or undefined if none. */
export function getLastModel(): string | undefined {
  return lastModel;
}

/** Provider bucket for the last recorded model, or undefined if none. */
export function getLastBucket(): ProviderBucket | undefined {
  return lastBucket;
}

/** Reset attribution state — primarily for tests and request cleanup. */
export function resetModelAttribution(): void {
  lastModel = undefined;
  lastBucket = undefined;
}
