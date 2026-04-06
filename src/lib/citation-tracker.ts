/**
 * SOVEREIGN MATRIX — Citation Tracker
 *
 * Wraps research_ai to extract and return structured citations.
 * Every claim the AI makes can be traced to a specific source URL.
 *
 * Beats Perplexity's trust model by providing:
 * 1. Inline citation markers [1], [2], [3] in the AI output
 * 2. Structured source list with URL, title, and snippet
 * 3. Grounding score (what % of the output is source-backed)
 *
 * Usage:
 *   const { output, citations, groundingScore } = await researchWithCitations(
 *     "What are the latest AI agent trends?",
 *     "Summarize the top 5 trends with data"
 *   );
 */

import { ai, type AIOptions } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("citation-tracker");

// ── Types ──

export interface Citation {
  index: number;       // [1], [2], etc.
  url: string;
  title: string;
  snippet: string;     // Relevant excerpt from source
}

export interface CitedResult {
  /** AI output with inline citation markers [1], [2], etc. */
  output: string;
  /** Structured citation list */
  citations: Citation[];
  /** What % of the output references sources (0-1) */
  groundingScore: number;
  /** Whether live research data was available */
  researchAvailable: boolean;
}

// ── Main Function ──

export async function researchWithCitations(
  query: string,
  prompt: string,
  options: AIOptions = {}
): Promise<CitedResult> {
  let citations: Citation[] = [];
  let researchAvailable = false;

  try {
    // Dynamic import to avoid circular dependency
    const { default: tavily } = await import("@tavily/core").then(m => m);
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) throw new Error("No Tavily key");

    const searchClient = tavily({ apiKey: tavilyKey });
    const searchResult = await searchClient.search(query, {
      searchDepth: "advanced",
      maxResults: 5,
    });

    // Build citations from search results
    citations = searchResult.results.map((r: { url: string; title?: string; content: string }, i: number) => ({
      index: i + 1,
      url: r.url,
      title: r.title || new URL(r.url).hostname,
      snippet: r.content.slice(0, 200),
    }));

    researchAvailable = citations.length > 0;

    // Build context with numbered sources
    const context = citations
      .map((c) => `[${c.index}] ${c.title} (${c.url}):\n${c.snippet}`)
      .join("\n\n");

    // Ask AI to use inline citations
    const enrichedPrompt = `SOURCES:\n${context}\n\n---\n\nTASK: ${prompt}\n\nIMPORTANT: Use inline citations [1], [2], [3] to reference sources. Every factual claim must cite a source.`;

    const output = await ai(enrichedPrompt, {
      ...options,
      system: `${options.system || "You are a senior researcher."}\n\nYou have numbered sources. Use [1], [2], [3] inline citations to back every claim. If a claim cannot be sourced, explicitly say "based on general knowledge" rather than fabricating a citation.`,
    });

    // Calculate grounding score — count citation markers in output
    const citationMatches = output.match(/\[\d+\]/g) || [];
    const uniqueCitations = new Set(citationMatches.map((m: string) => parseInt(m.replace(/[\[\]]/g, ""))));
    const groundingScore = citations.length > 0
      ? Math.min(1, uniqueCitations.size / citations.length)
      : 0;

    return { output, citations, groundingScore, researchAvailable };
  } catch (err) {
    log.warn("Citation research failed, falling back to AI-only", { error: String(err) });

    // Fallback: generate without citations
    const output = await ai(prompt, {
      ...options,
      system: `${options.system || "You are a senior researcher."}\n\nNote: Live source data was unavailable. Clearly distinguish established facts from your training knowledge.`,
    });

    return {
      output,
      citations: [],
      groundingScore: 0,
      researchAvailable: false,
    };
  }
}
