import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

export const POST = createAgentRoute({
  name: "omni-search",
  schema: z.object({
    query: z.string().min(1).max(2000),
    sources: z.array(z.string()).optional().default(["web", "docs"]),
    prompt: z.string().optional(),
  }),
  handler: async ({ input }) => {
    const query = input.query as string;
    const sources = input.sources as string[];
    const key = await getNimKey();

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        messages: [
          { role: "system", content: "You are a research analyst. Provide: 1) Direct answer, 2) Key findings (3-5 bullets), 3) Reasoning, 4) Confidence level. Be specific, no filler." },
          { role: "user", content: `Research: ${query}\nSources: ${sources.join(", ")}` },
        ],
        max_tokens: 2048, temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`NIM returned ${res.status}`);
    const data = await res.json();

    return { result: data.choices?.[0]?.message?.content || "", query, sources, model: "nemotron-ultra-253b" };
  },
});
