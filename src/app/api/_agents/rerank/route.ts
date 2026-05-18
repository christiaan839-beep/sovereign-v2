import { createAgentRoute } from "@/lib/agent-factory";

/**
 * RERANK — Uses llama-nemotron-rerank-1b-v2 to re-score search results.
 * Makes RAG retrieval dramatically more accurate by re-ordering by relevance.
 */
export const POST = createAgentRoute({
  name: "rerank",
  handler: async ({ input, email, userId }) => {

    const { query, documents } = input as Record<string, unknown>;
    if (!query || !documents || !Array.isArray(documents)) {
      return ({ error: "Missing `query` (string) and `documents` (string[])." });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    const res = await fetch("https://integrate.api.nvidia.com/v1/ranking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/llama-nemotron-rerank-1b-v2",
        query: { text: query },
        passages: documents.map((d: string) => ({ text: d })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return ({ error: `Rerank failed: ${res.status}`, details: errText });
    }

    const data = await res.json();
    return ({
      rankings: data.rankings || [],
      model: "llama-nemotron-rerank-1b-v2",
    });
  
  },
});

