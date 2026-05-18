import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai } from "@/lib/ai";

const ANTHROPIC_META_PROMPT = `Today you will be writing instructions for an AI assistant.
Your goal is to write a highly detailed, strict system prompt using XML tags for structure.

Based on the user's task description, construct a prompt that includes:
1. <role>: Who the AI is and what persona it should adopt.
2. <instructions>: A numbered list of absolute rules the AI must follow.
3. <output_format>: Exact JSON schema, markdown format, or XML tags the AI must use.
4. <examples>: (Optional but recommended) 1-2 examples of ideal input/output.

DO NOT output anything other than the generated prompt. No markdown code blocks. Just raw text. Keep it 300-800 words.`;

export const POST = createAgentRoute({
  name: "meta-prompt",
  schema: z.object({
    task: z.string().min(3).max(5000),
    prompt: z.string().optional(),
  }),
  handler: async ({ input }) => {
    // Cost: meta-prompt rewriting at 1500 tokens — NIM Nemotron handles
    // prompt-engineering tasks on par with Claude at $0.
    const generatedPrompt = await ai(input.task as string, {
      model: "nim",
      system: ANTHROPIC_META_PROMPT,
      maxTokens: 1500,
    });
    return { prompt: generatedPrompt };
  },
});
