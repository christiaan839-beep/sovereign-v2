/**
 * SOVEREIGN MATRIX — NeMo Retriever wrapper (Wave 133).
 *
 * Unifies the embed + rerank loop into a single high-level `retrieve()`
 * call. Replaces the hand-rolled "embed → vector search → rerank"
 * dance that callers were doing piecemeal, and adds two patterns NeMo
 * Retriever ships with by default:
 *
 *   - Score-threshold cut-off (drop matches below similarity X)
 *   - Diversity-aware re-ranking (penalise near-duplicate passages)
 *
 * Wire-protocol compatibility:
 *   - Embeddings: NVIDIA `nvidia/llama-nemotron-embed-1b-v2` (1024-dim)
 *     via the existing `nimChat`-adjacent endpoint
 *   - Reranker: NVIDIA `nvidia/llama-nemotron-rerank-1b-v2`
 *
 * Activation:
 *   Works out of the box on the global `NVIDIA_NIM_API_KEY`. When
 *   `OSS_INFERENCE_ENDPOINT` is configured AND
 *   `OSS_RETRIEVER_ENDPOINT` is set, swaps to self-hosted retriever
 *   automatically. Falls back to NIM-managed otherwise.
 *
 * Why this is a separate file from `nvidia.ts`:
 *   `nvidia.ts` is the low-level wire client. This file is the agent-
 *   facing surface — input is "query + corpus", output is "top-K
 *   passages by relevance, deduplicated".
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";
import { getNimKey } from "@/lib/nvidia";
import { getOssEndpoint, getOssApiKey, getOssHost } from "@/lib/oss-inference";
import { createLogger } from "@/lib/logger";

const log = createLogger("nemo-retriever");

const NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NIM_HOST = "integrate.api.nvidia.com";

const EMBED_MODEL = "nvidia/llama-nemotron-embed-1b-v2";
const RERANK_MODEL = "nvidia/llama-nemotron-rerank-1b-v2";

export interface Passage {
  /** Caller-supplied id — opaque, returned in matches for joining. */
  id: string;
  /** Plain text. */
  text: string;
  /** Optional metadata returned alongside the match. */
  metadata?: Record<string, unknown>;
}

export interface Match extends Passage {
  /** Rerank score, higher = more relevant. NIM returns logits, we expose them raw. */
  score: number;
}

export interface RetrieveOptions {
  /** Cap on returned matches. Default 5. */
  topK?: number;
  /** Drop matches below this rerank score. Default -Infinity (off). */
  minScore?: number;
  /** Penalise near-duplicates. Default true. */
  diversity?: boolean;
  /** Per-call rule id for outboundFetch audit. */
  ruleId?: string;
}

/**
 * Detects whether a self-hosted retriever endpoint is wired up.
 * Distinct from the inference endpoint — operators can run retriever
 * on different infra (CPU-only is fine; embeddings + rerank are cheap).
 */
export function getRetrieverEndpoint(): { url: string; host: string } | null {
  const oss = process.env.OSS_RETRIEVER_ENDPOINT?.trim();
  if (oss && oss.length > 0) {
    try {
      const host = new URL(oss).hostname;
      return { url: oss.replace(/\/+$/, ""), host };
    } catch {
      return null;
    }
  }
  // Fallback: piggyback on the OSS inference endpoint if the operator
  // is running a combined stack (vLLM + retriever side-car).
  const inf = getOssEndpoint();
  const host = getOssHost();
  if (inf && host) return { url: inf, host };
  return null;
}

async function callEmbed(texts: string[]): Promise<number[][]> {
  const overrideEndpoint = getRetrieverEndpoint();
  const url = overrideEndpoint
    ? `${overrideEndpoint.url}/embeddings`
    : `${NIM_BASE}/embeddings`;
  const host = overrideEndpoint?.host ?? NIM_HOST;
  const apiKey =
    (overrideEndpoint ? getOssApiKey() : null) || (await getNimKey());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await outboundFetchAsResponse(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: texts,
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(30_000),
    },
    { ruleId: "nemo-retriever.embed", allowedHosts: [host] },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`embed failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  return (data.data ?? []).map((d) => d.embedding);
}

async function callRerank(
  query: string,
  passages: string[],
): Promise<number[]> {
  const overrideEndpoint = getRetrieverEndpoint();
  const url = overrideEndpoint
    ? `${overrideEndpoint.url}/ranking`
    : `${NIM_BASE}/ranking`;
  const host = overrideEndpoint?.host ?? NIM_HOST;
  const apiKey =
    (overrideEndpoint ? getOssApiKey() : null) || (await getNimKey());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await outboundFetchAsResponse(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: RERANK_MODEL,
        query: { text: query },
        passages: passages.map((p) => ({ text: p })),
      }),
      signal: AbortSignal.timeout(30_000),
    },
    { ruleId: "nemo-retriever.rerank", allowedHosts: [host] },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`rerank failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    rankings?: Array<{ index: number; logit: number }>;
  };
  const rankings = data.rankings ?? [];
  // Return a score-per-input-index array. NIM returns in any order.
  const scores = new Array<number>(passages.length).fill(-Infinity);
  for (const r of rankings) {
    if (r.index >= 0 && r.index < passages.length) {
      scores[r.index] = r.logit;
    }
  }
  return scores;
}

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

/**
 * Pure-function diversity filter — pass in matches already sorted by
 * score desc, returns a deduplicated subset. Two passages are
 * considered duplicates when their embeddings cosine >= threshold.
 *
 * Exposed for tests.
 */
export function dedupByDiversity(
  matches: Array<Match & { embedding?: number[] }>,
  threshold: number = 0.92,
): Match[] {
  const accepted: Array<Match & { embedding?: number[] }> = [];
  for (const m of matches) {
    if (!m.embedding || m.embedding.length === 0) {
      accepted.push(m);
      continue;
    }
    const tooSimilar = accepted.some(
      (a) =>
        a.embedding != null && cosine(a.embedding, m.embedding!) >= threshold,
    );
    if (!tooSimilar) accepted.push(m);
  }
  return accepted.map(({ embedding: _ignored, ...rest }) => rest);
}

/**
 * High-level retrieve — embed the query + corpus, score with the
 * reranker, optionally dedupe by embedding cosine, and return the
 * top-K matches sorted by score desc.
 *
 * Pass an empty corpus → empty result; never throws on empty.
 */
export async function retrieve(
  query: string,
  corpus: Passage[],
  opts: RetrieveOptions = {},
): Promise<Match[]> {
  if (!query.trim() || corpus.length === 0) return [];

  const topK = Math.max(1, opts.topK ?? 5);
  const minScore = opts.minScore ?? -Infinity;
  const diversity = opts.diversity ?? true;

  let scores: number[];
  let embeddings: number[][] | undefined;
  try {
    scores = await callRerank(
      query,
      corpus.map((p) => p.text),
    );
    if (diversity) {
      embeddings = await callEmbed(corpus.map((p) => p.text));
    }
  } catch (err) {
    log.warn("retrieve failed", { error: String(err) });
    return [];
  }

  const scored: Array<Match & { embedding?: number[] }> = corpus.map(
    (p, i) => ({
      ...p,
      score: scores[i] ?? -Infinity,
      embedding: embeddings?.[i],
    }),
  );

  const filtered = scored
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const finalSet = diversity
    ? dedupByDiversity(filtered)
    : filtered.map(({ embedding: _ignored, ...rest }) => rest);

  return finalSet.slice(0, topK);
}
