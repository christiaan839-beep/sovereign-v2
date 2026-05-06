import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";

/**
 * RAG PIPELINE — Full Retrieval-Augmented Generation using NVIDIA NIM.
 * Combines: embed → search → rerank → generate.
 * This is the NVIDIA NeMo Retriever Blueprint implemented as a single endpoint.
 */
export const POST = createAgentRoute({
  name: "rag-pipeline",
  handler: async ({ input }) => {

    const { query, documents = [], topK = 3 } = input as Record<string, any>;
    if (!query) return ({ error: "Missing `query`." });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    // Step 1: Embed the query
    const embedRes = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({ model: "nvidia/llama-nemotron-embed-1b-v2", input: [query], encoding_format: "float" }),
    });
    const embedData = embedRes.ok ? await embedRes.json() : null;
    const queryEmbedding = embedData?.data?.[0]?.embedding || [];

    // Step 2: If documents provided, embed them and compute similarity
    let rankedDocs = documents;
    if (documents.length > 0) {
      // Use reranker for better results
      const rerankRes = await fetch("https://integrate.api.nvidia.com/v1/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
        body: JSON.stringify({
          model: "nvidia/llama-nemotron-rerank-1b-v2",
          query: { text: query },
          passages: documents.map((d: string) => ({ text: d })),
        }),
      });
      
      if (rerankRes.ok) {
        const rerankData = await rerankRes.json();
        rankedDocs = (rerankData.rankings || [])
          .sort((a: { logit: number }, b: { logit: number }) => b.logit - a.logit)
          .slice(0, topK)
          .map((r: { index: number }) => documents[r.index]);
      }
    }

    // Step 3: Generate answer using top documents as context
    const context = rankedDocs.length > 0 
      ? `\n\nContext from retrieved documents:\n${rankedDocs.map((d: string, i: number) => `[${i+1}] ${d}`).join("\n")}`
      : "";

    const genRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [
          { role: "system", content: `You are a precise knowledge retrieval assistant. Answer ONLY based on the provided context. If the context doesn't contain the answer, say so.${context}` },
          { role: "user", content: query },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
    const genData = genRes.ok ? await genRes.json() : { choices: [{ message: { content: "Generation failed." } }] };

    return ({
      answer: genData.choices?.[0]?.message?.content || "",
      sources: rankedDocs.slice(0, topK),
      queryEmbedding: queryEmbedding.slice(0, 5), // First 5 dims as preview
      models: { embed: "llama-nemotron-embed-1b-v2", rerank: "llama-nemotron-rerank-1b-v2", generate: "nemotron-3-super-120b" },
    });
  
  },
});

