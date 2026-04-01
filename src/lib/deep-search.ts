import { tavily } from "@tavily/core";
import { ai } from "./ai";
import { createLogger } from "./logger";

const log = createLogger("deep-search");

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface DeepSearchResult {
  answer: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
  searchQueries: string[];
  confidence: number;
}

/**
 * Deep Search — Multi-query, multi-source research engine.
 *
 * Unlike basic search (1 query -> 5 results -> summarize),
 * Deep Search:
 * 1. Decomposes the question into 3 sub-queries
 * 2. Runs all 3 searches in parallel
 * 3. Deduplicates and ranks results
 * 4. Synthesizes a grounded answer with source citations
 *
 * This approaches Perplexity-level quality.
 */
export async function deepSearch(question: string): Promise<DeepSearchResult> {
  const tavilyKey = process.env.TAVILY_API_KEY || "tvly-demo";
  const searchClient = tavily({ apiKey: tavilyKey });

  // Step 1: Decompose into sub-queries
  let queries: string[];
  try {
    const decomposition = await ai(
      `Break this question into 3 specific search queries that together would fully answer it. Return ONLY a JSON array of 3 strings, nothing else.\n\nQuestion: ${question}`,
      { system: "Return only a JSON array of 3 search query strings. No explanation.", maxTokens: 200 }
    );

    const parsed = JSON.parse(decomposition.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    queries = Array.isArray(parsed) ? parsed : [question];
  } catch {
    log.warn("Query decomposition failed, using fallback queries");
    queries = [question, `${question} latest 2026`, `${question} comparison`];
  }

  // Step 2: Search all queries in parallel
  const searchPromises = queries.map(q =>
    searchClient.search(q, { searchDepth: "advanced", maxResults: 5 }).catch((err) => {
      log.warn("Search query failed", { query: q, error: (err as Error).message });
      return { results: [] };
    })
  );
  const searchResults = await Promise.all(searchPromises);

  // Step 3: Deduplicate and rank
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  for (const result of searchResults) {
    for (const r of (result.results || [])) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allResults.push({ title: r.title, url: r.url, content: r.content, score: r.score || 0.5 });
      }
    }
  }
  allResults.sort((a, b) => b.score - a.score);
  const topResults = allResults.slice(0, 10);

  // Step 4: Synthesize grounded answer
  const context = topResults.map((r, i) => `[Source ${i + 1}] ${r.title} (${r.url}):\n${r.content}`).join("\n\n---\n\n");

  const answer = await ai(
    `Based on these search results, answer the question comprehensively.\n\nQuestion: ${question}\n\n${context}\n\nProvide a clear, well-structured answer. Cite sources using [Source N] notation. If sources conflict, note the disagreement.`,
    { system: "You are a research analyst. Provide accurate, well-sourced answers. Always cite which source number supports each claim. Be concise but thorough.", maxTokens: 2000 }
  );

  log.info("Deep search completed", { queries: queries.length, results: allResults.length, topResults: topResults.length });

  return {
    answer,
    sources: topResults.slice(0, 5).map(r => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 200) })),
    searchQueries: queries,
    confidence: topResults.length > 5 ? 0.9 : topResults.length > 2 ? 0.7 : 0.4,
  };
}
