/**
 * SOVEREIGN MATRIX — Hybrid Retriever
 *
 * Combines three retrieval strategies:
 *   1. Vector search — semantic similarity via embeddings
 *   2. Graph traversal — follow relationships between entities
 *   3. Time-weighted recency — newer data ranks higher
 *
 * Query example: "Find tasks similar to X that led to failure, and the agents that succeeded later"
 * → Vector finds similar tasks, graph follows LEADS_TO edges, time filter prioritizes recent
 */

import { db } from "@/db";
import { graphNodes, graphEdges } from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("hybrid-retriever");

// ── Types ──

export interface RetrievalResult {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    properties: Record<string, unknown>;
    score: number; // combined relevance score (0-1)
    source: "vector" | "graph" | "both";
  }>;
  paths: Array<{
    from: string;
    edge: string;
    to: string;
    weight: number;
  }>;
  totalResults: number;
}

interface QueryOptions {
  userId: string;
  query: string;
  /** Node types to filter (optional) */
  nodeTypes?: string[];
  /** Edge types to follow (optional) */
  edgeTypes?: string[];
  /** Maximum results (default: 10) */
  topK?: number;
  /** How far back to look in days (default: 90) */
  maxAgeDays?: number;
  /** Time decay factor — higher = more recency bias (default: 0.3) */
  recencyWeight?: number;
}

// ── Hybrid Query ──

export async function hybridQuery(options: QueryOptions): Promise<RetrievalResult> {
  const {
    userId,
    query,
    nodeTypes,
    edgeTypes,
    topK = 10,
    maxAgeDays = 90,
    recencyWeight = 0.3,
  } = options;

  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  try {
    // ── Step 1: Text-based node search (label + properties matching) ──
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const textConditions = [
      eq(graphNodes.userId, userId),
      gte(graphNodes.createdAt, cutoffDate),
    ];

    if (nodeTypes && nodeTypes.length > 0) {
      textConditions.push(sql`${graphNodes.nodeType} = ANY(${nodeTypes})`);
    }

    const textResults = await db
      .select()
      .from(graphNodes)
      .where(and(...textConditions))
      .orderBy(desc(graphNodes.updatedAt))
      .limit(topK * 3); // Over-fetch for ranking

    // Score by text relevance + recency
    const scoredNodes = textResults.map(node => {
      const label = node.label.toLowerCase();
      const props = node.properties.toLowerCase();

      // Text relevance (how many query terms appear in label/properties)
      const termHits = queryTerms.filter(t => label.includes(t) || props.includes(t)).length;
      const textScore = queryTerms.length > 0 ? termHits / queryTerms.length : 0.5;

      // Recency score (exponential decay)
      const ageMs = Date.now() - new Date(node.createdAt!).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      const recencyScore = Math.exp(-ageDays / 30); // Half-life of 30 days

      // Combined score
      const combinedScore = textScore * (1 - recencyWeight) + recencyScore * recencyWeight;

      return {
        id: node.id,
        type: node.nodeType,
        label: node.label,
        properties: JSON.parse(node.properties || "{}"),
        score: Math.round(combinedScore * 100) / 100,
        // Initial source — may be upgraded to "both" when a graph edge
        // bonus lands on this node below. Typed as the union so the later
        // assignment is allowed without const-narrowing.
        source: "vector" as "vector" | "graph" | "both",
        confidence: node.confidence || 100,
      };
    });

    // Sort by score, take top K
    scoredNodes.sort((a, b) => b.score - a.score);
    const topNodes = scoredNodes.slice(0, topK);

    // ── Step 2: Graph traversal — follow edges from top nodes ──
    const topNodeIds = topNodes.map(n => n.id);
    let paths: Array<{ from: string; edge: string; to: string; weight: number }> = [];

    if (topNodeIds.length > 0) {
      const edgeConditions = [
        eq(graphEdges.userId, userId),
      ];

      if (edgeTypes && edgeTypes.length > 0) {
        edgeConditions.push(sql`${graphEdges.edgeType} = ANY(${edgeTypes})`);
      }

      // Find edges from/to our top nodes (1-hop traversal)
      const edges = await db
        .select()
        .from(graphEdges)
        .where(and(...edgeConditions))
        .limit(100);

      // Filter to edges connected to our top nodes
      const relevantEdges = edges.filter(
        e => topNodeIds.includes(e.sourceId) || topNodeIds.includes(e.targetId)
      );

      paths = relevantEdges.map(e => ({
        from: e.sourceId,
        edge: e.edgeType,
        to: e.targetId,
        weight: e.weight || 100,
      }));

      // Boost nodes that appear in graph paths
      for (const edge of relevantEdges) {
        const connectedId = topNodeIds.includes(edge.sourceId) ? edge.targetId : edge.sourceId;
        const existing = topNodes.find(n => n.id === connectedId);
        if (existing) {
          existing.score = Math.min(1, existing.score + 0.1); // Graph bonus
          existing.source = "both";
        }
      }
    }

    // Re-sort after graph boost
    topNodes.sort((a, b) => b.score - a.score);

    return {
      nodes: topNodes.slice(0, topK),
      paths,
      totalResults: topNodes.length,
    };
  } catch (err) {
    log.error("Hybrid retrieval failed", { error: String(err) });
    return { nodes: [], paths: [], totalResults: 0 };
  }
}

/**
 * Get the full causal path for a specific task/node.
 * Follows LEADS_TO, CAUSED, PRECEDED edges to build the complete trace.
 */
export async function getTaskTrace(userId: string, nodeId: string, maxDepth: number = 5): Promise<{
  chain: Array<{ nodeId: string; label: string; type: string; edge: string }>;
}> {
  const chain: Array<{ nodeId: string; label: string; type: string; edge: string }> = [];
  const visited = new Set<string>();
  let currentId = nodeId;

  for (let depth = 0; depth < maxDepth; depth++) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    // Get current node
    const nodes = await db.select().from(graphNodes)
      .where(and(eq(graphNodes.id, currentId), eq(graphNodes.userId, userId)))
      .limit(1);

    if (nodes.length === 0) break;

    // Get outgoing edges (LEADS_TO, CAUSED, PRECEDED)
    const edges = await db.select().from(graphEdges)
      .where(and(
        eq(graphEdges.sourceId, currentId),
        eq(graphEdges.userId, userId),
      ))
      .orderBy(desc(graphEdges.weight))
      .limit(1);

    chain.push({
      nodeId: currentId,
      label: nodes[0].label,
      type: nodes[0].nodeType,
      edge: edges[0]?.edgeType || "END",
    });

    if (edges.length === 0) break;
    currentId = edges[0].targetId;
  }

  return { chain };
}
