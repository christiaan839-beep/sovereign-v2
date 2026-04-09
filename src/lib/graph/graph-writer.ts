/**
 * SOVEREIGN MATRIX — Knowledge Graph Writer
 *
 * Writes to the knowledge graph after every agent execution.
 * Extracts entities from input/output using fast regex patterns (no LLM call),
 * then creates graph nodes and edges to build a queryable execution history.
 *
 * Works alongside the LLM-based relationship-extractor.ts — this module handles
 * structured entity extraction (emails, URLs, mentions) while the extractor
 * handles semantic relationship discovery.
 */

import { db } from "@/db";
import { graphNodes, graphEdges } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("graph-writer");

// ── Types ──

export interface ExtractedEntity {
  label: string;
  type: "contact" | "company" | "person" | "entity";
}

export interface RecordParams {
  userId: string;
  agentName: string;
  input: string;
  output: string;
  durationMs: number;
}

// ── Entity Extraction (regex-based, zero LLM cost) ──

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)/g;
const DOMAIN_RE = /\b([a-zA-Z0-9-]+\.(?:com|io|ai|co|org|net|dev|app|xyz))\b/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const MENTION_RE = /@([a-zA-Z0-9_]{2,30})/g;
// Capitalized multi-word phrases (2-4 words), excluding common English phrases
const PROPER_NOUN_RE = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})\b/g;
const NOISE_PROPER_NOUNS = new Set([
  "The", "This", "That", "These", "Those", "What", "When", "Where",
  "Here", "There", "Please", "Thank You", "Hello", "Dear", "Best Regards",
  "In The", "On The", "For The", "With The", "From The",
]);

/**
 * Extract structured entities from text using regex patterns.
 * Fast, deterministic, zero API cost.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  if (!text || text.length < 5) return [];

  const seen = new Set<string>();
  const entities: ExtractedEntity[] = [];

  function add(label: string, type: ExtractedEntity["type"]) {
    const key = `${type}:${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({ label, type });
  }

  // Emails → contact
  for (const match of text.matchAll(EMAIL_RE)) {
    add(match[0], "contact");
  }

  // URLs → company (extract domain)
  for (const match of text.matchAll(URL_RE)) {
    add(match[1], "company");
  }

  // Bare domains → company
  for (const match of text.matchAll(DOMAIN_RE)) {
    add(match[1], "company");
  }

  // Phone numbers → contact
  for (const match of text.matchAll(PHONE_RE)) {
    add(match[0].trim(), "contact");
  }

  // @mentions → person
  for (const match of text.matchAll(MENTION_RE)) {
    add(match[1], "person");
  }

  // Capitalized multi-word phrases → entity
  for (const match of text.matchAll(PROPER_NOUN_RE)) {
    const phrase = match[1];
    if (!NOISE_PROPER_NOUNS.has(phrase)) {
      add(phrase, "entity");
    }
  }

  // Cap at 20 entities per text to avoid graph bloat
  return entities.slice(0, 20);
}

// ── Graph Writing ──

/** PostgreSQL error code for missing table */
const PG_UNDEFINED_TABLE = "42P01";

function isMissingTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === PG_UNDEFINED_TABLE
  );
}

/**
 * Record an agent execution in the knowledge graph.
 *
 * Creates:
 * - A "task" node for the execution itself
 * - "entity"/"contact"/"company"/"person" nodes for extracted entities
 * - PRODUCED edges from execution → each entity
 * - PRECEDED edge from previous execution (same user) → this execution
 *
 * Fire-and-forget safe — caller should .catch(() => {}).
 */
export async function recordAgentExecution(params: RecordParams): Promise<{
  executionNodeId: string | null;
  entityCount: number;
}> {
  const { userId, agentName, input, output, durationMs } = params;

  try {
    // 1. Create the execution node
    const [execNode] = await db
      .insert(graphNodes)
      .values({
        userId,
        nodeType: "task",
        label: agentName,
        properties: JSON.stringify({
          inputPreview: input.slice(0, 200),
          outputPreview: output.slice(0, 200),
          durationMs,
          timestamp: new Date().toISOString(),
        }),
        confidence: 100,
      })
      .returning();

    if (!execNode) {
      return { executionNodeId: null, entityCount: 0 };
    }

    // 2. Link to previous execution by same user (PRECEDED edge)
    try {
      const previousExecs = await db
        .select({ id: graphNodes.id })
        .from(graphNodes)
        .where(
          and(
            eq(graphNodes.userId, userId),
            eq(graphNodes.nodeType, "task"),
          )
        )
        .orderBy(desc(graphNodes.createdAt))
        .limit(2); // current + previous

      // The second result is the previous execution (first is the one we just inserted)
      const prevExec = previousExecs.find((n) => n.id !== execNode.id);
      if (prevExec) {
        await db.insert(graphEdges).values({
          userId,
          sourceId: prevExec.id,
          targetId: execNode.id,
          edgeType: "PRECEDED",
          weight: 100,
          properties: "{}",
          confidence: 100,
        });
      }
    } catch (edgeErr) {
      // Non-critical — log and continue
      if (!isMissingTable(edgeErr)) {
        log.warn("Failed to create PRECEDED edge", { error: String(edgeErr) });
      }
    }

    // 3. Extract entities from input + output
    const combinedText = `${input}\n${output}`;
    const entities = extractEntities(combinedText);

    // 4. Create entity nodes + PRODUCED edges
    let entityCount = 0;
    for (const entity of entities) {
      try {
        const [entityNode] = await db
          .insert(graphNodes)
          .values({
            userId,
            nodeType: entity.type,
            label: entity.label,
            properties: JSON.stringify({ source: agentName }),
            confidence: 80,
          })
          .returning();

        if (entityNode) {
          await db.insert(graphEdges).values({
            userId,
            sourceId: execNode.id,
            targetId: entityNode.id,
            edgeType: "PRODUCED",
            weight: 100,
            properties: "{}",
            confidence: 80,
          });
          entityCount++;
        }
      } catch (entityErr) {
        if (isMissingTable(entityErr)) return { executionNodeId: execNode.id, entityCount };
        log.warn("Failed to write entity node", { entity: entity.label, error: String(entityErr) });
      }
    }

    log.info("Recorded agent execution in graph", {
      agent: agentName,
      nodeId: execNode.id,
      entities: entityCount,
    });

    return { executionNodeId: execNode.id, entityCount };
  } catch (err) {
    if (isMissingTable(err)) {
      log.info("Graph tables not yet migrated — skipping write");
      return { executionNodeId: null, entityCount: 0 };
    }
    log.warn("recordAgentExecution failed", { agent: agentName, error: String(err) });
    return { executionNodeId: null, entityCount: 0 };
  }
}

// ── Query ──

/**
 * Find everything related to an entity label across all agent runs for a user.
 * Returns the entity node(s), connected execution nodes, and all edges between them.
 */
export async function queryRelated(
  userId: string,
  label: string,
): Promise<{
  nodes: Array<{ id: string; type: string; label: string; properties: Record<string, unknown> }>;
  edges: Array<{ sourceId: string; targetId: string; edgeType: string }>;
}> {
  try {
    // Find nodes matching the label (case-insensitive partial match via ILIKE)
    const filtered = await db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, userId),
          sql`${graphNodes.label} ILIKE ${"%" + label + "%"}`,
        )
      )
      .limit(50);

    if (filtered.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodeIds = filtered.map((n) => n.id);

    // Find all edges connected to these nodes
    const allEdges = await db
      .select()
      .from(graphEdges)
      .where(eq(graphEdges.userId, userId))
      .limit(500);

    const relevantEdges = allEdges.filter(
      (e) => nodeIds.includes(e.sourceId) || nodeIds.includes(e.targetId)
    );

    // Collect connected node IDs we need to fetch
    const connectedIds = new Set<string>();
    for (const e of relevantEdges) {
      connectedIds.add(e.sourceId);
      connectedIds.add(e.targetId);
    }
    // Remove IDs we already have
    for (const id of nodeIds) connectedIds.delete(id);

    // Fetch connected nodes
    let connectedNodes: typeof filtered = [];
    if (connectedIds.size > 0) {
      const allNodes = await db
        .select()
        .from(graphNodes)
        .where(eq(graphNodes.userId, userId))
        .limit(500);

      connectedNodes = allNodes.filter((n) => connectedIds.has(n.id));
    }

    const allResultNodes = [...filtered, ...connectedNodes];

    return {
      nodes: allResultNodes.map((n) => ({
        id: n.id,
        type: n.nodeType,
        label: n.label,
        properties: JSON.parse(n.properties || "{}"),
      })),
      edges: relevantEdges.map((e) => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        edgeType: e.edgeType,
      })),
    };
  } catch (err) {
    if (isMissingTable(err)) {
      log.info("Graph tables not yet migrated — returning empty");
      return { nodes: [], edges: [] };
    }
    log.warn("queryRelated failed", { label, error: String(err) });
    return { nodes: [], edges: [] };
  }
}
