import { createAgentRoute } from "@/lib/agent-factory";
import { verifiedAi } from "@/lib/consensus";

/**
 * CONSENSUS AGENT — multi-model verification (generate → critique → revise).
 *
 * Wraps `verifiedAi()` — the same Constitutional-AI pattern Anthropic uses
 * internally. One model generates, a DIFFERENT model critiques, the first
 * model revises if the critique found issues. This is the "show the work"
 * version of AI output, surfacing both the final answer and the critique
 * that shaped it.
 *
 * Input:
 *   { prompt: string, system?: string, skipVerify?: boolean }
 *
 * Output:
 *   {
 *     answer: string,
 *     verified: boolean,
 *     revised: boolean,
 *     confidence: number (0-1),
 *     models: string[]       // e.g. ["nemotron-ultra", "deepseek-v3-2"]
 *   }
 *
 * This agent is one of the platform's differentiators — most AI tools
 * return a single model's output and call it done. Consensus returns
 * a verified-by-another-model answer plus the audit trail.
 */
export const POST = createAgentRoute({
  name: "consensus",
  requiredFields: ["prompt"],
  handler: async ({ input }) => {
    const { prompt, system, skipVerify } = input as {
      prompt: string;
      system?: string;
      skipVerify?: boolean;
    };

    const result = await verifiedAi(prompt, {
      system: system ?? "",
      skipVerify: Boolean(skipVerify),
    });

    return { success: true, ...result };
  },
});
