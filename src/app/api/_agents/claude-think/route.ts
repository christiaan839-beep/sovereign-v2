import { createAgentRoute } from "@/lib/agent-factory";
import { createLogger } from "@/lib/logger";

const log = createLogger("claude-think");

/**
 * CLAUDE EXTENDED THINKING — Deep reasoning with visible thought process.
 *
 * Uses Claude's extended thinking feature to solve complex problems
 * by showing the full chain of thought before delivering a final answer.
 * Think of it as Claude "thinking out loud" before answering.
 *
 * Best for: strategy, debugging, architecture decisions, complex analysis,
 * math proofs, multi-step planning.
 *
 * Input: { problem, maxThinkingTokens?, context? }
 * Output: { thinking, answer, thinkingTokens, model }
 */

export const POST = createAgentRoute({
  name: "claude-think",
  requiredFields: ["problem"],
  handler: async ({ input }) => {
    const problem = input.problem as string;
    const context = (input.context as string) || "";
    const maxThinkingTokens = Math.min((input.maxThinkingTokens as number) || 10000, 32000);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment or use BYOK in Settings." };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 16000,
          thinking: {
            type: "enabled",
            budget_tokens: maxThinkingTokens,
          },
          messages: [
            {
              role: "user",
              content: context
                ? `Context:\n${context}\n\nProblem:\n${problem}`
                : problem,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        log.warn("Claude API error", { status: res.status });
        return { error: `Claude API error (${res.status})`, details: errorText };
      }

      const data = await res.json();

      // Separate thinking blocks from text blocks
      let thinking = "";
      let answer = "";

      for (const block of data.content || []) {
        if (block.type === "thinking") {
          thinking += block.thinking + "\n";
        } else if (block.type === "text") {
          answer += block.text + "\n";
        }
      }

      return {
        thinking: thinking.trim() || undefined,
        answer: answer.trim(),
        thinkingTokens: data.usage?.cache_creation_input_tokens || 0,
        totalInputTokens: data.usage?.input_tokens || 0,
        totalOutputTokens: data.usage?.output_tokens || 0,
        model: data.model || "claude-sonnet-4",
        mode: "extended-thinking",
      };
    } catch (error) {
      log.error("Claude think error", { error: String(error) });
      return { error: "Extended thinking failed", details: String(error) };
    }
  },
});
