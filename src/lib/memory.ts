import { Pinecone } from "@pinecone-database/pinecone";
import { embed, ai } from "./ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("memory");

export async function getPineconeClient(apiKey?: string, indexName?: string) {
  const key = apiKey || process.env.PINECONE_API_KEY;
  const index = indexName || process.env.PINECONE_INDEX || "sovereign";
  
  if (!key) return null;
  return { client: new Pinecone({ apiKey: key }), index };
}

/**
 * Anthropic Contextual Retrieval RAG Pipeline.
 * Instead of blindly chunking text, we ask Claude to generate a specific context
 * summary for EACH chunk based on the whole document. We prepend this context
 * to the chunk before embedding, completely obliterating vector hallucinations.
 */
export async function ingestContextualDocument(
  documentTitle: string, 
  fullDocumentText: string,
  pineconeKey?: string,
  pineconeIndex?: string
): Promise<{ success: boolean; chunksProcessed: number }> {
  try {
    const pc = await getPineconeClient(pineconeKey, pineconeIndex);
    if (!pc) throw new Error("Pinecone credentials missing.");

    // Extremely naive chunking for demonstration of Contextual RAG Methodology
    const chunks = fullDocumentText.match(/[\s\S]{1,1000}/g) || [fullDocumentText];
    const index = pc.client.index(pc.index);
    let processed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // THE MAGIC: Anthropic's Contextual Retrieval Generation
      const prompt = `You are an elite data engineer. Look at this entire document:
<document>
${fullDocumentText}
</document>

Now look at this specific chunk from the document:
<chunk>
${chunk}
</chunk>

Generate a concise 2-sentence context summary explaining exactly what this chunk means in the context of the whole document. Output ONLY the summary.`;

      const contextSummary = await ai(prompt, { model: "claude", maxTokens: 150 });
      
      const contextualizedChunk = `[Source: ${documentTitle}]\n[Context: ${contextSummary}]\n\n${chunk}`;
      const vector = await embed(contextualizedChunk);

      await index.upsert({ records: [
        {
          id: `${documentTitle.replace(/\s+/g, "_")}-chunk-${i}-${Date.now()}`,
          values: vector,
          metadata: {
            title: documentTitle,
            text: contextualizedChunk, // We store the prepended chunk
            originalChunk: chunk
          }
        }
      ] });
      processed++;
    }

    return { success: true, chunksProcessed: processed };
  } catch (err) {
    log.error("Contextual RAG Ingestion Failed:", err as Record<string, unknown>);
    return { success: false, chunksProcessed: 0 };
  }
}

/**
 * Legacy Fallback or Direct Key-Value Memory
 */
export async function remember(key: string, value?: string, pineconeKey?: string): Promise<void> {
  const pc = await getPineconeClient(pineconeKey);
  if (!pc) return; // No-op if not configured
  
  const textToEmbed = `${key}: ${value || "triggered"}`;
  const vector = await embed(textToEmbed);
  
  await pc.client.index(pc.index).upsert({ records: [{
    id: `mem-${Date.now()}`,
    values: vector,
    metadata: { text: textToEmbed, type: "short-term", timestamp: Date.now() }
  }] });
}

/**
 * Recall exact contextual nodes matching the query.
 */
/**
 * Alias for remember() — used by MCP tool bridge.
 */
export async function memorize(text: string, namespace?: string): Promise<void> {
  return remember(text, namespace);
}

/**
 * Recall exact contextual nodes matching the query.
 */
export async function recall(query: string, limit: number = 2, pineconeKey?: string): Promise<Array<{ entry: { text: string }; score: number }>> {
  try {
    const pc = await getPineconeClient(pineconeKey);
    if (!pc) return [];

    const queryVector = await embed(query);
    const results = await pc.client.index(pc.index).query({
      vector: queryVector,
      topK: limit,
      includeMetadata: true
    });

    return (results.matches || []).map((m) => ({
      entry: { text: (m.metadata as Record<string, string>)?.text || m.id },
      score: m.score || 0,
    }));
  } catch (e) {
    log.error("Pinecone recall failed:", e as Record<string, unknown>);
    return [];
  }
}
