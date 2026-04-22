import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * MARKETING-ATTRIBUTION — Attribute conversions across touchpoints.
 *
 * Given a list of customer touchpoint events (with optional revenue and
 * conversion timestamps), computes channel contribution, the top converting
 * paths, recommendations, and caveats. Attribution model is selectable.
 *
 * Input:
 *   {
 *     events: Array<{
 *       customerId, touchpoint, channel, timestamp,
 *       convertedAt?, revenue?
 *     }>,
 *     model?: "first-touch" | "last-touch" | "linear" | "time-decay" | "position-based"
 *   }
 *
 * Output (JSON):
 *   {
 *     channelContribution: Array<{ channel, contribution, confidence }>,
 *     topPaths:            Array<{ path, conversions, revenue }>,
 *     recommendations:     string[],
 *     caveats:             string[]
 *   }
 */

const MARKETING_ATTRIBUTION_SYSTEM_PROMPT = `You are a marketing-mix analyst who has built attribution models for 50+ DTC and B2B pipelines. You compute attribution ONLY from supplied events — you never hallucinate traffic, revenue, or touchpoints that aren't in the data.

${ANTI_SLOP_RULES}

## ATTRIBUTION RULES
1. NEVER fabricate conversion events, channels, revenue, or touchpoints. Every number in the output must be derivable from the supplied events array.
2. Attribution models:
   - first-touch: 100% credit to the first touchpoint per customer.
   - last-touch: 100% credit to the final touchpoint before convertedAt.
   - linear: equal credit split across all touchpoints leading up to a conversion.
   - time-decay: exponential decay with a 7-day half-life from convertedAt.
   - position-based: 40% to first, 40% to last, 20% spread across middle.
3. contribution is a number between 0 and 1, summed across channels equals 1.0 (±0.02 rounding tolerance).
4. confidence is "high" when >=50 conversions feed the channel's weight, "medium" for 10-49, "low" for <10. ALWAYS flag small-sample results as low-confidence.
5. topPaths: up to 5 ordered sequences of channels, ranked by conversions. If a path has fewer than 3 conversions, exclude it.
6. recommendations: 3-5 specific actions grounded in what the data shows (e.g. "Email drove 32% of last-touch but 8% of first-touch — invest in discovery channels like paid social"). No generic platitudes.
7. caveats: ALWAYS include at least these — sample-size caveat if any channel has <10 conversions, model-choice caveat naming the selected model's known bias, and a time-window caveat noting the span of the supplied events.
8. If the events array is empty, return empty arrays and caveats naming the lack of data — do not hallucinate a default result.
9. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "marketing-attribution",
  requiredFields: ["events"],
  handler: async ({ input }) => {
    const { events, model } = input as {
      events: Array<{
        customerId: string;
        touchpoint: string;
        channel: string;
        timestamp: string;
        convertedAt?: string;
        revenue?: number;
      }>;
      model?: "first-touch" | "last-touch" | "linear" | "time-decay" | "position-based";
    };

    const attributionModel = model ?? "time-decay";

    const prompt = `Compute attribution over these events. Return ONLY valid JSON matching the schema.

ATTRIBUTION MODEL: ${attributionModel}

EVENTS (truncated to 500 for token budget):
${JSON.stringify(events.slice(0, 500), null, 2)}

SCHEMA:
{
  "channelContribution": [
    { "channel": string, "contribution": number, "confidence": "high" | "medium" | "low" }
  ],
  "topPaths": [
    { "path": [ string ], "conversions": number, "revenue": number }
  ],
  "recommendations": [ string ],
  "caveats": [ string ]
}`;

    const response = await ai(prompt, {
      system: MARKETING_ATTRIBUTION_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Attribution analysis failed: model returned non-JSON output");
    }

    return { success: true, attribution: parsed };
  },
});
