import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * DEEPSEEK R1 — Reasoning model for math, science, logic, code debugging.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "deepseek-r1",
  schema: z.object({
    problem: z.string().min(3).max(10_000),
    domain: z.string().max(50).optional().default("general"),
    prompt: z.string().optional(),
  }),
  handler: async ({ input }) => {
    const problem = input.problem as string;
    const domain = input.domain as string;
    const start = Date.now();

    const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-r1-distill-qwen-32b",
        messages: [
          { role: "system", content: `You are a deep reasoning engine specializing in ${domain}. Show complete chain of thought. Use <think>...</think> tags for reasoning.` },
          { role: "user", content: problem },
        ],
        max_tokens: 2048, temperature: 0.1,
      }),
    }, { ruleId: "agents.deepseek-r1.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!res.ok) throw new Error(`NIM returned ${res.status}`);
    const data = await res.json();
    const fullResponse = data?.choices?.[0]?.message?.content || "";

    const thinkMatch = fullResponse.match(/<think>([\s\S]*?)<\/think>/);
    const reasoning = thinkMatch ? thinkMatch[1].trim() : "";
    const answer = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    return {
      success: true, model: "DeepSeek R1", domain,
      reasoning_trace: reasoning || "Reasoning embedded in answer",
      final_answer: answer || fullResponse,
      duration_ms: Date.now() - start,
    };
  },
});
