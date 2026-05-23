/**
 * SOVEREIGN MATRIX — Vector Memory (Neon pgvector)
 *
 * Replaces Pinecone with pgvector in your existing Neon database.
 * Zero new services. Zero new API keys. Zero extra cost.
 *
 * How it works:
 *   1. EMBED: Convert text to 1536-dim vector via NVIDIA NV-EmbedQA
 *   2. STORE: Save vector + metadata to Neon pgvector
 *   3. SEARCH: Find similar past interactions via cosine similarity
 *   4. INJECT: Add relevant context into agent prompts
 *
 * Usage:
 *   import { storeMemory, searchMemory } from "@/lib/vector-memory";
 *
 *   // Store after agent execution
 *   await storeMemory(userId, "leads", "Found 7 fintech companies in London", result);
 *
 *   // Search before next execution
 *   const memories = await searchMemory(userId, "fintech companies London");
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getNimKey } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";

const log = createLogger("vector-memory");

const NIM_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings";
const EMBED_MODEL = "nvidia/llama-3.2-nv-embedqa-1b-v2";

// ─── Wave 114 H2: Per-user storeMemory write cap ──────────────────────────
//
// Without a cap, a user running a memory-storing agent in a loop fills Neon
// storage (cost) AND degrades IVFFlat recall as N grows (per-user query plan
// touches more pages). Two reviews (wave-110 + wave-111) flagged this.
//
// Policy: 10K rows per user. After each successful insert, evict the oldest
// rows so the table holds at most MAX rows for that user. LRU semantics by
// `created_at` since we don't track per-row access time and the wave-111
// retention story is "compounding context", which favors recent over ancient.
//
// Override via MEMORY_PER_USER_CAP env var for tests / per-deployment tuning.
const DEFAULT_MAX_MEMORIES_PER_USER = 10_000;

function maxMemoriesPerUser(): number {
  const raw = process.env.MEMORY_PER_USER_CAP;
  if (!raw) return DEFAULT_MAX_MEMORIES_PER_USER;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_MEMORIES_PER_USER;
}

/**
 * LRU eviction after insert. Keeps the user's row count at-or-below the cap
 * by deleting the oldest rows (by created_at) beyond the limit.
 *
 * Best-effort: any failure is logged and swallowed. The user's write already
 * succeeded — eviction failure means we'll re-attempt on the next write.
 *
 * Atomicity: we evict in a single `DELETE ... WHERE id IN (...)` so the row
 * count converges. Concurrent inserts may briefly push past the cap; that's
 * fine because the next eviction call clamps back.
 */
async function evictOldestBeyondCap(userId: string): Promise<void> {
  const cap = maxMemoriesPerUser();
  try {
    await db.execute(sql`
      DELETE FROM agent_memories
      WHERE id IN (
        SELECT id FROM agent_memories
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        OFFSET ${cap}
      )
    `);
  } catch (err) {
    log.warn("memory eviction failed", {
      userId,
      cap,
      error: String(err),
    });
  }
}

// ─── Initialize pgvector extension + table ──────────────────────────────────

let _initialized = false;

async function ensureVectorTable(): Promise<boolean> {
  if (_initialized) return true;

  try {
    // Enable pgvector extension (idempotent)
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create memories table with vector column
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Create index for fast similarity search
    await db
      .execute(
        sql`
      CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx
      ON agent_memories USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `,
      )
      .catch(() => {
        // IVFFlat index needs some rows first — skip on empty table
      });

    // Create index for user lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS agent_memories_user_idx
      ON agent_memories (user_id, agent_name)
    `);

    _initialized = true;
    return true;
  } catch (err) {
    log.error("Failed to initialize vector table", { error: String(err) });
    return false;
  }
}

// ─── Embed text using NVIDIA NV-EmbedQA (FREE) ─────────────────────────────

async function embedText(text: string): Promise<number[] | null> {
  const nimKey = await getNimKey();
  if (!nimKey) return null;

  try {
    const res = await fetch(NIM_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: [text.slice(0, 2000)], // Limit input length
        input_type: "query",
        encoding_format: "float",
        truncate: "END",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Store a memory after agent execution.
 * The text is embedded and stored with the user's ID for future retrieval.
 */
export async function storeMemory(
  userId: string,
  agentName: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const ready = await ensureVectorTable();
  if (!ready) return false;

  const embedding = await embedText(content);
  if (!embedding) {
    // Store without embedding — still useful as text memory
    try {
      await db.execute(sql`
        INSERT INTO agent_memories (user_id, agent_name, content, metadata)
        VALUES (${userId}, ${agentName}, ${content.slice(0, 5000)}, ${JSON.stringify(metadata)})
      `);
      // Wave 114 H2: clamp per-user row count after every successful write.
      await evictOldestBeyondCap(userId);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const vectorStr = `[${embedding.join(",")}]`;
    await db.execute(sql`
      INSERT INTO agent_memories (user_id, agent_name, content, metadata, embedding)
      VALUES (${userId}, ${agentName}, ${content.slice(0, 5000)}, ${JSON.stringify(metadata)}, ${vectorStr}::vector)
    `);
    // Wave 114 H2: same eviction after embedded inserts.
    await evictOldestBeyondCap(userId);
    return true;
  } catch (err) {
    log.error("Failed to store memory", { error: String(err) });
    return false;
  }
}

/**
 * Search for similar past interactions.
 * Returns the top N most relevant memories for this user.
 */
export async function searchMemory(
  userId: string,
  query: string,
  limit: number = 3,
): Promise<
  Array<{
    content: string;
    agentName: string;
    similarity: number;
    createdAt: string;
  }>
> {
  const ready = await ensureVectorTable();
  if (!ready) return [];

  const embedding = await embedText(query);
  if (!embedding) return [];

  try {
    const vectorStr = `[${embedding.join(",")}]`;
    const results = await db.execute(sql`
      SELECT
        content,
        agent_name as "agentName",
        1 - (embedding <=> ${vectorStr}::vector) as similarity,
        created_at as "createdAt"
      FROM agent_memories
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    return (results.rows || []).map((row: Record<string, unknown>) => ({
      content: String(row.content || ""),
      agentName: String(row.agentName || ""),
      similarity: Number(row.similarity || 0),
      createdAt: String(row.createdAt || ""),
    }));
  } catch (err) {
    log.error("Memory search failed", { error: String(err) });
    return [];
  }
}

/**
 * Get memory context formatted for prompt injection.
 * Returns a string that can be appended to agent system prompts.
 */
export async function getMemoryContextForPrompt(
  userId: string,
  query: string,
): Promise<string> {
  const memories = await searchMemory(userId, query);

  if (memories.length === 0) return "";

  const relevant = memories.filter((m) => m.similarity > 0.7);
  if (relevant.length === 0) return "";

  return `\n\nRelevant context from past interactions:\n${relevant
    .map((m) => `- [${m.agentName}] ${m.content.slice(0, 300)}`)
    .join("\n")}`;
}
