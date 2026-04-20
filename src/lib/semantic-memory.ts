/**
 * SOVEREIGN MATRIX — Semantic Memory Engine
 *
 * The platform's compounding intelligence moat. Every agent execution
 * is embedded and stored. Future runs retrieve semantically similar
 * past context — not just keyword matches. Over time, agents get
 * dramatically smarter because they remember everything relevant the
 * user has ever done.
 *
 * Architecture:
 *   1. Embed:  input + output → 1024-dim float32 vector via NVIDIA NIM
 *   2. Store:  vector + metadata → tenant_memories (embedding_json column)
 *   3. Recall: query → embed → cosine similarity → top-k relevant memories
 *   4. Inject: formatted context string → agent system prompt
 *
 * Embedding model: nvidia/nv-embedqa-e5-v5 (1024 dims, state-of-the-art for retrieval)
 * Similarity: cosine similarity computed in JS — no pgvector extension required
 * Fallback: keyword BM25-style scoring when NVIDIA key is missing or rate-limited
 *
 * Privacy: memories are user-scoped. Cross-user retrieval is architecturally impossible.
 */

import { createLogger } from "@/lib/logger";
import { db } from "@/db";
import { tenantMemories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

const log = createLogger("semantic-memory");

// ── Types ──────────────────────────────────────────────────────────────────

export type MemoryType = "execution" | "insight" | "preference" | "fact";

export interface SemanticMemoryEntry {
  id: string;
  userId: string;
  agentName: string;
  input: string;
  output: string;
  memoryType: MemoryType;
  importanceScore: number;   // 0.0 – 1.0
  tags: string[];
  sessionId?: string;
  timestamp: number;
  similarity?: number;       // populated during semantic search
}

export interface SaveMemoryOptions {
  memoryType?: MemoryType;
  importanceScore?: number;
  sessionId?: string;
  tags?: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const INPUT_MAX_CHARS  = 300;
const OUTPUT_MAX_CHARS = 600;
const MAX_MEMORIES_PER_USER = 500;

// ── Module-level caches ────────────────────────────────────────────────────
// In-memory store: userId → entries (fast reads, survives restarts via DB hydration)
// Embedding store: memoryId → Float32Array vector (loaded lazily from DB JSON)

const memoryStore    = new Map<string, SemanticMemoryEntry[]>();
const embeddingStore = new Map<string, Float32Array>();

// ── NVIDIA NIM Embedding ───────────────────────────────────────────────────

function getNimKey(): string {
  return process.env.NVIDIA_NIM_API_KEY ?? process.env.NVIDIA_API_KEY ?? "";
}

/**
 * Embed text to a 1024-dim float32 vector using NVIDIA NIM.
 * Returns null on any failure → triggers keyword fallback automatically.
 */
async function embedText(
  text: string,
  inputType: "query" | "passage" = "passage"
): Promise<Float32Array | null> {
  const key = getNimKey();
  if (!key) return null;

  try {
    const res = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [text.slice(0, 8192)],
        model: EMBEDDING_MODEL,
        input_type: inputType,
        truncate: "END",
        encoding_format: "float",
      }),
    });

    if (!res.ok) {
      log.info("NIM embeddings error", { status: res.status });
      return null;
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    const raw = data.data?.[0]?.embedding;
    if (!raw?.length) return null;

    return new Float32Array(raw);
  } catch (err) {
    log.info("Embedding request failed, using keyword fallback", { error: String(err) });
    return null;
  }
}

// ── Similarity ─────────────────────────────────────────────────────────────

/** Cosine similarity: 1.0 = identical direction, 0.0 = orthogonal, -1.0 = opposite. */
function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-9 ? 0 : dot / denom;
}

/**
 * Keyword relevance score (0–1) as fallback when embeddings are unavailable.
 * Simple token overlap — not BM25, but effective for short memories.
 */
function keywordScore(query: string, mem: SemanticMemoryEntry): number {
  const stop = new Set(["the", "a", "an", "is", "are", "to", "of", "and", "in", "for", "on", "with"]);
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  if (!keywords.length) return 0;
  const haystack = `${mem.agentName} ${mem.input} ${mem.output} ${mem.tags.join(" ")}`.toLowerCase();
  const hits = keywords.filter(kw => haystack.includes(kw)).length;
  return hits / keywords.length;
}

// ── DB Helpers ─────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 3)}...`;
}

async function hydrateFromDb(userId: string): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(tenantMemories)
      .where(eq(tenantMemories.userId, userId))
      .orderBy(desc(tenantMemories.createdAt));

    const entries: SemanticMemoryEntry[] = rows.map(row => {
      const ext = row as typeof row & {
        embedding_json?: string | null;
        importance_score?: number | null;
        memory_type?: string | null;
        session_id?: string | null;
      };

      // Restore embedding from JSON column
      if (ext.embedding_json) {
        try {
          embeddingStore.set(row.id, new Float32Array(JSON.parse(ext.embedding_json) as number[]));
        } catch { /* malformed — skip */ }
      }

      return {
        id: row.id,
        userId: row.userId,
        agentName: row.agentName,
        input:  row.inputSummary  ?? "",
        output: row.outputSummary ?? "",
        memoryType:     (ext.memory_type ?? "execution") as MemoryType,
        importanceScore: ext.importance_score ?? 0.5,
        tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
        sessionId: ext.session_id ?? undefined,
        timestamp: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      };
    });

    memoryStore.set(userId, entries);
    log.info(`Hydrated ${entries.length} memories for ${userId}`);
  } catch (err) {
    log.info("DB hydration failed", { error: String(err) });
    memoryStore.set(userId, []);
  }
}

async function writeToDB(
  mem: SemanticMemoryEntry,
  vec: Float32Array | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const insertData: Record<string, unknown> = {
      id: mem.id,
      userId: mem.userId,
      agentName: mem.agentName,
      inputSummary: mem.input,
      outputSummary: mem.output,
      tags: mem.tags.join(","),
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    // Only include new columns if migration 0017 has been applied
    if (vec) insertData.embedding_json = JSON.stringify(Array.from(vec));
    insertData.importance_score = mem.importanceScore;
    insertData.memory_type      = mem.memoryType;
    insertData.source_agent     = mem.agentName;
    if (mem.sessionId) insertData.session_id = mem.sessionId;

    await (db.insert(tenantMemories) as { values: (v: Record<string, unknown>) => Promise<void> }).values(insertData);
  } catch (err) {
    // Likely the new columns don't exist yet (migration not run). Write without them.
    try {
      await db.insert(tenantMemories).values({
        id: mem.id,
        userId: mem.userId,
        agentName: mem.agentName,
        inputSummary: mem.input,
        outputSummary: mem.output,
        tags: mem.tags.join(","),
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } catch (fallbackErr) {
      log.info("DB write failed (cache still live)", { error: String(fallbackErr) });
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Store an agent execution in semantic memory.
 * Writes to cache immediately; embeds + persists to DB asynchronously.
 */
export async function rememberExecution(
  userId: string,
  agentName: string,
  input: string,
  output: string,
  options: SaveMemoryOptions = {},
  metadata?: Record<string, unknown>
): Promise<SemanticMemoryEntry> {
  const mem: SemanticMemoryEntry = {
    id: `sm_${crypto.randomUUID()}`,
    userId,
    agentName,
    input:  truncate(input, INPUT_MAX_CHARS),
    output: truncate(output, OUTPUT_MAX_CHARS),
    memoryType:      options.memoryType      ?? "execution",
    importanceScore: options.importanceScore ?? 0.5,
    tags: [...new Set([agentName, ...(options.tags ?? [])])],
    sessionId: options.sessionId,
    timestamp: Date.now(),
  };

  // Write to cache immediately
  const entries = memoryStore.get(userId) ?? [];
  entries.push(mem);
  if (entries.length > MAX_MEMORIES_PER_USER) entries.splice(0, entries.length - MAX_MEMORIES_PER_USER);
  memoryStore.set(userId, entries);

  // Embed + persist asynchronously (non-blocking)
  (async () => {
    const text = `Task: ${mem.input}\nResult: ${mem.output}`;
    const vec = await embedText(text, "passage");
    if (vec) embeddingStore.set(mem.id, vec);
    await writeToDB(mem, vec ?? null, metadata);
  })().catch(() => {});

  return mem;
}

/**
 * Semantic search over user's past executions.
 * Returns up to `limit` memories sorted by semantic relevance → importance → recency.
 */
export async function recallRelevant(
  userId: string,
  query: string,
  limit = 8,
  minScore = 0.20
): Promise<SemanticMemoryEntry[]> {
  // Hydrate cache on first access
  if (!memoryStore.has(userId)) {
    await hydrateFromDb(userId);
  }

  const entries = memoryStore.get(userId) ?? [];
  if (!entries.length) return [];

  // Embed the query (or fall back to keyword scoring)
  const queryVec = await embedText(query, "query");

  const scored = entries.map(mem => {
    const vec = embeddingStore.get(mem.id);
    const score = queryVec && vec
      ? cosineSim(queryVec, vec)
      : keywordScore(query, mem);
    return { ...mem, similarity: score };
  });

  return scored
    .filter(m => (m.similarity ?? 0) >= minScore)
    .sort((a, b) => {
      const simDiff = (b.similarity ?? 0) - (a.similarity ?? 0);
      if (Math.abs(simDiff) > 0.04) return simDiff;
      const impDiff = b.importanceScore - a.importanceScore;
      if (Math.abs(impDiff) > 0.1) return impDiff;
      return b.timestamp - a.timestamp;
    })
    .slice(0, limit);
}

/**
 * Build a context string for injection into an agent's system prompt.
 * Automatically searches for memories most relevant to the current task.
 */
export async function buildMemoryContext(
  userId: string,
  agentName: string,
  taskDescription: string
): Promise<string> {
  const query = `${agentName}: ${taskDescription}`.slice(0, 500);
  const memories = await recallRelevant(userId, query, 6, 0.18);
  if (!memories.length) return "";

  const lines = memories.map(m => {
    const ageMs = Date.now() - m.timestamp;
    const age =
      ageMs < 3_600_000  ? `${Math.round(ageMs / 60_000)}m ago`
      : ageMs < 86_400_000 ? `${Math.round(ageMs / 3_600_000)}h ago`
      : `${Math.round(ageMs / 86_400_000)}d ago`;
    const conf = m.similarity !== undefined ? ` [${Math.round(m.similarity * 100)}% relevant]` : "";
    return `[${age}${conf}] ${m.agentName}: "${m.input}" → ${m.output.slice(0, 200)}`;
  });

  return [
    "",
    "--- Relevant context from this user's past work ---",
    ...lines,
    "---",
    "",
  ].join("\n");
}

/**
 * Expose platform-level memory statistics for the dashboard.
 */
export async function getSemanticMemoryStats(userId: string): Promise<{
  totalMemories: number;
  semanticMemories: number;
  topAgents: Array<{ agent: string; count: number }>;
  semanticSearchEnabled: boolean;
}> {
  if (!memoryStore.has(userId)) await hydrateFromDb(userId);
  const entries = memoryStore.get(userId) ?? [];

  const agentCounts: Record<string, number> = {};
  for (const m of entries) agentCounts[m.agentName] = (agentCounts[m.agentName] ?? 0) + 1;

  return {
    totalMemories: entries.length,
    semanticMemories: entries.filter(m => embeddingStore.has(m.id)).length,
    topAgents: Object.entries(agentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([agent, count]) => ({ agent, count })),
    semanticSearchEnabled: !!getNimKey(),
  };
}
