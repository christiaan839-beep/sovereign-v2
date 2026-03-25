import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";

// Anthropic's open-source Meta-Prompt methodology translated into a Sovereign constraint.
const ANTHROPIC_META_PROMPT = `Today you will be writing instructions for an AI AI assistant. 
Your goal is to write a highly detailed, extremely strict system prompt using XML tags for structure.

Based on the user's task description, construct a prompt that includes:
1. <role>: Who the AI is and what persona it should adopt.
2. <instructions>: A numbered list of absolute rules the AI must follow.
3. <output_format>: Exact JSON schema, markdown format, or XML tags the AI must use.
4. <examples>: (Optional but recommended) 1-2 examples of ideal input/output.

DO NOT output anything other than the generated prompt. DO NOT surround the prompt in markdown code blocks. Just output the raw text of the final system prompt. Keep it between 300 and 800 words. Make it sound extremely professional, ruthless, and elite.`;

export async function POST(req: Request) {
  try {
    const { task } = await req.json();

    if (!task) {
      return NextResponse.json({ error: "No task provided" }, { status: 400 });
    }

    // Route directly to Claude via ai() which defaults BYOK/Anthropic logic.
    // We enforce Anthropic Meta-Prompting via the system directive.
    const generatedPrompt = await ai(task, {
      model: "claude",
      system: ANTHROPIC_META_PROMPT,
      maxTokens: 1500
    });

    return NextResponse.json({ prompt: generatedPrompt });
  } catch (err: unknown) {
    console.error("Meta Prompt Generation Error:", err);
    return NextResponse.json({ error: "Failed to build prompt orchestration." }, { status: 500 });
  }
}
