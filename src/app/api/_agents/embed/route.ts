import { createAgentRoute } from "@/lib/agent-factory";

/**
 * FREE EMBEDDINGS — Uses llama-nemotron-embed-1b-v2 from NVIDIA NIM.
 * Replaces OpenAI embeddings entirely. Zero cost.
 */
export const POST = createAgentRoute({
  name: "embed",
  handler: async ({ input }) => {

    const { texts } = input as Record<string, any>;
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return ({ error: "Missing `texts` array." });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    const res = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/llama-nemotron-embed-1b-v2",
        input: texts,
        encoding_format: "float",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return ({ error: `Embedding failed: ${res.status}`, details: errText });
    }

    const data = await res.json();
    return ({
      embeddings: data.data?.map((d: { embedding: number[] }) => d.embedding) || [],
      model: "llama-nemotron-embed-1b-v2",
      usage: data.usage,
    });
  
  },
});

