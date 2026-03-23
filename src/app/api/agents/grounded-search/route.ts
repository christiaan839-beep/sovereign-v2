import { createAgentRoute } from "@/lib/agent-factory";

/**
 * GEMINI GROUNDED SEARCH — Real-time web-grounded AI responses.
 *
 * Uses Gemini 2.5 Pro with Google Search grounding to provide
 * factual, up-to-date answers with citations. No hallucinations.
 *
 * Your Google AI Ultra plan gives you grounding at no extra cost.
 *
 * Input: { query, context? }
 * Output: { answer, sources[], groundingMetadata }
 */

export const POST = createAgentRoute({
  name: "grounded-search",
  requiredFields: ["query"],
  handler: async ({ input }) => {
    const query = input.query as string;
    const context = (input.context as string) || "";

    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { error: "Google AI API key not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to your environment." };
    }

    // Call Gemini 2.5 Pro with Google Search grounding enabled
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: context ? `Context: ${context}\n\nQuery: ${query}` : query }],
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
              googleSearch: {},
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return { error: `Gemini API error (${res.status})`, details: errorText };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const answer = candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";

    // Extract grounding metadata (search queries, sources, citations)
    const groundingMeta = candidate?.groundingMetadata;
    const sources = groundingMeta?.groundingChunks?.map((chunk: { web?: { uri: string; title: string } }) => ({
      url: chunk.web?.uri || "",
      title: chunk.web?.title || "",
    })) || [];

    const searchQueries = groundingMeta?.webSearchQueries || [];

    return {
      answer,
      sources,
      searchQueries,
      grounded: sources.length > 0,
      model: "gemini-2.5-pro",
      feature: "google-search-grounding",
    };
  },
});
