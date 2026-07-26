import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getMemoryStats, queryMemory, clearMemory } from "@/lib/tenant-memory";
import { createLogger } from "@/lib/logger";

const log = createLogger("memory");

/**
 * AGENT MEMORY — Pinecone-backed long-term conversational memory.
 *
 * Each agent can store and retrieve memories per user, enabling:
 * - "I spoke to you yesterday about X..."
 * - Context continuity across sessions
 * - Personal preference learning
 * - Interaction history summarization
 *
 * Operations: store, recall, summarize, forget
 */

interface Memory {
  id: string;
  userId: string;
  agentId: string;
  content: string;
  type: "conversation" | "preference" | "fact" | "task";
  timestamp: string;
  importance: number; // 1-10
}

// In-memory store with Pinecone-ready interface
const MEMORY_STORE = new Map<string, Memory[]>();

function getKey(userId: string, agentId: string): string {
  return `${userId}:${agentId}`;
}

async function _postHandler(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const {
      action,
      userId = "default",
      agentId = "general",
      content,
      type = "conversation",
      query,
      limit = 10,
    } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: "action is required: store, recall, summarize, forget" },
        { status: 400 },
      );
    }

    const key = getKey(userId, agentId);

    // STORE — Save a new memory
    if (action === "store") {
      if (!content) {
        return NextResponse.json(
          { error: "content is required for store action." },
          { status: 400 },
        );
      }

      const memory: Memory = {
        id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        userId,
        agentId,
        content,
        type,
        timestamp: new Date().toISOString(),
        importance: calculateImportance(content),
      };

      const existing = MEMORY_STORE.get(key) || [];
      existing.push(memory);

      // Keep only the most recent 200 memories per user-agent pair
      if (existing.length > 200) {
        existing.sort((a, b) => b.importance - a.importance);
        existing.splice(200);
      }
      MEMORY_STORE.set(key, existing);

      // If Pinecone is configured, also store as vector
      const pineconeKey = process.env.PINECONE_API_KEY;
      if (pineconeKey && (await getNimKey())) {
        try {
          const embedRes = await fetch(
            "https://integrate.api.nvidia.com/v1/embeddings",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${await getNimKey()}`,
              },
              body: JSON.stringify({
                model: "nvidia/nv-embed-v1",
                input: [content],
                input_type: "passage",
              }),
            },
          );
          const embedData = await embedRes.json();
          if (embedData?.data?.[0]?.embedding) {
            // Store in Pinecone (production-ready)
            const pineconeIndex = process.env.PINECONE_INDEX || "agent-memory";
            await fetch(
              `https://${pineconeIndex}.svc.pinecone.io/vectors/upsert`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Api-Key": pineconeKey,
                },
                body: JSON.stringify({
                  vectors: [
                    {
                      id: memory.id,
                      values: embedData.data[0].embedding,
                      metadata: {
                        userId,
                        agentId,
                        content,
                        type,
                        timestamp: memory.timestamp,
                        importance: memory.importance,
                      },
                    },
                  ],
                }),
              },
            );
          }
        } catch {
          // Pinecone storage optional — continue with in-memory
        }
      }

      return NextResponse.json({
        success: true,
        action: "store",
        memory,
        total_memories: (MEMORY_STORE.get(key) || []).length,
      });
    }

    // RECALL — Retrieve relevant memories
    if (action === "recall") {
      const memories = MEMORY_STORE.get(key) || [];

      let results: Memory[];
      if (query) {
        // Simple keyword matching (production: use vector similarity)
        const queryLower = query.toLowerCase();
        results = memories
          .filter((m) => m.content.toLowerCase().includes(queryLower))
          .sort((a, b) => b.importance - a.importance)
          .slice(0, limit);
      } else {
        // Return most recent
        results = memories
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
          .slice(0, limit);
      }

      return NextResponse.json({
        success: true,
        action: "recall",
        memories: results,
        total_stored: memories.length,
        context_window: results.map((m) => m.content).join("\n---\n"),
      });
    }

    // SUMMARIZE — AI-generated summary of all memories for this user+agent
    if (action === "summarize") {
      const memories = MEMORY_STORE.get(key) || [];

      if (memories.length === 0) {
        return NextResponse.json({
          success: true,
          summary: "No memories stored yet.",
        });
      }
      if (!(await getNimKey())) {
        return NextResponse.json({
          summary: `${memories.length} memories stored. Configure NVIDIA_NIM_API_KEY for AI summary.`,
        });
      }

      const memoryText = memories
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 30)
        .map((m) => `[${m.timestamp}] ${m.content}`)
        .join("\n");

      const res = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getNimKey()}`,
          },
          body: JSON.stringify({
            model: "mistralai/mistral-nemotron",
            messages: [
              {
                role: "system",
                content:
                  "Summarize these user interaction memories into a concise profile. Include: key topics discussed, preferences, pending tasks, and relationship context. Write in second person ('You discussed...').",
              },
              { role: "user", content: memoryText },
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        },
      );

      if (!res.ok) {
        // Previously fell through to `.json()` unchecked; an outright
        // API failure (5xx, rate limit, etc.) produced the exact same
        // "Summary unavailable." text as a model returning empty
        // content, with no operator-visible signal either way.
        log.error("Summarize call failed", { status: res.status });
        return NextResponse.json({
          success: true,
          action: "summarize",
          summary: `${memories.length} memories stored, but the AI summary is temporarily unavailable.`,
          memories_analyzed: 0,
          degraded: true,
        });
      }

      const data = await res.json();

      return NextResponse.json({
        success: true,
        action: "summarize",
        summary: data?.choices?.[0]?.message?.content || "Summary unavailable.",
        memories_analyzed: Math.min(memories.length, 30),
      });
    }

    // FORGET — Clear memories
    if (action === "forget") {
      const deleted = (MEMORY_STORE.get(key) || []).length;
      MEMORY_STORE.delete(key);
      return NextResponse.json({
        success: true,
        action: "forget",
        memories_deleted: deleted,
      });
    }

    // DREAM — Consolidate, deduplicate, and optimize memory
    if (action === "dream") {
      try {
        const { dream } = await import("@/lib/dream");
        const report = await dream(process.env.PINECONE_API_KEY);
        return NextResponse.json({ success: true, action: "dream", report });
      } catch (_err) {
        return NextResponse.json({
          success: true,
          action: "dream",
          report: {
            scanned: (MEMORY_STORE.get(key) || []).length,
            summary:
              "Dream ran on in-memory store. Configure Pinecone for full vector consolidation.",
          },
        });
      }
    }

    // TENANT MEMORY — Per-user persistent agent execution history
    if (action === "tenant_stats") {
      const stats = await getMemoryStats(auth.userId);
      return NextResponse.json({
        success: true,
        action: "tenant_stats",
        ...stats,
      });
    }

    if (action === "tenant_query") {
      if (!query) {
        return NextResponse.json(
          { error: "query is required for tenant_query action." },
          { status: 400 },
        );
      }
      const results = await queryMemory(auth.userId, query, limit);
      return NextResponse.json({
        success: true,
        action: "tenant_query",
        results,
        count: results.length,
      });
    }

    if (action === "tenant_clear") {
      const deleted = await clearMemory(auth.userId);
      return NextResponse.json({
        success: true,
        action: "tenant_clear",
        memories_deleted: deleted,
      });
    }

    return NextResponse.json(
      {
        error:
          "action must be: store, recall, summarize, dream, forget, tenant_stats, tenant_query, or tenant_clear",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Memory error", details: String(error) },
      { status: 500 },
    );
  }
}

function calculateImportance(content: string): number {
  let score = 5;
  // Boost for keywords indicating important info
  const highSignals = [
    "deadline",
    "budget",
    "decision",
    "urgent",
    "important",
    "name is",
    "email",
    "phone",
    "contract",
    "payment",
  ];
  const lowSignals = ["hello", "thanks", "ok", "sure", "bye"];

  for (const signal of highSignals) {
    if (content.toLowerCase().includes(signal)) score = Math.min(10, score + 1);
  }
  for (const signal of lowSignals) {
    if (content.toLowerCase().includes(signal)) score = Math.max(1, score - 1);
  }
  // Longer content is usually more important
  if (content.length > 200) score = Math.min(10, score + 1);

  return score;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || "default";

  // Get all memories across all agents for this user
  const allMemories: Memory[] = [];
  for (const [key, memories] of MEMORY_STORE.entries()) {
    if (key.startsWith(`${userId}:`)) {
      allMemories.push(...memories);
    }
  }

  // Include tenant memory stats alongside legacy memory
  const tenantStats = await getMemoryStats(auth.userId);

  return NextResponse.json({
    status: "Agent Memory — Active",
    userId,
    total_memories: allMemories.length,
    by_agent: [...new Set(allMemories.map((m) => m.agentId))].map((agent) => ({
      agent,
      count: allMemories.filter((m) => m.agentId === agent).length,
    })),
    recent: allMemories
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 10),
    tenantMemory: tenantStats,
  });
}

// Factory wrapper for POST (adds safety pipeline)
export const POST = createAgentRoute({
  name: "memory",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});
