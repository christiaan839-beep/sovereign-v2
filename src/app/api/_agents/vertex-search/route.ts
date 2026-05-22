import { createAgentRoute } from "@/lib/agent-factory";

/**
 * VERTEX AI SEARCH — Enterprise-grade RAG with Google Search quality.
 *
 * Uses Gemini 2.5 Pro with Google Search grounding + structured
 * citation extraction for enterprise knowledge retrieval.
 * Combines web search with uploaded document context.
 *
 * This is the enterprise alternative to basic RAG —
 * Google handles the retrieval, you handle the generation.
 *
 * Input: { query, context?, sources?: "web" | "docs" | "both" }
 * Output: { answer, citations[], searchQueries[], confidence }
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "vertex-search",
  requiredFields: ["query"],
  // Wave 125 M3 batch 16: per-query search compounding. Similar
  // queries surface prior citations + answer — model can build on
  // or contradict last time's synthesis instead of starting cold.
  memory: {
    search: {
      query: (input) =>
        `vertex-search ${input.sources ?? "any"} ${String(input.query ?? "").slice(0, 120)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          answer?: string;
          sources?: Array<{ title?: string; url?: string }>;
        };
        if (!r.answer) return null;
        const head = r.answer.slice(0, 200).replace(/\s+/g, " ");
        const src = (r.sources ?? [])
          .slice(0, 2)
          .map((s) => s.title?.slice(0, 40) ?? "")
          .filter(Boolean)
          .join(" | ");
        return `${head}${src ? ` [${src}]` : ""}`;
      },
      metadata: () => ({ kind: "vertex-search" }),
    },
  },
  handler: async ({ input }) => {
    const query = input.query as string;
    const context = (input.context as string) || "";
    const sources = (input.sources as string) || "web";

    const geminiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { error: "Google AI API key not configured." };
    }

    // Build tools based on source preference
    const tools: Array<Record<string, unknown>> = [];
    if (sources === "web" || sources === "both") {
      tools.push({ google_search: {} });
    }

    const systemPrompt = `You are an enterprise research analyst with access to real-time web data.

Rules:
- Every claim must be supported by a source
- Cite sources inline using [1], [2], etc.
- If you can't find reliable information, say so
- Be specific — use exact numbers, dates, and names from sources
- Structure your response: Summary, Key Findings, Sources

${context ? `\nAdditional context provided by the user:\n${context}` : ""}`;

    const res = await outboundFetchAsResponse(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: query }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 3000,
          },
        }),
      },
      {
        ruleId: "agents.vertex-search.route.1",
        allowedHosts: ["generativelanguage.googleapis.com"],
      },
    );

    if (!res.ok) {
      return {
        error: `Gemini API error (${res.status})`,
        details: await res.text(),
      };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const answer =
      candidate?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "";

    // Extract grounding metadata
    const groundingMeta = candidate?.groundingMetadata;
    const citations =
      groundingMeta?.groundingChunks?.map(
        (chunk: { web?: { uri: string; title: string } }, i: number) => ({
          index: i + 1,
          url: chunk.web?.uri || "",
          title: chunk.web?.title || "",
        }),
      ) || [];

    const searchQueries = groundingMeta?.webSearchQueries || [];

    // Calculate confidence based on grounding
    const confidence =
      citations.length > 3
        ? 0.95
        : citations.length > 1
          ? 0.85
          : citations.length === 1
            ? 0.7
            : 0.5;

    return {
      answer,
      citations,
      searchQueries,
      confidence,
      grounded: citations.length > 0,
      totalSources: citations.length,
      model: "gemini-2.5-pro",
      feature: "vertex-ai-search",
    };
  },
});
