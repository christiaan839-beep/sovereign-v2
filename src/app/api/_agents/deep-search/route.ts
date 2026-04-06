import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { deepSearch } from "@/lib/deep-search";

export const POST = createAgentRoute({
  name: "deep-search",
  schema: z.object({ query: z.string().min(1).max(2000), prompt: z.string().optional() }),
  handler: async ({ input }) => {
    const result = await deepSearch(input.query as string);
    return { output: result.answer, sources: result.sources, searchQueries: result.searchQueries, confidence: result.confidence, model: "deep-search" };
  },
});
