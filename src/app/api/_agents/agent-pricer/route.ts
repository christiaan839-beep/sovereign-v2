import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * AGENT-PRICER — Marketplace pricing recommendation for a new agent.
 *
 * Input:
 *   {
 *     agentPurpose: string,
 *     estimatedCostCents: number,
 *     quality?: "basic"|"verified"|"premium",
 *     competitorPrices?: number[]   // in cents
 *   }
 *
 * Output (JSON):
 *   {
 *     recommendedPriceCents: number,
 *     pricingTiers: { basic, verified, premium },
 *     rationale: string,
 *     marginAtRecommended: number
 *   }
 *
 * A2E moat agent: helps marketplace creators price sustainably so the
 * platform flywheel keeps spinning.
 */

const PRICER_SYSTEM_PROMPT = `You are a platform economics advisor. You help marketplace creators price agents so both they and the platform make money.

${ANTI_SLOP_RULES}

## PRICING RULES
1. Platform takes 30% of every sale. Creators take 70%.
2. Target a 70% creator margin AFTER the platform fee — meaning the sale price minus platform fee minus estimated cost should leave the creator with 70% of the net payout. The recommendedPriceCents should make that math work.
3. Tier spread: premium = 3x basic, verified sits between (roughly 1.75x basic).
4. If competitorPrices[] is supplied, anchor recommendedPriceCents within competitive range — typically at or slightly below the median for price-sensitive markets, slightly above for premium positioning.
5. Never price below estimatedCostCents * 1.5 — that guarantees creator loss after fees.
6. marginAtRecommended is the creator's after-fee, after-cost margin as a number between 0 and 1.
7. All price fields are integers in cents.
8. rationale explains the logic in 2-4 sentences. Reference the competitor data if supplied.
9. Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "agent-pricer",
  requiredFields: ["agentPurpose", "estimatedCostCents"],
  handler: async ({ input }) => {
    const {
      agentPurpose,
      estimatedCostCents,
      quality = "verified",
      competitorPrices = [],
    } = input as {
      agentPurpose: string;
      estimatedCostCents: number;
      quality?: "basic" | "verified" | "premium";
      competitorPrices?: number[];
    };

    const prompt = `Recommend pricing for a new marketplace agent. Return ONLY valid JSON.

AGENT PURPOSE: ${JSON.stringify(agentPurpose.slice(0, 2_000))}
ESTIMATED COST PER RUN (cents): ${estimatedCostCents}
QUALITY TIER: ${quality}
COMPETITOR PRICES (cents): ${JSON.stringify(competitorPrices)}

PLATFORM ECONOMICS:
- Platform fee: 30% of sale price
- Creator net: 70% of sale price
- Creator cost: estimatedCostCents per run
- Creator profit per run = (sale * 0.70) - estimatedCostCents
- marginAtRecommended = creator profit / sale price

SCHEMA:
{
  "recommendedPriceCents": number,
  "pricingTiers": { "basic": number, "verified": number, "premium": number },
  "rationale": string,
  "marginAtRecommended": number
}`;

    const response = await ai(prompt, {
      system: PRICER_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Agent pricing failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
