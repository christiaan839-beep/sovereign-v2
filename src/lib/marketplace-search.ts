/**
 * Semantic search over the marketplace catalog.
 *
 * Two-stage retrieval:
 *   1. Embed the query via NIM, cosine-similarity rank all verified
 *      agents that have embeddings stored (fast, in-memory).
 *   2. Rerank the top-20 candidates via Nemotron reranker for
 *      precision@5.
 *
 * Graceful degradation ladder:
 *   NIM up + embeddings stored  → full semantic search (ideal)
 *   NIM up + no embeddings      → empty result (backfill needed)
 *   NIM down                    → keyword fallback (ILIKE on name/desc)
 *   DB down                     → empty result
 *
 * Keyword fallback keeps the endpoint "always returns something"
 * — important for UX because a blank search result page when the
 * user typed a real query feels broken.
 */

import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import {
  cosineSimilarity,
  embedOne,
  rerank,
  NIM_EMBEDDING_DIMS,
  NIM_EMBEDDING_MODEL,
} from "@/lib/nim-embed";

const log = createLogger("marketplace-search");

/* ─── Types ───────────────────────────────────────────────────── */

export interface SearchHit {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  category: string;
  pricingCents: number;
  /**
   * 0–1 for cosine similarity hits, raw reranker logit for post-rerank
   * hits. Not comparable across modes — treat as opaque ranking.
   */
  score: number;
  /** "semantic" | "rerank" | "keyword" | "empty" */
  mode: string;
}

/* ─── Config ──────────────────────────────────────────────────── */

const DEFAULT_TOP_K = 10;
const CANDIDATE_POOL = 20; // how many semantic hits to rerank
const KEYWORD_LIMIT = 25;

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/* ─── Embedding-corpus representation of an agent ─────────────── */

/**
 * The string we embed + rerank against. Keeping this as its own
 * function means the write-path (storing embeddings on approval) and
 * read-path (reranking at search) always use the same canonical form.
 * If they drift, rerank scores lose meaning.
 */
export function agentCorpusText(row: {
  name: string;
  description: string;
  category: string;
  manifestRaw: Record<string, unknown> | null;
}): string {
  const parts = [row.name, row.description, `Category: ${row.category}`];
  const m = row.manifestRaw;
  if (m && typeof m === "object") {
    if (typeof m.purpose === "string") parts.push(`Purpose: ${m.purpose}`);
    if (Array.isArray(m.guarantees)) {
      const gs = (m.guarantees as unknown[]).filter(
        (g): g is string => typeof g === "string",
      );
      if (gs.length > 0) parts.push(`Guarantees: ${gs.join("; ")}`);
    }
    if (typeof m.category === "string" && m.category !== row.category) {
      // SAM category differs from marketplace category — include both
      parts.push(`SAM category: ${m.category}`);
    }
  }
  return parts.join("\n");
}

/* ─── Public API ──────────────────────────────────────────────── */

export async function searchMarketplace(
  rawQuery: string,
  opts: { limit?: number; skipRerank?: boolean } = {},
): Promise<{ hits: SearchHit[]; mode: string }> {
  const query = rawQuery?.trim() ?? "";
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_TOP_K, 1), 50);

  if (!query) return { hits: [], mode: "empty" };
  if (!databaseIsConfigured()) return { hits: [], mode: "empty" };

  // 1. Try semantic.
  const queryVec = await embedOne(query);
  if (queryVec && queryVec.length === NIM_EMBEDDING_DIMS) {
    const semantic = await semanticSearch(queryVec, CANDIDATE_POOL);
    if (semantic.length > 0) {
      if (opts.skipRerank || semantic.length === 1) {
        return {
          hits: semantic.slice(0, limit).map((h) => ({ ...h, mode: "semantic" })),
          mode: "semantic",
        };
      }
      const reranked = await rerank(
        query,
        semantic,
        (h) => `${h.name}\n${h.description}`,
        limit,
      );
      return {
        hits: reranked.map((r) => ({
          ...r.item,
          score: r.score,
          mode: "rerank",
        })),
        mode: "rerank",
      };
    }
  }

  // 2. Fall back to keyword ILIKE. Always returns SOMETHING rather
  //    than an empty state — a blank results page feels broken to users.
  const kw = await keywordSearch(query, limit);
  if (kw.length > 0) return { hits: kw, mode: "keyword" };

  return { hits: [], mode: "empty" };
}

/* ─── Semantic branch ─────────────────────────────────────────── */

async function semanticSearch(
  queryVec: number[],
  k: number,
): Promise<SearchHit[]> {
  try {
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        description: marketplaceAgents.description,
        category: marketplaceAgents.category,
        pricingCents: marketplaceAgents.pricePerRun,
        embedding: marketplaceAgents.embedding,
      })
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
          sql`${marketplaceAgents.embedding} IS NOT NULL`,
        ),
      );

    const scored: SearchHit[] = [];
    for (const r of rows) {
      const emb = r.embedding as unknown;
      if (!Array.isArray(emb)) continue;
      if (emb.length !== NIM_EMBEDDING_DIMS) continue;
      // Narrowly-typed cast: we just verified it's a number array above.
      const vec = emb as number[];
      const score = cosineSimilarity(queryVec, vec);
      scored.push({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        category: r.category,
        pricingCents: r.pricingCents,
        score,
        mode: "semantic",
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  } catch (err) {
    log.warn("semanticSearch failed; will fall back to keyword", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/* ─── Keyword fallback ────────────────────────────────────────── */

async function keywordSearch(q: string, k: number): Promise<SearchHit[]> {
  try {
    const needle = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        description: marketplaceAgents.description,
        category: marketplaceAgents.category,
        pricingCents: marketplaceAgents.pricePerRun,
      })
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
          or(
            ilike(marketplaceAgents.name, needle),
            ilike(marketplaceAgents.description, needle),
            ilike(marketplaceAgents.category, needle),
          ),
        ),
      )
      .limit(Math.min(k, KEYWORD_LIMIT));

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      category: r.category,
      pricingCents: r.pricingCents,
      score: 0,
      mode: "keyword",
    }));
  } catch (err) {
    log.warn("keywordSearch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/* ─── Backfill: embed + store for a single agent ──────────────── */

/**
 * Compute + store the embedding for an agent. Called from the
 * approval path (admin approve + auto-publish) and from backfill
 * scripts. Idempotent: overwrites existing embeddings so model
 * upgrades can be rolled out by re-running the backfill.
 *
 * Returns true on write, false on every failure mode (no key, no DB,
 * embed error, SQL error). Never throws.
 */
export async function embedAndStoreAgent(args: {
  id: string;
  corpusText: string;
}): Promise<boolean> {
  if (!databaseIsConfigured() || !args.id) return false;
  const vec = await embedOne(args.corpusText);
  if (!vec) return false;

  try {
    await db
      .update(marketplaceAgents)
      .set({
        embedding: vec,
        embeddingModel: NIM_EMBEDDING_MODEL,
        embeddingUpdatedAt: new Date(),
      })
      .where(eq(marketplaceAgents.id, args.id));
    return true;
  } catch (err) {
    log.error("embedAndStoreAgent update failed", {
      id: args.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
