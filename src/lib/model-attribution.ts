/**
 * SOVEREIGN MATRIX — Model Attribution
 *
 * Lightweight in-memory tracker for which models actually served requests.
 * Used by ai.ts and nvidia.ts to surface routing decisions in logs/metrics.
 * Persistence is intentionally not wired here — this is a hot-path
 * observability hook, not a billing source.
 *
 * Buckets follow the recordModel() call sites:
 *   ollama-local · cerebras · nvidia-nim-default · nvidia-nim-fallback
 *   claude-opus · claude-sonnet · gemini-flash · gemini-pro
 *   mistral-large · groq-{model}
 */
import { createLogger } from "@/lib/logger";

const log = createLogger("model-attribution");

interface Counter {
  count: number;
  lastUsed: number;
}

const counters = new Map<string, Counter>();

export function recordModel(model: string): void {
  const existing = counters.get(model);
  if (existing) {
    existing.count++;
    existing.lastUsed = Date.now();
  } else {
    counters.set(model, { count: 1, lastUsed: Date.now() });
  }
  // Sample 1% of calls to keep log volume manageable
  if (Math.random() < 0.01) {
    log.info("model used", { model, count: counters.get(model)?.count });
  }
}

export function getModelStats(): Array<{
  model: string;
  count: number;
  lastUsedAgo: number;
}> {
  const now = Date.now();
  return Array.from(counters.entries())
    .map(([model, c]) => ({
      model,
      count: c.count,
      lastUsedAgo: now - c.lastUsed,
    }))
    .sort((a, b) => b.count - a.count);
}

export function resetModelStats(): void {
  counters.clear();
}
