/**
 * SOVEREIGN MATRIX — RAG cross-encoder rerank (Cook 99).
 *
 * Adds a third retrieval signal on top of Cook 38's lexical +
 * semantic blend: a CROSS-ENCODER score that re-ranks the top-K
 * results by joint query-document attention. Cross-encoders are
 * expensive (one model call per candidate) but precision-decisive
 * — they typically push nDCG@5 up by 8-12 points over bi-encoder
 * cosine alone.
 *
 * Pure module — caller injects the scorer function so production
 * wires Cohere Rerank / Voyage rerank-2 / NIM nv-rerank, and tests
 * inject a deterministic mock.
 */

import type { RetrievedMemory } from "@/lib/rag";

// ── Public types ──────────────────────────────────────────────────────────

export interface RerankItem {
  memory: RetrievedMemory;
  /** New blended score after rerank in [0,1]. */
  finalScore: number;
  /** Raw cross-encoder score in [0,1]. */
  rerankScore: number;
  /** Original blended score from Cook 38 RAG. */
  originalScore: number;
}

export interface RerankRequest {
  query: string;
  candidates: RetrievedMemory[];
  /** Cross-encoder scorer — returns one score per candidate in [0,1]. */
  scorer: (query: string, candidates: RetrievedMemory[]) => Promise<number[]>;
  /** Weight on the rerank score in the final blend. Default 0.7. */
  rerankWeight?: number;
  /** Top-K to return. Default = candidates.length. */
  topK?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Rerank an already-retrieved set. Never reorders into items that
 * weren't in the original retrieval, so tenant + category guards from
 * Cook 38 RAG remain authoritative.
 *
 * Final score = w × rerank + (1−w) × original, then clamped.
 */
export async function rerank(req: RerankRequest): Promise<RerankItem[]> {
  if (req.candidates.length === 0) return [];
  const w =
    req.rerankWeight === undefined
      ? 0.7
      : Math.max(0, Math.min(1, req.rerankWeight));
  const rerankScores = await req.scorer(req.query, req.candidates);
  if (rerankScores.length !== req.candidates.length) {
    throw new Error(
      `rerank: scorer returned ${rerankScores.length} scores for ${req.candidates.length} candidates`,
    );
  }
  const items: RerankItem[] = req.candidates.map((memory, i) => {
    const rerankScore = clamp(rerankScores[i]);
    const finalScore = clamp(w * rerankScore + (1 - w) * memory.score);
    return {
      memory,
      finalScore,
      rerankScore,
      originalScore: memory.score,
    };
  });
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    // Deterministic tie-break by stable memory id.
    return a.memory.memory.id.localeCompare(b.memory.memory.id);
  });
  const topK = req.topK ?? items.length;
  return items.slice(0, topK);
}
