import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * MINIMAX M2.5 CODE AGENT — Coding-optimized model for production code generation.
 * Now wrapped in createAgentRoute for full security pipeline:
 * auth → jailbreak check → content safety → execute → PII scan → quality score
 */

export const POST = createAgentRoute({
  name: "code-agent",
  requiredFields: ["task"],
  handler: async ({ input }) => {
    const task = input.task as string;
    const language = (input.language as string) || "typescript";
    const context = (input.context as string) || "";

    const start = Date.now();
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "minimaxai/minimax-m2.5",
        messages: [
          {
            role: "system",
            content: `You are an elite software engineer. Write clean, production-ready ${language} code. Follow best practices: proper error handling, type safety, clear naming, and comments for complex logic. If debugging, explain the root cause first, then provide the fix.${context ? `\n\nExisting context:\n${context}` : ""}`,
          },
          { role: "user", content: task },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });

    const data = await res.json();

    return {
      success: true,
      model: "MiniMax M2.5 (Code-Optimized)",
      language,
      code: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
    };
  },
});
