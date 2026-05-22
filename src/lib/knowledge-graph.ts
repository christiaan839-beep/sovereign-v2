/**
 * SOVEREIGN MATRIX — Knowledge graph (Wave 145).
 *
 * The entity-relationship layer that activates the dormant
 * `graph_nodes` + `graph_edges` tables. Two surfaces:
 *
 *   1. EXTRACTION — pure-function entity extractor over agent output
 *      strings. Pulls domains, URLs, $-amounts, dates, capitalised
 *      named entities. No LLM call — cheap enough to run on every
 *      memory write.
 *
 *   2. WRITES — `upsertNode` + `upsertEdge` with per-user namespacing,
 *      idempotent on (userId, nodeType, label) tuple so re-extracting
 *      the same entity just bumps a weight instead of duplicating.
 *
 * Auto-feed hook:
 *   `recordRunAsGraph(userId, agentName, output)` is called from
 *   the agent-factory after every signed run. Extracts entities from
 *   the output, writes nodes, links them to the agent via EXECUTED
 *   edges. Best-effort — failures never block the run.
 *
 * Operating cost:
 *   - One INSERT per distinct new entity per call
 *   - One INSERT per edge (capped at 12 entities/call)
 *   - Fail-soft on missing table (42P01) and on duplicate keys
 *
 * Tested in isolation:
 *   `extractEntities(text)` and `mergeEntities(prev, next)` are pure
 *   and pinned by the test file.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("knowledge-graph");

const MAX_ENTITIES_PER_RUN = 12;
const MAX_LABEL_LEN = 120;

export type NodeType =
  | "domain"
  | "url"
  | "amount"
  | "date"
  | "entity"
  | "agent"
  | "concept";

export interface ExtractedEntity {
  nodeType: NodeType;
  label: string;
  confidence: number; // 0-100
}

/**
 * Pure entity extractor — no LLM, no I/O. Regex-based heuristics
 * over the output text. Returns deduplicated entities, capped at
 * MAX_ENTITIES_PER_RUN.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  if (!text || text.length < 8) return [];
  const safe = text.slice(0, 20_000);

  const out = new Map<string, ExtractedEntity>();

  // URLs (must come first; they overlap with domains)
  const urlRe = /\bhttps?:\/\/[^\s)\]>"']+/g;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(safe)) !== null) {
    const url = m[0].replace(/[.,;:!?)\]>]+$/, "");
    add(out, "url", url, 95);
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        add(out, "domain", host, 90);
      }
    } catch {
      /* skip malformed */
    }
  }

  // Bare domains (e.g. acme.com without scheme)
  const domainRe =
    /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|io|ai|co|net|org|app|dev|xyz|so|gg|gov|edu)(?:\.[a-z]{2})?)\b/gi;
  while ((m = domainRe.exec(safe)) !== null) {
    add(out, "domain", m[1].toLowerCase(), 80);
  }

  // Dollar amounts ($X, $X.XX, $XK, $XM, $XB)
  const amountRe = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:[kKmMbB]\b|\b)/g;
  while ((m = amountRe.exec(safe)) !== null) {
    const a = m[0].replace(/\s/g, "");
    add(out, "amount", a, 75);
  }

  // ISO dates + Month DD, YYYY
  const dateRe =
    /\b(?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/g;
  while ((m = dateRe.exec(safe)) !== null) {
    add(out, "date", m[0], 85);
  }

  // Capitalised named entities (3+ char proper nouns, conservatively)
  const namedRe =
    /\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{1,})?(?:\s[A-Z][a-z]{1,})?)\b/g;
  const STOP = new Set([
    "The",
    "And",
    "But",
    "For",
    "However",
    "Therefore",
    "When",
    "While",
    "If",
    "Although",
    "Because",
    "Since",
    "Until",
    "Where",
    "Which",
    "What",
    "Why",
    "How",
    "Step",
    "Note",
  ]);
  while ((m = namedRe.exec(safe)) !== null) {
    const label = m[1].trim();
    if (label.length < 3 || label.length > MAX_LABEL_LEN) continue;
    if (STOP.has(label.split(" ")[0])) continue;
    add(out, "entity", label, 60);
  }

  const arr = [...out.values()];
  // Sort by confidence desc, take top N
  arr.sort((a, b) => b.confidence - a.confidence);
  return arr.slice(0, MAX_ENTITIES_PER_RUN);
}

function add(
  out: Map<string, ExtractedEntity>,
  nodeType: NodeType,
  rawLabel: string,
  confidence: number,
): void {
  const label = rawLabel.slice(0, MAX_LABEL_LEN).trim();
  if (!label) return;
  const key = `${nodeType}::${label.toLowerCase()}`;
  const prev = out.get(key);
  if (prev) {
    // Bump confidence (capped) when seen multiple times in same text
    prev.confidence = Math.min(100, prev.confidence + 2);
    return;
  }
  out.set(key, { nodeType, label, confidence });
}

/** Pure merger — deduplicates two extracted lists, bumping weights. */
export function mergeEntities(
  prev: ExtractedEntity[],
  next: ExtractedEntity[],
): ExtractedEntity[] {
  const map = new Map<string, ExtractedEntity>();
  for (const e of [...prev, ...next]) {
    const key = `${e.nodeType}::${e.label.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.confidence = Math.min(100, existing.confidence + 5);
    } else {
      map.set(key, { ...e });
    }
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

async function ensureGraphTables(): Promise<boolean> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence INTEGER DEFAULT 100,
        embedding TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS graph_nodes_user_type_label_uniq
      ON graph_nodes (user_id, node_type, label)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS graph_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        source_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
        target_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
        edge_type TEXT NOT NULL,
        weight INTEGER DEFAULT 100,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence INTEGER DEFAULT 100,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    return true;
  } catch (err) {
    log.warn("ensureGraphTables failed", { error: String(err) });
    return false;
  }
}

/**
 * Idempotent upsert — returns the row id. Re-running with the
 * same (userId, nodeType, label) bumps confidence + updated_at.
 */
export async function upsertNode(
  userId: string,
  nodeType: NodeType,
  label: string,
  confidence: number = 80,
): Promise<string | null> {
  if (!userId || userId === "anon") return null;
  if (!label || label.length > MAX_LABEL_LEN) return null;
  const ready = await ensureGraphTables();
  if (!ready) return null;
  try {
    const r = (await db.execute(sql`
      INSERT INTO graph_nodes (user_id, node_type, label, confidence)
      VALUES (${userId}, ${nodeType}, ${label}, ${confidence})
      ON CONFLICT (user_id, node_type, label)
      DO UPDATE SET
        confidence = LEAST(100, graph_nodes.confidence + 1),
        updated_at = now()
      RETURNING id
    `)) as unknown as { rows?: Array<{ id: string }> };
    const rows = Array.isArray(r)
      ? (r as unknown as Array<{ id: string }>)
      : (r.rows ?? []);
    return rows[0]?.id ?? null;
  } catch (err) {
    log.warn("upsertNode failed", { error: String(err), label });
    return null;
  }
}

/**
 * Append an edge between two nodes. Edges are append-only (no
 * conflict resolution) — repeated edge writes form a weighted
 * multigraph the operator can query.
 */
export async function upsertEdge(
  userId: string,
  sourceId: string,
  targetId: string,
  edgeType: string,
  weight: number = 100,
): Promise<boolean> {
  if (!userId || userId === "anon") return false;
  if (!sourceId || !targetId || sourceId === targetId) return false;
  const ready = await ensureGraphTables();
  if (!ready) return false;
  try {
    await db.execute(sql`
      INSERT INTO graph_edges (user_id, source_id, target_id, edge_type, weight)
      VALUES (${userId}, ${sourceId}::uuid, ${targetId}::uuid, ${edgeType}, ${weight})
    `);
    return true;
  } catch (err) {
    log.warn("upsertEdge failed", { error: String(err) });
    return false;
  }
}

/**
 * Auto-feed hook — call from the agent-factory after a signed run.
 * Extracts entities from the result, writes nodes, links each entity
 * to the agent node via an EXECUTED edge. Best-effort.
 */
export async function recordRunAsGraph(
  userId: string,
  agentName: string,
  result: unknown,
): Promise<{ nodesWritten: number; edgesWritten: number }> {
  if (!userId || userId === "anon") {
    return { nodesWritten: 0, edgesWritten: 0 };
  }
  // Stringify the result safely — bound to 20KB
  let text = "";
  try {
    text = typeof result === "string" ? result : JSON.stringify(result);
  } catch {
    return { nodesWritten: 0, edgesWritten: 0 };
  }

  const entities = extractEntities(text);
  if (entities.length === 0) {
    return { nodesWritten: 0, edgesWritten: 0 };
  }

  const agentNodeId = await upsertNode(userId, "agent", agentName, 100);
  if (!agentNodeId) {
    return { nodesWritten: 0, edgesWritten: 0 };
  }

  let nodesWritten = 1;
  let edgesWritten = 0;
  for (const e of entities) {
    const id = await upsertNode(userId, e.nodeType, e.label, e.confidence);
    if (!id) continue;
    nodesWritten++;
    if (await upsertEdge(userId, agentNodeId, id, "EXECUTED", e.confidence)) {
      edgesWritten++;
    }
  }
  return { nodesWritten, edgesWritten };
}

export interface GraphSummary {
  userId: string;
  nodeCounts: Array<{ type: NodeType | string; count: number }>;
  topNodes: Array<{
    id: string;
    nodeType: string;
    label: string;
    confidence: number;
    degree: number;
  }>;
  edgeCount: number;
}

/** Admin-facing snapshot of one user's graph. */
export async function summariseGraph(
  userId: string,
  topN: number = 25,
): Promise<GraphSummary> {
  if (!userId) {
    return { userId, nodeCounts: [], topNodes: [], edgeCount: 0 };
  }
  const ready = await ensureGraphTables();
  if (!ready) {
    return { userId, nodeCounts: [], topNodes: [], edgeCount: 0 };
  }
  try {
    const countsRaw = (await db.execute(sql`
      SELECT node_type, COUNT(*)::int AS c
      FROM graph_nodes
      WHERE user_id = ${userId}
      GROUP BY node_type
      ORDER BY c DESC
    `)) as unknown as { rows?: Array<{ node_type: string; c: number }> };
    const counts = Array.isArray(countsRaw)
      ? (countsRaw as unknown as Array<{ node_type: string; c: number }>)
      : (countsRaw.rows ?? []);

    const topRaw = (await db.execute(sql`
      SELECT n.id, n.node_type, n.label, n.confidence,
             (SELECT COUNT(*)::int FROM graph_edges WHERE source_id = n.id OR target_id = n.id) AS degree
      FROM graph_nodes n
      WHERE n.user_id = ${userId}
      ORDER BY degree DESC, n.confidence DESC
      LIMIT ${Math.min(Math.max(topN, 1), 100)}
    `)) as unknown as {
      rows?: Array<{
        id: string;
        node_type: string;
        label: string;
        confidence: number;
        degree: number;
      }>;
    };
    const topNodes = Array.isArray(topRaw)
      ? (topRaw as unknown as Array<{
          id: string;
          node_type: string;
          label: string;
          confidence: number;
          degree: number;
        }>)
      : (topRaw.rows ?? []);

    const edgeRaw = (await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM graph_edges WHERE user_id = ${userId}
    `)) as unknown as { rows?: Array<{ c: number }> };
    const edgeRow = Array.isArray(edgeRaw)
      ? (edgeRaw as unknown as Array<{ c: number }>)
      : (edgeRaw.rows ?? []);

    return {
      userId,
      nodeCounts: counts.map((r) => ({ type: r.node_type, count: r.c })),
      topNodes: topNodes.map((n) => ({
        id: n.id,
        nodeType: n.node_type,
        label: n.label,
        confidence: n.confidence,
        degree: n.degree,
      })),
      edgeCount: edgeRow[0]?.c ?? 0,
    };
  } catch (err) {
    log.warn("summariseGraph failed", { error: String(err) });
    return { userId, nodeCounts: [], topNodes: [], edgeCount: 0 };
  }
}
