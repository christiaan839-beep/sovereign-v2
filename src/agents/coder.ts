import { ai } from "@/lib/ai";
import type { AgentResult } from "@/types";

/** Claude-powered code generation agent */
export async function generateCode(
  objective: string,
  language: string = "TypeScript"
): Promise<AgentResult & { code: string; explanation: string }> {
  const output = await ai(
    `Write production-ready ${language} code for: ${objective}

RULES: Include imports, error handling, JSDoc comments. Return code in a markdown code block, followed by a "## How to use" section.`,
    {
      model: "claude",
      system: "You are a senior full-stack engineer. Write clean, production-grade code.",
      maxTokens: 4000,
    }
  );

  const codeMatch = output.match(/```[\w]*\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : output;
  const explanation = output.replace(/```[\w]*\n[\s\S]*?```/, "").trim();

  return { success: true, agent: "coder", output, code, explanation, timestamp: new Date().toISOString() };
}
