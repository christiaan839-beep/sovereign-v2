import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { nimChat } from "@/lib/nvidia";

/**
 * AD REPORT — Analyzes campaign metrics and generates optimization recommendations.
 */

const schema = z.object({
  platform: z.string().max(100).optional(),
  metrics: z.string().max(5000).optional(),
  goal: z.string().max(500).optional(),
  dateRange: z.string().max(100).optional(),
  prompt: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "ad-report",
  schema,
  handler: async ({ input }) => {
    const platform = (input.platform as string) || "digital advertising";
    const metrics = (input.metrics as string) || "";
    const goal = (input.goal as string) || "";
    const dateRange = (input.dateRange as string) || "";

    const result = await nimChat("nvidia/llama-3.1-nemotron-ultra-253b-v1", [
      {
        role: "system",
        content: `You are a performance marketing analyst. Analyze campaign data and provide specific, actionable recommendations. Never use vague language. Always reference specific metrics. Format as:

## Campaign Summary
[2-3 sentence overview with key metrics]

## What's Working
[Bullet points with specific metrics]

## What's Not Working
[Bullet points with specific metrics]

## Recommended Actions
[Numbered list of specific changes with expected impact]

## Budget Recommendation
[Specific reallocation suggestions]`,
      },
      {
        role: "user",
        content: `Analyze this ${platform} campaign data:\n\n${metrics ? `Metrics:\n${metrics}` : "No metrics provided — give a general campaign audit framework."}\n${goal ? `Goal: ${goal}` : ""}\n${dateRange ? `Date range: ${dateRange}` : ""}\n\nProvide specific, actionable recommendations.`,
      },
    ]);

    return {
      success: true,
      report: result,
      platform,
      timestamp: new Date().toISOString(),
    };
  },
});
