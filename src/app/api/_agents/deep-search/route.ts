import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { deepSearch } from "@/lib/deep-search";

export const POST = createAgentRoute({
  name: "deep-search",
  schema: z.object({
    query: z.string().min(1).max(2000),
    prompt: z.string().optional(),
  }),
  // Wave 116 M3 batch 10: memory hooks. Per-query insight compounding —
  // similar query searches surface prior sources + answer so the model
  // can build on or contradict last time's synthesis.
  memory: {
    search: {
      query: (input) =>
        `deep-search ${String(input.query ?? "").slice(0, 120)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          output?: string;
          sources?: Array<{ title?: string }>;
        };
        if (!r.output) return null;
        const head = r.output.slice(0, 200).replace(/\s+/g, " ");
        const src = (r.sources ?? [])
          .slice(0, 2)
          .map((s) => s.title?.slice(0, 40) ?? "")
          .filter(Boolean)
          .join(" | ");
        return `${head}${src ? ` [sources: ${src}]` : ""}`;
      },
      metadata: () => ({ kind: "deep-search" }),
    },
  },
  handler: async ({ input }) => {
    const result = await deepSearch(input.query as string);
    return {
      output: result.answer,
      sources: result.sources,
      searchQueries: result.searchQueries,
      confidence: result.confidence,
      model: "deep-search",
    };
  },
});
