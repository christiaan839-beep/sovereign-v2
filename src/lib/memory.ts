import { Pinecone } from "@pinecone-database/pinecone";
import { embed, ai } from "./ai";
import { createLogger } from "@/lib/logger";
import { scanMemoryWrite } from "@/lib/memory/payload-guard";
import { auditLog } from "@/lib/audit-log";

const log = createLogger("memory");

/**
 * Move 18 — R145 memory payload guard gate.
 *
 * Each memory-write surface (ingestContextualDocument, remember,
 * memorize) calls this helper BEFORE embedding + upserting. If the
 * scanner detects an embedded-instruction payload, the write is
 * refused, the R26 audit chain receives `agent.memory_payload_blocked`,
 * and the caller gets `false` so it can fail-soft.
 *
 * Default-OFF posture: when SOVEREIGN_MEMORY_PAYLOAD_GUARD_ENABLED is
 * not set to "true", scanMemoryWrite returns ok:true with reason
 * "guard_disabled" — every legacy caller is byte-identical.
 *
 * Fail-OPEN on scanner exceptions: a bug in the scanner MUST NOT
 * block legitimate memory writes (defense-in-depth, not the primary
 * defense).
 */
async function gateMemoryWrite(
  agentName: string,
  content: string,
  storeId?: string,
): Promise<boolean> {
  try {
    const verdict = scanMemoryWrite({ agentName, content, storeId });
    if (verdict.ok) return true;
    // Blocked. Audit + log + refuse the write.
    auditLog({
      userId: "system-memory",
      action: verdict.auditEntry.action,
      resource: verdict.auditEntry.resource,
      details: verdict.auditEntry.details,
    }).catch(() => {});
    log.warn("memory write refused by R145 payload guard", {
      contentHash: verdict.contentHash,
      summary: verdict.result.summary,
    });
    return false;
  } catch (err) {
    // Fail-OPEN on scanner exception. Never block on the scanner's
    // own failure. The audit chain captures the gap.
    log.error("memory payload-guard scanner threw; failing OPEN", err as Record<string, unknown>);
    return true;
  }
}

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
  pineconeIndex?: string,
  agentName: string = "anonymous-memory-write",
): Promise<{ success: boolean; chunksProcessed: number; refused?: boolean }> {
  try {
    // R145 payload guard at ingest. Scan the full document BEFORE
    // chunking + embedding — a single embedded-instruction payload
    // anywhere in the doc would propagate across every chunk.
    const allowed = await gateMemoryWrite(agentName, fullDocumentText, pineconeIndex);
    if (!allowed) {
      return { success: false, chunksProcessed: 0, refused: true };
    }

    const pc = await getPineconeClient(pineconeKey, pineconeIndex);
    if (!pc) throw new Error("Pinecone credentials missing.");

    // Extremely naive chunking for demonstration of Contextual RAG Methodology
    const chunks = fullDocumentText.match(/[\s\S]{1,1000}/g) || [fullDocumentText];
    const index = pc.client.index(pc.index);
    let processed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // THE MAGIC: Anthropic's Contextual Retrieval Generation
      const prompt = `You are a senior data engineer. Look at this entire document:
<document>
${fullDocumentText}
</document>

Now look at this specific chunk from the document:
<chunk>
${chunk}
</chunk>

Generate a concise 2-sentence context summary explaining exactly what this chunk means in the context of the whole document. Output ONLY the summary.`;

      // Use Cerebras for per-chunk summaries: 2000+ tok/s, sub-$0.01/1K tokens.
      // Claude is 60× more expensive for 2-sentence outputs that don't need its reasoning depth.
      const contextSummary = await ai(prompt, { model: "cerebras", maxTokens: 150 });
      
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
export async function remember(
  key: string,
  value?: string,
  pineconeKey?: string,
  agentName: string = "anonymous-memory-write",
): Promise<void> {
  const pc = await getPineconeClient(pineconeKey);
  if (!pc) return; // No-op if not configured

  const textToEmbed = `${key}: ${value || "triggered"}`;

  // R145 payload guard. If blocked, fire audit + skip the upsert.
  const allowed = await gateMemoryWrite(agentName, textToEmbed);
  if (!allowed) return;

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
export async function memorize(
  text: string,
  namespace?: string,
  agentName: string = "anonymous-memory-write",
): Promise<void> {
  // remember() applies R145 gate; memorize is just an alias.
  return remember(text, namespace, undefined, agentName);
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
