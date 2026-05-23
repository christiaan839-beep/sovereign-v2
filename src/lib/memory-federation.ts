/**
 * SOVEREIGN MATRIX — Memory federation + consolidation (Wave 140).
 *
 * Two patterns that unlock the compounding knowledge effect:
 *
 *   1. CROSS-AGENT FEDERATION — a single retrieval query that pulls
 *      from N agents' memory namespaces at once, ranked by similarity.
 *      Today each agent reads only its own memory; once an audit
 *      surfaces "competitor X uses Stripe", the `closer` agent
 *      should be able to see that too when working on the same lead.
 *
 *   2. SEMANTIC CONSOLIDATION — periodic LLM-summary that collapses
 *      ~N related memories into K dense "atoms", deleting the
 *      originals. Without this, vector memory unbounded-grows and
 *      retrieval quality drops as duplicate-ish memories crowd out
 *      diverse ones. Triggered by operator + cron.
 *
 * Design:
 *   - Federation is OPT-IN per-call: the caller passes an explicit
 *     allowlist of agent names that may contribute. No silent
 *     cross-tenant leak.
 *   - Consolidation always preserves the original `agentName` of
 *     the consolidated entries in metadata. Audit trail intact.
 *   - Both surfaces are pure-function at their core for test pinning.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("memory-federation");

export interface FederatedMatch {
  content: string;
  agentName: string;
  similarity: number;
  createdAt: string;
  /** Original metadata blob (kind, url, target, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Federated search across a caller-supplied allowlist of agent
 * namespaces within ONE user's memory. Returns matches sorted by
 * similarity desc, capped at `limit`.
 *
 * Empty `agentAllowlist` → returns []. Empty user → returns [].
 * Never cross-tenant — `userId` is always pinned.
 */
export async function federatedSearch(
  userId: string,
  query: string,
  agentAllowlist: string[],
  limit: number = 10,
): Promise<FederatedMatch[]> {
  if (!userId || userId === "anon") return [];
  if (!query.trim()) return [];
  const allowlist = agentAllowlist
    .filter((a) => typeof a === "string" && a.length > 0)
    .slice(0, 25);
  if (allowlist.length === 0) return [];
  const cap = Math.min(Math.max(limit, 1), 50);

  try {
    const { embed } = await import("@/lib/ai");
    const embedding = await embed(query);
    if (!embedding || embedding.length === 0) {
      // Fallback to text-only search (no embedder)
      return textOnlySearch(userId, query, allowlist, cap);
    }
    const vector = `[${embedding.join(",")}]`;
    // Inline SQL — Drizzle doesn't expose <=> operator directly.
    // We use a parameterised query via the sql template.
    const result = (await db.execute(sql`
      SELECT content, agent_name, metadata, created_at,
             1 - (embedding <=> ${vector}::vector) AS similarity
      FROM agent_memories
      WHERE user_id = ${userId}
        AND agent_name = ANY(${allowlist})
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${cap}
    `)) as unknown as {
      rows: Array<{
        content: string;
        agent_name: string;
        metadata: unknown;
        created_at: Date | string;
        similarity: number;
      }>;
    };
    const rows = Array.isArray(result)
      ? (result as unknown as typeof result.rows)
      : (result.rows ?? []);
    return rows.map((r) => ({
      content: r.content,
      agentName: r.agent_name,
      similarity: Number(r.similarity ?? 0),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      metadata: parseMetadata(r.metadata),
    }));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") return [];
    log.warn("federatedSearch failed", { error: String(err) });
    return [];
  }
}

async function textOnlySearch(
  userId: string,
  query: string,
  allowlist: string[],
  cap: number,
): Promise<FederatedMatch[]> {
  try {
    const pattern = `%${query.slice(0, 80).replace(/[%_]/g, "")}%`;
    const result = (await db.execute(sql`
      SELECT content, agent_name, metadata, created_at
      FROM agent_memories
      WHERE user_id = ${userId}
        AND agent_name = ANY(${allowlist})
        AND content ILIKE ${pattern}
      ORDER BY created_at DESC
      LIMIT ${cap}
    `)) as unknown as {
      rows: Array<{
        content: string;
        agent_name: string;
        metadata: unknown;
        created_at: Date | string;
      }>;
    };
    const rows = Array.isArray(result)
      ? (result as unknown as typeof result.rows)
      : (result.rows ?? []);
    return rows.map((r) => ({
      content: r.content,
      agentName: r.agent_name,
      similarity: 0.5, // text-match placeholder
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      metadata: parseMetadata(r.metadata),
    }));
  } catch {
    return [];
  }
}

function parseMetadata(raw: unknown): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ─── Consolidation ───────────────────────────────────────────────────

export interface ConsolidationCandidate {
  ids: string[];
  /** Combined content (joined with " · "). */
  combined: string;
  agentName: string;
  oldestAt: string;
  newestAt: string;
}

export interface ConsolidationPlan {
  /** Groups that should be summarised + replaced. */
  groups: ConsolidationCandidate[];
  totalCandidates: number;
}

/**
 * Pure clustering — given a flat list of recent memories, groups
 * them into consolidation candidates by:
 *   - same agentName
 *   - same `kind` metadata (when present)
 *   - cluster size between minPerCluster and maxPerCluster
 *
 * Returns the groups to be summarised, never mutating the input.
 */
export function planConsolidation(
  memories: Array<{
    id: string;
    content: string;
    agentName: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }>,
  opts: {
    minPerCluster?: number;
    maxPerCluster?: number;
  } = {},
): ConsolidationPlan {
  const minPer = Math.max(2, opts.minPerCluster ?? 4);
  const maxPer = Math.max(minPer, opts.maxPerCluster ?? 12);

  const groups = new Map<
    string,
    {
      ids: string[];
      content: string[];
      agentName: string;
      oldestAt: string;
      newestAt: string;
    }
  >();

  for (const m of memories) {
    const kind =
      typeof m.metadata?.kind === "string" ? m.metadata.kind : m.agentName;
    const key = `${m.agentName}::${kind}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = {
        ids: [],
        content: [],
        agentName: m.agentName,
        oldestAt: m.createdAt,
        newestAt: m.createdAt,
      };
      groups.set(key, bucket);
    }
    if (bucket.ids.length >= maxPer) continue;
    bucket.ids.push(m.id);
    bucket.content.push(m.content);
    if (m.createdAt < bucket.oldestAt) bucket.oldestAt = m.createdAt;
    if (m.createdAt > bucket.newestAt) bucket.newestAt = m.createdAt;
  }

  const out: ConsolidationCandidate[] = [];
  for (const bucket of groups.values()) {
    if (bucket.ids.length < minPer) continue;
    out.push({
      ids: bucket.ids,
      combined: bucket.content.join(" · "),
      agentName: bucket.agentName,
      oldestAt: bucket.oldestAt,
      newestAt: bucket.newestAt,
    });
  }
  return {
    groups: out,
    totalCandidates: out.reduce((s, g) => s + g.ids.length, 0),
  };
}

/**
 * Cheap heuristic summariser — no LLM. Picks the 3 most distinct
 * sentences across the cluster. Operators with NIM/Anthropic keys
 * pass their own LLM-as-summariser.
 */
export function heuristicSummarise(combined: string): string {
  const sentences = combined
    .split(/\s+·\s+/g)
    .filter((s) => s.length > 20)
    .slice(0, 12);
  if (sentences.length <= 3) return sentences.join(" · ");
  // Greedy dedup — keep the first; for each subsequent, keep only if
  // its 4+ letter words don't overlap by more than 50% with any
  // already-kept sentence.
  const kept: string[] = [sentences[0]];
  for (let i = 1; i < sentences.length && kept.length < 3; i++) {
    const candWords = new Set(
      (sentences[i].toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 30),
    );
    let tooClose = false;
    for (const k of kept) {
      const kWords = new Set(
        (k.toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 30),
      );
      let overlap = 0;
      for (const w of candWords) if (kWords.has(w)) overlap++;
      if (
        overlap > 0 &&
        overlap / Math.max(1, Math.min(candWords.size, kWords.size)) > 0.5
      ) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) kept.push(sentences[i]);
  }
  return kept.join(" · ");
}

/**
 * Live consolidation — pulls recent memories, plans clusters,
 * summarises, writes new compact entries, deletes the originals.
 * Returns the consolidation report.
 *
 * Caller-supplied `summariser` is OPTIONAL (heuristic fallback).
 *
 * Best-effort — failures log and return a degraded report.
 */
export async function consolidateMemories(opts: {
  userId: string;
  olderThanDays?: number;
  maxClusters?: number;
  summariser?: (combined: string, agentName: string) => Promise<string>;
}): Promise<{
  clustersProcessed: number;
  rowsRemoved: number;
  rowsAdded: number;
}> {
  if (!opts.userId || opts.userId === "anon") {
    return { clustersProcessed: 0, rowsRemoved: 0, rowsAdded: 0 };
  }
  const olderThanDays = opts.olderThanDays ?? 14;
  const since = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const maxClusters = Math.min(Math.max(opts.maxClusters ?? 25, 1), 100);

  let rowsRemoved = 0;
  let rowsAdded = 0;
  let clustersProcessed = 0;

  try {
    const result = (await db.execute(sql`
      SELECT id, content, agent_name, metadata, created_at
      FROM agent_memories
      WHERE user_id = ${opts.userId}
        AND created_at < ${since.toISOString()}
      ORDER BY created_at DESC
      LIMIT 2000
    `)) as unknown as {
      rows: Array<{
        id: string;
        content: string;
        agent_name: string;
        metadata: unknown;
        created_at: Date | string;
      }>;
    };
    const rows = Array.isArray(result)
      ? (result as unknown as typeof result.rows)
      : (result.rows ?? []);

    const memories = rows.map((r) => ({
      id: r.id,
      content: r.content,
      agentName: r.agent_name,
      metadata: parseMetadata(r.metadata),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    }));

    const plan = planConsolidation(memories);
    const groups = plan.groups.slice(0, maxClusters);

    const { storeMemory } = await import("@/lib/vector-memory");

    for (const group of groups) {
      const summary = opts.summariser
        ? await opts
            .summariser(group.combined, group.agentName)
            .catch(() => heuristicSummarise(group.combined))
        : heuristicSummarise(group.combined);

      const wrote = await storeMemory(opts.userId, group.agentName, summary, {
        kind: "consolidated-summary",
        consolidatedFrom: group.ids.length,
        oldestAt: group.oldestAt,
        newestAt: group.newestAt,
      });
      if (!wrote) continue;
      rowsAdded++;
      // Delete the originals atomically
      try {
        await db.execute(sql`
          DELETE FROM agent_memories
          WHERE user_id = ${opts.userId}
            AND id = ANY(${group.ids}::uuid[])
        `);
        rowsRemoved += group.ids.length;
      } catch (err) {
        log.warn("consolidation delete failed", { error: String(err) });
      }
      clustersProcessed++;
    }
  } catch (err) {
    log.warn("consolidateMemories failed", { error: String(err) });
  }

  return { clustersProcessed, rowsRemoved, rowsAdded };
}
