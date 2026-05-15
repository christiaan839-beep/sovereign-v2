/**
 * SOVEREIGN MATRIX — Per-tenant RAG layer (Cook 38 / Tier 1 #3)
 *
 * Retrieval-augmented generation built on top of the existing
 * `tenantMemories` table. The contract:
 *
 *   - Memories live per tenant; nothing crosses tenants. EVER.
 *   - Retrieval is hybrid: lexical (token-overlap) + semantic
 *     (cosine over embeddings). Callers supply embeddings — this
 *     module never makes AI calls of its own.
 *   - Every retrieved memory carries a citation id the model can
 *     reference inline (`[m-3]`). The renderer extracts those ids
 *     from the model's output so the receipt can prove which
 *     memories supported which claims.
 *   - Pure helpers — no I/O. Wire the memory loader from the caller
 *     (so production reads tenantMemories from Drizzle and tests
 *     inject an in-memory list).
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  tenantId: string;
  /** Free-form category tag (e.g. "preferences", "deal", "policy"). */
  category?: string;
  /** Short, retrieval-friendly heading. */
  title?: string;
  /** Full memory body. */
  body: string;
  /** Optional embedding for semantic retrieval. */
  embedding?: number[];
  /** Unix ms the memory was created. Newer wins on ties. */
  createdAt: number;
}

export interface RetrievalRequest {
  /** Question or task the agent is trying to answer. */
  query: string;
  /** Optional pre-computed embedding for the query. */
  queryEmbedding?: number[];
  /** Tenant scope — enforced HARD. */
  tenantId: string;
  /** Optional category filter. */
  category?: string;
  /** Max results to return. Default 5. */
  topK?: number;
  /**
   * Blend weight for lexical vs semantic scores. 0 = pure lexical,
   * 1 = pure semantic. Default 0.6 (semantic-leaning when embeddings
   * are present).
   */
  semanticWeight?: number;
}

export interface RetrievedMemory {
  memory: Memory;
  /** Final blended score in [0, 1]. */
  score: number;
  /** Lexical token-overlap score in [0, 1]. */
  lexicalScore: number;
  /** Semantic cosine score in [0, 1]; -1 when no embedding available. */
  semanticScore: number;
  /** Stable citation id the model emits inline (e.g. `m-1`, `m-2`). */
  citationId: string;
}

// ── Cosine similarity ─────────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  // Clamp to [-1, 1] to absorb FP drift, then normalize to [0, 1].
  const c = Math.max(-1, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
  return (c + 1) / 2;
}

// ── Lexical (token-overlap) similarity ────────────────────────────────────

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "to",
  "of",
  "in",
  "on",
  "at",
  "and",
  "or",
  "but",
  "for",
  "with",
  "as",
  "by",
  "this",
  "that",
  "these",
  "those",
  "it",
  "i",
  "you",
  "we",
  "they",
  "what",
  "which",
  "who",
  "how",
  "why",
  "when",
  "where",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function lexicalScore(query: string, body: string): number {
  const q = new Set(tokenize(query));
  const d = new Set(tokenize(body));
  if (q.size === 0 || d.size === 0) return 0;
  let hits = 0;
  for (const t of q) if (d.has(t)) hits++;
  return hits / q.size;
}

// ── Retrieval ─────────────────────────────────────────────────────────────

/**
 * Score a single memory against the request. Pure, deterministic.
 */
function scoreMemory(
  m: Memory,
  req: RetrievalRequest,
): { score: number; lexical: number; semantic: number } {
  const lexical = lexicalScore(req.query, `${m.title ?? ""} ${m.body}`);
  let semantic = -1;
  if (req.queryEmbedding && m.embedding) {
    semantic = cosine(req.queryEmbedding, m.embedding);
  }
  const w =
    req.semanticWeight !== undefined
      ? Math.max(0, Math.min(1, req.semanticWeight))
      : 0.6;
  const score = semantic < 0 ? lexical : w * semantic + (1 - w) * lexical;
  return { score, lexical, semantic };
}

/**
 * Retrieve the top-K memories for a request. Enforces tenant scope,
 * optional category filter, deterministic ordering on ties (newer
 * memories win), and assigns stable citation ids.
 */
export function retrieve(
  memories: Memory[],
  req: RetrievalRequest,
): RetrievedMemory[] {
  if (!req.tenantId) {
    throw new Error("retrieve() called without tenantId — cross-tenant guard");
  }
  const topK = req.topK ?? 5;
  const filtered = memories.filter(
    (m) =>
      m.tenantId === req.tenantId &&
      (req.category === undefined || m.category === req.category),
  );

  const scored = filtered
    .map((m) => {
      const s = scoreMemory(m, req);
      return {
        memory: m,
        score: s.score,
        lexicalScore: s.lexical,
        semanticScore: s.semantic,
      };
    })
    // Drop zero-score noise — they add nothing the model can cite.
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.memory.createdAt - a.memory.createdAt;
    })
    .slice(0, topK);

  return scored.map((r, i) => ({ ...r, citationId: `m-${i + 1}` }));
}

// ── Prompt rendering ──────────────────────────────────────────────────────

/**
 * Render a retrieval block for the model's system prompt. The block
 * is stable (token order matches citation ids), so a model that
 * emits `[m-2]` is referring to the same memory across calls.
 */
export function renderContextBlock(items: RetrievedMemory[]): string {
  if (items.length === 0) {
    return "─── MEMORY ───\n(no relevant memories — answer from first principles)";
  }
  const lines = [
    "─── MEMORY ───",
    "The following memories are relevant. Cite the ones you use inline using their id in square brackets, e.g. [m-1].",
  ];
  for (const item of items) {
    const cat = item.memory.category ? ` (${item.memory.category})` : "";
    const heading = item.memory.title ? `${item.memory.title}` : "Memory";
    lines.push(`[${item.citationId}] ${heading}${cat}: ${item.memory.body}`);
  }
  return lines.join("\n");
}

// ── Citation extraction (for receipts) ────────────────────────────────────

const CITATION_RE = /\[(m-\d+)\]/g;

/**
 * Pull every `[m-N]` citation out of a model's answer. Returns the
 * RetrievedMemory for each citation in order of first appearance.
 * Unknown citation ids are dropped (the model hallucinated them).
 */
export function extractCitations(
  answer: string,
  retrieved: RetrievedMemory[],
): RetrievedMemory[] {
  const byId = new Map(retrieved.map((r) => [r.citationId, r]));
  const seen = new Set<string>();
  const out: RetrievedMemory[] = [];
  for (const match of answer.matchAll(CITATION_RE)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const r = byId.get(id);
    if (r) out.push(r);
  }
  return out;
}
