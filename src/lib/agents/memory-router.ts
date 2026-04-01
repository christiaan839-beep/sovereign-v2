/**
 * Memory Router — queries tenant memory for relevant context
 * before agent execution. Uses the tenant-memory module for
 * keyword-based retrieval from persistent storage.
 */

import { createLogger } from "@/lib/logger";
import { queryMemory, getMemoryContext } from "@/lib/tenant-memory";

const log = createLogger("memory-router");

export async function queryUnifiedVectorSpace(semanticQuery: string, limit: number = 3) {
  log.info("Querying memory for context", { query: semanticQuery.slice(0, 80), limit });

  const results = await queryMemory(semanticQuery, limit);

  return results.map((entry) => ({
    score: 1.0,
    source: entry.agentName || "unknown",
    type: "text",
    extracted_context: typeof entry.output === "string" ? entry.output.slice(0, 500) : JSON.stringify(entry.output).slice(0, 500),
  }));
}

export async function enrichAgentPrompt(basePrompt: string): Promise<string> {
  const memoryContext = await getMemoryContext(basePrompt.split(" ").slice(0, 5).join(" "));

  if (!memoryContext) return basePrompt;

  return `${basePrompt}\n\nRelevant context from previous work:\n${memoryContext}`;
}
