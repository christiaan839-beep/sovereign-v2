/**
 * SOVEREIGN MATRIX — Receipt search index (Cook 128).
 *
 * Tenant-scoped full-text + faceted search over receipts. Inverted
 * index on tokenized answer + per-field exact-match buckets (agent,
 * status, verdict). Pure module — caller writes / reads / persists.
 *
 * Composes with Cook 38 RAG (shares the tokenizer + stopword list)
 * + Cook 55 receipt-analytics (this is the search counterpart to
 * the timeline aggregator).
 */

import { tokenize } from "@/lib/rag";

// ── Public types ──────────────────────────────────────────────────────────

export interface IndexedReceipt {
  id: string;
  tenantId: string;
  agentSlug: string;
  status: "committed" | "drifted" | "replayed" | "failed";
  verdict?: string;
  /** Full answer body — tokenized into the inverted index. */
  answer: string;
  /** Unix ms. */
  committedAt: number;
}

export interface SearchQuery {
  tenantId: string;
  q?: string;
  /** Optional faceted filters. */
  agentSlug?: string;
  status?: IndexedReceipt["status"];
  verdict?: string;
  /** Time window [start, end). */
  startMs?: number;
  endMs?: number;
  /** Max results. Default 25, hard cap 100. */
  limit?: number;
}

export interface SearchHit {
  receipt: IndexedReceipt;
  score: number;
  /** Tokens from the query that matched the receipt's answer. */
  matchedTokens: string[];
}

// ── Indexing ──────────────────────────────────────────────────────────────

interface TenantIndex {
  receipts: Map<string, IndexedReceipt>;
  /** token → set of receipt ids that contain that token. */
  inverted: Map<string, Set<string>>;
}

const INDEX_BY_TENANT = new Map<string, TenantIndex>();

export function _resetForTests(): void {
  INDEX_BY_TENANT.clear();
}

function getIndex(tenantId: string): TenantIndex {
  let idx = INDEX_BY_TENANT.get(tenantId);
  if (!idx) {
    idx = { receipts: new Map(), inverted: new Map() };
    INDEX_BY_TENANT.set(tenantId, idx);
  }
  return idx;
}

/** Add or update a receipt in the index. Pure aside from store mutation. */
export function indexReceipt(receipt: IndexedReceipt): void {
  if (!receipt.tenantId) throw new Error("indexReceipt: tenantId required");
  const idx = getIndex(receipt.tenantId);
  // Remove the old version (if any) from the inverted index.
  const prior = idx.receipts.get(receipt.id);
  if (prior) {
    const priorTokens = new Set(tokenize(prior.answer));
    for (const tok of priorTokens) {
      const bucket = idx.inverted.get(tok);
      if (bucket) {
        bucket.delete(receipt.id);
        if (bucket.size === 0) idx.inverted.delete(tok);
      }
    }
  }
  idx.receipts.set(receipt.id, receipt);
  const tokens = new Set(tokenize(receipt.answer));
  for (const tok of tokens) {
    let bucket = idx.inverted.get(tok);
    if (!bucket) {
      bucket = new Set();
      idx.inverted.set(tok, bucket);
    }
    bucket.add(receipt.id);
  }
}

/** Remove a receipt from the index. Returns whether anything was removed. */
export function deleteReceipt(tenantId: string, receiptId: string): boolean {
  const idx = INDEX_BY_TENANT.get(tenantId);
  if (!idx) return false;
  const prior = idx.receipts.get(receiptId);
  if (!prior) return false;
  for (const tok of new Set(tokenize(prior.answer))) {
    const bucket = idx.inverted.get(tok);
    if (bucket) {
      bucket.delete(receiptId);
      if (bucket.size === 0) idx.inverted.delete(tok);
    }
  }
  idx.receipts.delete(receiptId);
  return true;
}

// ── Search ────────────────────────────────────────────────────────────────

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

/**
 * Search receipts under tenant scope. Token overlap score with
 * faceted filters AND exact-match boost (search query exactly
 * matching the answer ranks higher than scattered token hits).
 */
export function searchReceipts(query: SearchQuery): SearchHit[] {
  const idx = INDEX_BY_TENANT.get(query.tenantId);
  if (!idx) return [];

  const limit = Math.min(MAX_LIMIT, query.limit ?? DEFAULT_LIMIT);
  const qTokens = query.q ? new Set(tokenize(query.q)) : new Set<string>();

  // Candidate set: receipts that contain at least one query token —
  // OR all receipts when no q supplied (facet-only search).
  let candidates: IndexedReceipt[];
  if (qTokens.size > 0) {
    const candidateIds = new Set<string>();
    for (const tok of qTokens) {
      const bucket = idx.inverted.get(tok);
      if (bucket) for (const id of bucket) candidateIds.add(id);
    }
    candidates = [...candidateIds]
      .map((id) => idx.receipts.get(id))
      .filter((r): r is IndexedReceipt => r !== undefined);
  } else {
    candidates = [...idx.receipts.values()];
  }

  // Apply facets.
  candidates = candidates.filter((r) => {
    if (query.agentSlug && r.agentSlug !== query.agentSlug) return false;
    if (query.status && r.status !== query.status) return false;
    if (query.verdict && r.verdict !== query.verdict) return false;
    if (query.startMs !== undefined && r.committedAt < query.startMs)
      return false;
    if (query.endMs !== undefined && r.committedAt >= query.endMs) return false;
    return true;
  });

  // Score: per-receipt overlap fraction × (1 + exact-substring boost).
  const hits: SearchHit[] = candidates.map((r) => {
    const docTokens = new Set(tokenize(r.answer));
    const matchedTokens: string[] = [];
    if (qTokens.size === 0) {
      return { receipt: r, score: 1, matchedTokens: [] };
    }
    for (const tok of qTokens) {
      if (docTokens.has(tok)) matchedTokens.push(tok);
    }
    const overlap = matchedTokens.length / qTokens.size;
    const exactBoost =
      query.q && r.answer.toLowerCase().includes(query.q.toLowerCase())
        ? 0.25
        : 0;
    return {
      receipt: r,
      score: overlap + exactBoost,
      matchedTokens: matchedTokens.sort(),
    };
  });

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.receipt.committedAt - a.receipt.committedAt;
  });

  // Drop zero-score hits when caller provided a query.
  return hits.filter((h) => qTokens.size === 0 || h.score > 0).slice(0, limit);
}

/** Stats for the search-health dashboard. */
export interface SearchStats {
  tenantId: string;
  documents: number;
  uniqueTokens: number;
  topTokens: Array<{ token: string; documentCount: number }>;
}

export function statsFor(tenantId: string): SearchStats {
  const idx = INDEX_BY_TENANT.get(tenantId);
  if (!idx) {
    return {
      tenantId,
      documents: 0,
      uniqueTokens: 0,
      topTokens: [],
    };
  }
  const topTokens = [...idx.inverted.entries()]
    .map(([token, bucket]) => ({ token, documentCount: bucket.size }))
    .sort((a, b) => b.documentCount - a.documentCount)
    .slice(0, 10);
  return {
    tenantId,
    documents: idx.receipts.size,
    uniqueTokens: idx.inverted.size,
    topTokens,
  };
}
