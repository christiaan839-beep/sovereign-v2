import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { graphNodes, graphEdges } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { extractRelationships } from "@/lib/graph/relationship-extractor";
import { hybridQuery, getTaskTrace } from "@/lib/graph/hybrid-retriever";
import { createLogger } from "@/lib/logger";

const log = createLogger("graph-memory-api");

/**
 * GRAPH MEMORY API
 *
 * POST /api/_misc/memory/graph — Store relationship or extract from text
 * GET  /api/_misc/memory/graph — Query the knowledge graph
 */

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // Action: store — directly store a triple
    if (action === "store") {
      const { subject, predicate, object: obj, confidence = 100 } = body;

      // Create or find source node
      const [sourceNode] = await db.insert(graphNodes).values({
        userId,
        nodeType: subject.type || "concept",
        label: subject.label,
        properties: JSON.stringify(subject.properties || {}),
        confidence,
      }).returning();

      // Create or find target node
      const [targetNode] = await db.insert(graphNodes).values({
        userId,
        nodeType: obj.type || "concept",
        label: obj.label,
        properties: JSON.stringify(obj.properties || {}),
        confidence,
      }).returning();

      // Create edge
      const [edge] = await db.insert(graphEdges).values({
        userId,
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        edgeType: predicate,
        confidence,
        weight: 100,
      }).returning();

      return NextResponse.json({
        stored: true,
        sourceNode: sourceNode.id,
        targetNode: targetNode.id,
        edge: edge.id,
      });
    }

    // Action: extract — extract relationships from text
    if (action === "extract") {
      const { text } = body;
      if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

      const result = await extractRelationships(text);

      // Store extracted triples
      let stored = 0;
      for (const triple of result.triples) {
        try {
          const [src] = await db.insert(graphNodes).values({
            userId,
            nodeType: triple.subject.type,
            label: triple.subject.label,
            properties: "{}",
            confidence: triple.confidence,
          }).returning();

          const [tgt] = await db.insert(graphNodes).values({
            userId,
            nodeType: triple.object.type,
            label: triple.object.label,
            properties: "{}",
            confidence: triple.confidence,
          }).returning();

          await db.insert(graphEdges).values({
            userId,
            sourceId: src.id,
            targetId: tgt.id,
            edgeType: triple.predicate,
            confidence: triple.confidence,
            weight: 100,
          });

          stored++;
        } catch (err) {
          log.warn("Failed to store triple", { error: String(err) });
        }
      }

      return NextResponse.json({
        extracted: result.triples.length,
        stored,
        summary: result.summary,
        triples: result.triples,
      });
    }

    // Action: query — hybrid search
    if (action === "query") {
      const { query, nodeTypes, edgeTypes, topK, maxAgeDays } = body;
      if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

      const results = await hybridQuery({
        userId,
        query,
        nodeTypes,
        edgeTypes,
        topK,
        maxAgeDays,
      });

      return NextResponse.json(results);
    }

    // Action: trace — get causal path for a task
    if (action === "trace") {
      const { nodeId } = body;
      if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });

      const trace = await getTaskTrace(userId, nodeId);
      return NextResponse.json(trace);
    }

    return NextResponse.json({ error: "action must be store, extract, query, or trace" }, { status: 400 });
  } catch (err) {
    log.error("Graph memory error", { error: String(err) });
    return NextResponse.json({ error: "Graph memory operation failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const nodeType = url.searchParams.get("type");

    if (!query) {
      // Return graph stats
      const nodeCount = await db.select({ count: sql`count(*)::int` }).from(graphNodes).where(eq(graphNodes.userId, userId));
      const edgeCount = await db.select({ count: sql`count(*)::int` }).from(graphEdges).where(eq(graphEdges.userId, userId));

      return NextResponse.json({
        nodes: nodeCount[0]?.count || 0,
        edges: edgeCount[0]?.count || 0,
      });
    }

    const results = await hybridQuery({
      userId,
      query,
      nodeTypes: nodeType ? [nodeType] : undefined,
      topK: 10,
    });

    return NextResponse.json(results);
  } catch (err) {
    log.error("Graph memory GET error", { error: String(err) });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

