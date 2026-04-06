import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { nimChat } from "@/lib/nvidia";

/**
 * DOCUMENT ANALYST — 262K context for ingesting entire documents.
 */
const MODE_PROMPTS: Record<string, string> = {
  qa: "Answer the following question based ONLY on the document. Cite relevant sections.",
  extract: "Extract ALL key data points: names, dates, amounts, deadlines. Format as JSON.",
  summarize: "Create an executive summary: purpose, parties, terms, dates, actions. Max 500 words.",
  risks: "Identify ALL risks and liabilities. Rate each LOW/MEDIUM/HIGH/CRITICAL.",
  compare: "Analyze strengths, weaknesses, unusual clauses, and deviations from standard practice.",
};

export const POST = createAgentRoute({
  name: "doc-analyst",
  schema: z.object({
    document: z.string().min(50).max(500_000),
    question: z.string().max(2000).optional().default("Summarize and highlight the 5 most important points."),
    mode: z.enum(["qa", "extract", "summarize", "risks", "compare"]).optional().default("qa"),
    prompt: z.string().optional(),
  }),
  handler: async ({ input }) => {
    const document = input.document as string;
    const question = input.question as string;
    const mode = input.mode as string;
    const start = Date.now();

    const modePrompt = mode === "qa" ? `${MODE_PROMPTS.qa}\n\nQuestion: ${question}` : MODE_PROMPTS[mode];

    const analysis = await nimChat(
      "nvidia/nemotron-3-nano-30b-a3b",
      [
        { role: "system", content: "You are a senior document analyst. Analyze with precision, cite sections, provide actionable insights." },
        { role: "user", content: `${modePrompt}\n\n--- DOCUMENT ---\n${document.substring(0, 200_000)}\n--- END ---` },
      ],
      { maxTokens: 2048, temperature: 0.2 }
    );

    return {
      success: true, model: "Nemotron 3 Nano 30B", mode,
      document_stats: { characters: document.length, words: document.split(/\s+/).length, pages_estimated: Math.ceil(document.split(/\s+/).length / 300) },
      analysis, duration_ms: Date.now() - start,
    };
  },
});
