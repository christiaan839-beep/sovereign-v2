import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "omni-search",
  schema: z.object({
    query: z.string().min(1).max(2000),
    sources: z.array(z.string()).optional().default(["web", "docs"]),
    prompt: z.string().optional(),
  }),
  // Wave 116 M3 batch 11: memory hooks. Per-query search compounding —
  // similar queries surface prior synthesis + best sources so the model
  // builds on or contradicts last time's answer.
  memory: {
    search: {
      query: (input) =>
        `omni-search ${String(input.query ?? "").slice(0, 120)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          answer?: string;
          sources?: Array<{ title?: string }>;
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
      metadata: () => ({ kind: "omni-search" }),
    },
  },
  handler: async ({ input }) => {
    const query = input.query as string;
    const sources = input.sources as string[];
    const key = await getNimKey();

    const res = await outboundFetchAsResponse(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
          messages: [
            {
              role: "system",
              content:
                "You are a research analyst. Provide: 1) Direct answer, 2) Key findings (3-5 bullets), 3) Reasoning, 4) Confidence level. Be specific, no filler.",
            },
            {
              role: "user",
              content: `Research: ${query}\nSources: ${sources.join(", ")}`,
            },
          ],
          max_tokens: 2048,
          temperature: 0.3,
        }),
      },
      {
        ruleId: "agents.omni-search.route.1",
        allowedHosts: ["integrate.api.nvidia.com"],
      },
    );

    if (!res.ok) throw new Error(`NIM returned ${res.status}`);
    const data = await res.json();

    return {
      result: data.choices?.[0]?.message?.content || "",
      query,
      sources,
      model: "nemotron-ultra-253b",
    };
  },
});
