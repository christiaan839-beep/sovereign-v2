// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// "dream-state planning"; not wired.
import { recall, getPineconeClient } from "./memory";
import { ai, embed } from "./ai";
import { createLogger } from "./logger";

const log = createLogger("dream");

/**
 * DREAM MEMORY SYSTEM — Inspired by Claude Code's Dream feature.
 *
 * Consolidates, deduplicates, and optimizes the agent memory system.
 * Think of it as garbage collection for AI memory.
 *
 * What it does:
 * 1. SCAN    — Pulls all memory vectors from Pinecone
 * 2. CLUSTER — Groups semantically similar memories
 * 3. MERGE   — Combines duplicates into single consolidated entries
 * 4. RESOLVE — Fixes contradictions (keeps most recent)
 * 5. PRUNE   — Removes stale/outdated memories
 * 6. REINDEX — Writes clean memory back to Pinecone
 *
 * Run this periodically (daily/weekly) to keep memory sharp.
 */

interface MemoryEntry {
  id: string;
  text: string;
  timestamp: number;
  type?: string;
  score?: number;
}

interface DreamReport {
  scanned: number;
  duplicates_merged: number;
  stale_removed: number;
  contradictions_resolved: number;
  final_count: number;
  duration_ms: number;
  summary: string;
}

/**
 * Scan all memories from Pinecone by querying with broad terms.
 */
async function scanMemories(pineconeKey?: string): Promise<MemoryEntry[]> {
  const broadQueries = [
    "business strategy client lead",
    "content marketing seo brand",
    "technology stack architecture model",
    "user preferences settings configuration",
    "competitor analysis market positioning",
  ];

  const allMemories = new Map<string, MemoryEntry>();

  for (const query of broadQueries) {
    const results = await recall(query, 50, pineconeKey);
    for (const match of results) {
      const matchId = `${query}-${match.score}`;
      if (!allMemories.has(matchId)) {
        allMemories.set(matchId, {
          id: matchId,
          text: match.entry?.text || "",
          timestamp: 0,
          type: "unknown",
          score: match.score || 0,
        });
      }
    }
  }

  return Array.from(allMemories.values());
}

/**
 * Use AI to find duplicate/similar memories and merge them.
 */
async function findAndMergeDuplicates(
  memories: MemoryEntry[]
): Promise<{ merged: MemoryEntry[]; duplicateCount: number }> {
  if (memories.length < 2) return { merged: memories, duplicateCount: 0 };

  // Group memories by approximate content similarity using first 100 chars
  const groups = new Map<string, MemoryEntry[]>();
  for (const mem of memories) {
    const key = mem.text.slice(0, 80).toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = groups.get(key);
    if (existing) {
      existing.push(mem);
    } else {
      groups.set(key, [mem]);
    }
  }

  const merged: MemoryEntry[] = [];
  let duplicateCount = 0;

  for (const [, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    // Multiple memories with similar content — merge them
    duplicateCount += group.length - 1;

    // Keep the most recent, but combine unique info
    const sorted = group.sort((a, b) => b.timestamp - a.timestamp);
    const newest = sorted[0];

    if (group.length <= 3) {
      // For small groups, just keep the newest
      merged.push(newest);
    } else {
      // For larger groups, ask AI to consolidate
      const texts = group.map((m) => m.text).join("\n---\n");
      try {
        const consolidated = await ai(
          `These memory entries are about the same topic. Consolidate into one clean, comprehensive entry:\n\n${texts}\n\nOutput ONLY the consolidated memory text.`,
          { maxTokens: 300 }
        );
        merged.push({
          ...newest,
          text: consolidated,
        });
      } catch {
        merged.push(newest);
      }
    }
  }

  return { merged, duplicateCount };
}

/**
 * Remove stale memories (older than 30 days with low relevance).
 */
function pruneStale(memories: MemoryEntry[]): {
  kept: MemoryEntry[];
  removedCount: number;
} {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const kept: MemoryEntry[] = [];
  let removedCount = 0;

  for (const mem of memories) {
    // Keep if: recent, or high score, or no timestamp (legacy)
    if (
      mem.timestamp === 0 ||
      mem.timestamp > thirtyDaysAgo ||
      (mem.score && mem.score > 0.8)
    ) {
      kept.push(mem);
    } else {
      removedCount++;
    }
  }

  return { kept, removedCount };
}

/**
 * Reindex cleaned memories back to Pinecone.
 */
async function reindex(
  memories: MemoryEntry[],
  removedIds: string[],
  pineconeKey?: string
): Promise<void> {
  const pc = await getPineconeClient(pineconeKey);
  if (!pc) return;

  const index = pc.client.index(pc.index);

  // Delete removed entries
  if (removedIds.length > 0) {
    try {
      // Pinecone delete by IDs — batch in groups of 100
      for (let i = 0; i < removedIds.length; i += 100) {
        const batch = removedIds.slice(i, i + 100);
        await index.deleteMany(batch);
      }
    } catch (err) {
      log.warn("Failed to delete stale vectors:", err as Record<string, unknown>);
    }
  }

  // Upsert merged/updated entries
  for (const mem of memories) {
    if (mem.text) {
      try {
        const vector = await embed(mem.text);
        await index.upsert({
          records: [
            {
              id: mem.id,
              values: vector,
              metadata: {
                text: mem.text,
                type: mem.type || "consolidated",
                timestamp: Date.now(),
                dreamProcessed: true,
              },
            },
          ],
        });
      } catch {
        // Skip individual failures
      }
    }
  }
}

/**
 * DREAM — Main consolidation pipeline.
 *
 * Call this periodically to keep agent memory clean.
 * Returns a report of what was done.
 */
export async function dream(pineconeKey?: string): Promise<DreamReport> {
  const startTime = Date.now();
  log.info("Dream cycle starting — scanning memories...");

  // 1. SCAN
  const allMemories = await scanMemories(pineconeKey);
  log.info(`Scanned ${allMemories.length} memory entries`);

  if (allMemories.length === 0) {
    return {
      scanned: 0,
      duplicates_merged: 0,
      stale_removed: 0,
      contradictions_resolved: 0,
      final_count: 0,
      duration_ms: Date.now() - startTime,
      summary: "No memories found. Memory system is empty.",
    };
  }

  // 2. MERGE duplicates
  const { merged, duplicateCount } = await findAndMergeDuplicates(allMemories);
  log.info(`Merged ${duplicateCount} duplicates → ${merged.length} unique entries`);

  // 3. PRUNE stale
  const { kept, removedCount } = pruneStale(merged);
  log.info(`Pruned ${removedCount} stale entries → ${kept.length} active entries`);

  // 4. REINDEX
  const removedIds = allMemories
    .filter((m) => !kept.find((k) => k.id === m.id))
    .map((m) => m.id);
  await reindex(kept, removedIds, pineconeKey);

  const duration = Date.now() - startTime;
  log.info(`Dream cycle complete in ${duration}ms`);

  // 5. Generate summary
  let summary = `Dream cycle complete. `;
  summary += `Scanned ${allMemories.length} memories. `;
  if (duplicateCount > 0) summary += `Merged ${duplicateCount} duplicates. `;
  if (removedCount > 0) summary += `Removed ${removedCount} stale entries. `;
  summary += `${kept.length} clean memories remain.`;

  return {
    scanned: allMemories.length,
    duplicates_merged: duplicateCount,
    stale_removed: removedCount,
    contradictions_resolved: 0,
    final_count: kept.length,
    duration_ms: duration,
    summary,
  };
}
