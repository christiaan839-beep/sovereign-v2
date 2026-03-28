/**
 * SOVEREIGN MATRIX — Persistent Tenant Memory System
 *
 * Per-user memory that stores agent execution history and makes it
 * available to future agent calls. This is the data moat — agents
 * that get smarter with every use because they remember past interactions.
 *
 * Architecture:
 *   - In-memory Map keyed by userId
 *   - Each user gets up to MAX_ENTRIES_PER_USER entries (oldest evicted)
 *   - Simple keyword search (vector search ready via Pinecone later)
 *   - Formatted context injection for agent system prompts
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("tenant-memory");

// ── Types ──

export interface MemoryEntry {
  id: string;
  userId: string;
  agentName: string;
  input: string;   // truncated to 200 chars
  output: string;  // truncated to 500 chars
  timestamp: number;
  tags: string[];
}

export interface MemoryStats {
  totalMemories: number;
  topAgents: Array<{ agent: string; count: number }>;
  oldestMemory: number | null;
  newestMemory: number | null;
}

// ── Constants ──

const MAX_ENTRIES_PER_USER = 200;
const INPUT_MAX_LENGTH = 200;
const OUTPUT_MAX_LENGTH = 500;

// ── In-Memory Store ──

const store = new Map<string, MemoryEntry[]>();

// ── Helpers ──

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function extractTags(agentName: string, input: string): string[] {
  const tags: string[] = [agentName];
  // Pull simple keyword tags from the input
  const words = input.toLowerCase().split(/\s+/);
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "and", "in", "for", "on", "with", "at", "by", "from", "this", "that", "it", "as", "or", "not", "but", "if", "my", "your", "i", "you", "we", "they", "he", "she"]);
  for (const w of words) {
    if (w.length > 3 && !stopWords.has(w) && tags.length < 10) {
      tags.push(w);
    }
  }
  return [...new Set(tags)];
}

// ── Public API ──

/**
 * Store an agent execution in the user's persistent memory.
 */
export function saveMemory(
  userId: string,
  agentName: string,
  input: string,
  output: string,
  metadata?: Record<string, unknown>
): MemoryEntry {
  const entry: MemoryEntry = {
    id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    agentName,
    input: truncate(input, INPUT_MAX_LENGTH),
    output: truncate(output, OUTPUT_MAX_LENGTH),
    timestamp: Date.now(),
    tags: extractTags(agentName, input),
  };

  // Add metadata-derived tags if present
  if (metadata) {
    for (const val of Object.values(metadata)) {
      if (typeof val === "string" && val.length > 2 && val.length < 50) {
        entry.tags.push(val.toLowerCase());
      }
    }
    entry.tags = [...new Set(entry.tags)].slice(0, 15);
  }

  const entries = store.get(userId) || [];
  entries.push(entry);

  // Evict oldest if over limit
  if (entries.length > MAX_ENTRIES_PER_USER) {
    entries.splice(0, entries.length - MAX_ENTRIES_PER_USER);
  }

  store.set(userId, entries);
  log.info(`Memory saved for ${userId}`, { agent: agentName, total: entries.length });

  return entry;
}

/**
 * Search past executions relevant to a query using keyword matching.
 */
export function queryMemory(
  userId: string,
  query: string,
  limit: number = 10
): MemoryEntry[] {
  const entries = store.get(userId);
  if (!entries || entries.length === 0) return [];

  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Score each entry by keyword overlap
  const scored = entries.map(entry => {
    const searchable = `${entry.agentName} ${entry.input} ${entry.output} ${entry.tags.join(" ")}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (searchable.includes(kw)) score++;
    }
    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
    .slice(0, limit)
    .map(s => s.entry);
}

/**
 * Get a formatted context string of recent relevant memories for
 * injection into an agent's system prompt.
 */
export function getMemoryContext(userId: string, agentName: string): string {
  const entries = store.get(userId);
  if (!entries || entries.length === 0) return "";

  // Prioritize memories from the same agent, then recent from others
  const sameAgent = entries
    .filter(e => e.agentName === agentName)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const otherAgents = entries
    .filter(e => e.agentName !== agentName)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  const relevant = [...sameAgent, ...otherAgents];
  if (relevant.length === 0) return "";

  const lines = relevant.map(e => {
    const age = Math.round((Date.now() - e.timestamp) / 60000);
    const ageStr = age < 60 ? `${age}m ago` : age < 1440 ? `${Math.round(age / 60)}h ago` : `${Math.round(age / 1440)}d ago`;
    return `[${ageStr}] ${e.agentName}: "${e.input}" => ${e.output.slice(0, 150)}`;
  });

  return `\n--- Previous context from your past work for this user ---\n${lines.join("\n")}\n---`;
}

/**
 * Get memory statistics for a user.
 */
export function getMemoryStats(userId: string): MemoryStats {
  const entries = store.get(userId);
  if (!entries || entries.length === 0) {
    return { totalMemories: 0, topAgents: [], oldestMemory: null, newestMemory: null };
  }

  const agentCounts: Record<string, number> = {};
  let oldest = Infinity;
  let newest = 0;

  for (const e of entries) {
    agentCounts[e.agentName] = (agentCounts[e.agentName] || 0) + 1;
    if (e.timestamp < oldest) oldest = e.timestamp;
    if (e.timestamp > newest) newest = e.timestamp;
  }

  const topAgents = Object.entries(agentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([agent, count]) => ({ agent, count }));

  return {
    totalMemories: entries.length,
    topAgents,
    oldestMemory: oldest === Infinity ? null : oldest,
    newestMemory: newest === 0 ? null : newest,
  };
}

/**
 * Clear all memories for a user.
 */
export function clearMemory(userId: string): number {
  const entries = store.get(userId);
  const count = entries?.length || 0;
  store.delete(userId);
  log.info(`Memory cleared for ${userId}`, { deleted: count });
  return count;
}
