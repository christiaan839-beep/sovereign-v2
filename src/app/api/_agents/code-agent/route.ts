import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * CODE AGENT — MiniMax M2.5 for production-ready code generation.
 * HTML, CSS, JS, Python, TypeScript, React, SQL, shell scripts, debugging.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const schema = z.object({
  task: z.string().min(3, "Task description is required").max(5000),
  language: z.string().max(50).optional().default("typescript"),
  context: z.string().max(10_000).optional().default(""),
  prompt: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "code-agent",
  schema,
  skipPiiScan: true, // Code output contains patterns that trigger PII false positives (emails in examples, IPs in configs)
  handler: async ({ input }) => {
    const { task, language, context } = input as z.infer<typeof schema>;
    const start = Date.now();

    const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "minimaxai/minimax-m2.5",
        messages: [
          {
            role: "system",
            content: `You are a senior software engineer. Write clean, production-ready ${language} code. Follow best practices: proper error handling, type safety, clear naming. If debugging, explain root cause first, then provide the fix.${context ? `\n\nExisting context:\n${context}` : ""}`,
          },
          { role: "user", content: task },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    }, { ruleId: "agents.code-agent.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!res.ok) throw new Error(`NIM API returned ${res.status}`);
    const data = await res.json();

    return {
      success: true,
      model: "MiniMax M2.5",
      language,
      code: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
    };
  },
});
