import { auth } from "@clerk/nextjs/server";
import { researchWithCitations } from "@/lib/citation-tracker";
import { createLogger } from "@/lib/logger";

const log = createLogger("research-stream");

/**
 * STREAMING RESEARCH — Real-time research with live source citations.
 *
 * Beats Perplexity by combining:
 * 1. Tavily real-time web search
 * 2. Citation tracking with source URLs
 * 3. Knowledge graph memory (remembers past research)
 * 4. SSE streaming for word-by-word output
 *
 * POST { query: "What are the latest AI agent trends?" }
 * → Streams: sources found → research in progress → cited output
 */

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Auth required", { status: 401 });

  const { query, systemPrompt } = await req.json();
  if (!query?.trim()) return new Response("Query required", { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Signal that research is starting
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "status", text: "Searching the web..." })}\n\n`));

        // Step 2: Run research with citations
        const result = await researchWithCitations(query, query, {
          system: systemPrompt || "You are a senior researcher. Provide comprehensive, well-cited analysis.",
          maxTokens: 2500,
        });

        // Step 3: Send sources first (so UI can show them immediately)
        if (result.citations.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "sources",
            citations: result.citations,
            groundingScore: result.groundingScore,
          })}\n\n`));
        }

        // Step 4: Stream the output word by word
        const words = result.output.split(/(\s+)/);
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join("");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`));
          // Small delay for streaming effect
          await new Promise(r => setTimeout(r, 10));
        }

        // Step 5: Send completion with metadata
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "done",
          groundingScore: result.groundingScore,
          citationCount: result.citations.length,
          researchAvailable: result.researchAvailable,
        })}\n\n`));

        // Step 6: Auto-learn — store research in knowledge graph
        try {
          const { extractRelationships } = await import("@/lib/graph/relationship-extractor");
          const { triples } = await extractRelationships(result.output.slice(0, 2000));
          if (triples.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "learned",
              triplesExtracted: triples.length,
            })}\n\n`));
          }
        } catch { /* graph learning is optional */ }

        controller.close();
      } catch (err) {
        log.error("Research stream error", { error: String(err) });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
