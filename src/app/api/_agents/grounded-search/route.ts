import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";

/**
 * GEMINI GROUNDED SEARCH — Real-time web-grounded AI responses.
 *
 * Uses Gemini 2.5 Pro with Google Search grounding to provide
 * factual, up-to-date answers with citations. No hallucinations.
 *
 * Your Google AI Ultra plan gives you grounding at no extra cost.
 *
 * Input: { query, context?, deep? }
 * Output: { answer, sources[], groundingMetadata }
 *
 * When deep=true, runs a Perplexity-style multi-step search:
 *   1. Decompose query into 2-3 sub-questions (via Groq for speed)
 *   2. Run grounded search for each sub-question in parallel
 *   3. Synthesize all results into a comprehensive answer with inline citations
 */

interface GeminiSource {
  url: string;
  title: string;
}

interface GeminiSearchResult {
  answer: string;
  sources: GeminiSource[];
  searchQueries: string[];
}

/** Run a single Gemini grounded search for one query */
async function geminiGroundedSearch(
  query: string,
  context: string,
  geminiKey: string,
): Promise<GeminiSearchResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: context
                  ? `Context: ${context}\n\nQuery: ${query}`
                  : query,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [
            {
              text: "You are a research analyst. Answer with facts, data, and citations. Be direct — no filler. Use the grounded search results to provide accurate, current information. Structure your response with clear sections.",
            },
          ],
        },
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
        },
      }),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const answer =
    candidate?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("") || "";

  const groundingMeta = candidate?.groundingMetadata;
  const sources: GeminiSource[] =
    groundingMeta?.groundingChunks?.map(
      (chunk: { web?: { uri: string; title: string } }) => ({
        url: chunk.web?.uri || "",
        title: chunk.web?.title || "",
      }),
    ) || [];

  const searchQueries: string[] = groundingMeta?.webSearchQueries || [];

  return { answer, sources, searchQueries };
}

export const POST = createAgentRoute({
  name: "grounded-search",
  requiredFields: ["query"],
  handler: async ({ input }) => {
    const query = input.query as string;
    const context = (input.context as string) || "";
    const deep = input.deep === true;

    const geminiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        error:
          "Google AI API key not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to your environment.",
      };
    }

    // ─── Standard (shallow) search ───
    if (!deep) {
      try {
        const result = await geminiGroundedSearch(query, context, geminiKey);
        return {
          answer: result.answer,
          sources: result.sources,
          searchQueries: result.searchQueries,
          grounded: result.sources.length > 0,
          model: "gemini-2.5-pro",
          feature: "google-search-grounding",
        };
      } catch (err) {
        return { error: String(err) };
      }
    }

    // ─── Deep Search (Perplexity-style) ───

    // Step 1: Decompose query into sub-questions using Groq (fast)
    let subQuestions: string[];
    try {
      const decomposition = await ai(
        `Break this research query into 2-3 focused, specific sub-questions that together comprehensively answer the original query. Return ONLY a JSON array of strings, no other text.\n\nQuery: "${query}"`,
        {
          model: "groq",
          system:
            "You are a research decomposition engine. Output only valid JSON arrays of strings. Each sub-question should target a different aspect of the query.",
          maxTokens: 500,
        },
      );

      // Parse the JSON array from the response
      const jsonMatch = decomposition.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        subQuestions = JSON.parse(jsonMatch[0]) as string[];
      } else {
        // Fallback: use the original query
        subQuestions = [query];
      }

      // Clamp to 3 sub-questions max
      subQuestions = subQuestions.slice(0, 3);
    } catch {
      // If decomposition fails, just search the original query
      subQuestions = [query];
    }

    // Step 2: Run grounded search for each sub-question in parallel
    const searchResults = await Promise.all(
      subQuestions.map((subQ) =>
        geminiGroundedSearch(subQ, context, geminiKey).catch(() => ({
          answer: "",
          sources: [] as GeminiSource[],
          searchQueries: [] as string[],
        })),
      ),
    );

    // Collect all sources and deduplicate by URL
    const allSourcesMap = new Map<string, GeminiSource>();
    const allSearchQueries: string[] = [];

    for (const result of searchResults) {
      for (const source of result.sources) {
        if (source.url && !allSourcesMap.has(source.url)) {
          allSourcesMap.set(source.url, source);
        }
      }
      allSearchQueries.push(...result.searchQueries);
    }

    const allSources = Array.from(allSourcesMap.values());

    // Build numbered source reference for the synthesis prompt
    const sourceReference = allSources
      .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`)
      .join("\n");

    // Build sub-answer context
    const subAnswerContext = searchResults
      .map(
        (r, i) =>
          `--- Sub-question ${i + 1}: "${subQuestions[i]}" ---\n${r.answer}`,
      )
      .join("\n\n");

    // Step 3: Synthesize all results into a comprehensive answer.
    // Wave-108.5 cost fix: synthesis is NIM nemotron-ultra's wheelhouse
    // (long-context multi-source consolidation). Free vs Gemini Flash's
    // ~$0.075/M tokens — saves ~$40-80/mo at audited node-plan volume.
    // Gemini preserved as fallback so the deep-search path stays
    // resilient if NIM rate-limits.
    let synthesized: string;
    try {
      synthesized = await ai(
        `You have been given multiple research findings from different sub-questions about the user's query. Synthesize them into a single, comprehensive, well-structured answer.\n\nOriginal query: "${query}"\n\n${subAnswerContext}\n\nAvailable sources for citation:\n${sourceReference}\n\nInstructions:\n- Combine all findings into one cohesive response\n- Use inline citations like [1], [2], [3] referencing the numbered sources\n- End with a "Sources:" section listing all cited sources\n- Be direct and factual — no filler`,
        {
          model: "nim",
          system:
            "You are a senior research synthesizer. Produce comprehensive, well-cited answers from multiple research threads. Use inline citations [1], [2], etc. and always include a Sources section at the end.",
          maxTokens: 3000,
        },
      );
    } catch {
      synthesized = await ai(
        `You have been given multiple research findings from different sub-questions about the user's query. Synthesize them into a single, comprehensive, well-structured answer.\n\nOriginal query: "${query}"\n\n${subAnswerContext}\n\nAvailable sources for citation:\n${sourceReference}\n\nInstructions:\n- Combine all findings into one cohesive response\n- Use inline citations like [1], [2], [3] referencing the numbered sources\n- End with a "Sources:" section listing all cited sources\n- Be direct and factual — no filler`,
        {
          model: "gemini",
          system:
            "You are a senior research synthesizer. Produce comprehensive, well-cited answers from multiple research threads. Use inline citations [1], [2], etc. and always include a Sources section at the end.",
          maxTokens: 3000,
        },
      );
    }

    return {
      answer: synthesized,
      sources: allSources,
      searchQueries: allSearchQueries,
      subQuestions,
      grounded: allSources.length > 0,
      deep: true,
      model: "gemini-2.5-pro",
      feature: "deep-search",
    };
  },
});
