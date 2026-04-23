/**
 * NIM embedding + reranking — graceful wrappers.
 *
 * Thin layer on top of nvidia.ts's nimEmbed() + nimRerank(). Adds:
 *   - Silent failure when NIM_API_KEY is missing (returns null / [])
 *   - Text truncation to stay within model limits (512 tokens ≈ 2048 chars)
 *   - Simple in-memory cosine similarity so call sites don't import
 *     Drizzle SQL from a ranking function
 *
 * Used by:
 *   - Marketplace search (embed query → rank catalog)
 *   - Embedding backfill on new agent approval
 *   - Any future RAG use case inside the platform
 */

import { createLogger } from "@/lib/logger";
import { nimEmbed, nimRerank } from "@/lib/nvidia";

const log = createLogger("nim-embed");

/** Embedding model + its dimensionality. Kept together for sanity checks. */
export const NIM_EMBEDDING_MODEL = "nvidia/llama-3.2-nv-embedqa-1b-v2";
export const NIM_EMBEDDING_DIMS = 2048;

/** Hard cap on input text length before embedding. */
const MAX_EMBED_CHARS = 6000;

/* ─── Core wrappers ───────────────────────────────────────────── */

function nimKeyAvailable(): boolean {
  return Boolean(process.env.NIM_API_KEY ?? process.env.NVIDIA_API_KEY);
}

function truncate(s: string): string {
  if (s.length <= MAX_EMBED_CHARS) return s;
  return s.slice(0, MAX_EMBED_CHARS);
}

/**
 * Embed a single string. Returns null when:
 *   - No NIM key is configured
 *   - Empty or whitespace-only input
 *   - Upstream API error
 *
 * Never throws. Callers should treat null as "no semantic signal
 * available" and fall back to keyword matching.
 */
export async function embedOne(text: string): Promise<number[] | null> {
  const clean = text?.trim();
  if (!clean) return null;
  if (!nimKeyAvailable()) return null;

  try {
    const [vec] = await nimEmbed(truncate(clean), NIM_EMBEDDING_MODEL);
    if (!vec || vec.length === 0) return null;
    return vec;
  } catch (err) {
    log.warn("embedOne failed; degrading to null", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Batch-embed a list of strings. Returns an array of the same length,
 * where each entry is either a vector or null (on per-item failure).
 */
export async function embedMany(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts.length || !nimKeyAvailable()) {
    return texts.map(() => null);
  }
  const cleaned = texts.map((t) => truncate((t ?? "").trim()));
  try {
    const vectors = await nimEmbed(cleaned, NIM_EMBEDDING_MODEL);
    return vectors.map((v) => (v && v.length > 0 ? v : null));
  } catch (err) {
    log.warn("embedMany failed; degrading to all null", {
      count: texts.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return texts.map(() => null);
  }
}

/* ─── Cosine similarity ───────────────────────────────────────── */

/**
 * Cosine similarity in [-1, 1] for two equal-length vectors.
 * Returns 0 for empty / mismatched inputs (safest default —
 * zero-similarity items sort to the bottom).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ─── Reranker wrapper ────────────────────────────────────────── */

export interface RerankedItem<T> {
  item: T;
  score: number;
  index: number;
}

/**
 * Rerank up to `topK` passages against a query using Nemotron reranker.
 * Returns items in highest-score-first order.
 *
 * Falls back to the original order (by array index) when:
 *   - NIM key is missing
 *   - Fewer than 2 passages (nothing to rerank)
 *   - Upstream error
 *
 * Accepts arbitrary item payloads; caller supplies a `textOf` extractor
 * so this function works with marketplace rows, RAG chunks, etc.
 */
export async function rerank<T>(
  query: string,
  items: T[],
  textOf: (item: T) => string,
  topK = 10,
): Promise<RerankedItem<T>[]> {
  if (items.length === 0) return [];
  if (items.length === 1 || !nimKeyAvailable()) {
    return items.slice(0, topK).map((item, index) => ({ item, index, score: 0 }));
  }

  const passages = items.map((it) => truncate(textOf(it) ?? ""));
  try {
    const ranked = await nimRerank(query, passages, topK);
    return ranked.map((r) => ({
      item: items[r.index],
      score: r.score,
      index: r.index,
    }));
  } catch (err) {
    log.warn("rerank failed; returning original order", {
      error: err instanceof Error ? err.message : String(err),
    });
    return items.slice(0, topK).map((item, index) => ({ item, index, score: 0 }));
  }
}
