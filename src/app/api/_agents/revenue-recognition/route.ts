import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * REVENUE-RECOGNITION — Contract terms → ASC 606 / IFRS 15 revenue schedule.
 *
 * Takes a natural-language summary of a customer contract and decomposes it
 * into distinct performance obligations with a period-by-period recognition
 * schedule.
 *
 * Input:
 *   contractSummary: string  (required)
 *   accountingStandard?: "ASC 606" | "IFRS 15" (default "ASC 606")
 *
 * Output (JSON):
 *   {
 *     performanceObligations: [{ description, standalonePrice, recognitionPattern }],
 *     schedule: [{ period, revenue, rationale }],
 *     totalContractValue: number,
 *     cautions: string[]
 *   }
 *
 * Pairs with:
 *   - `contract-summarizer` — upstream to extract deal terms
 *   - `invoice-extractor` — downstream to tie invoiced amounts to the schedule
 */

const REV_REC_SYSTEM_PROMPT = `You are a revenue accountant with hands-on experience applying ASC 606 and IFRS 15 to SaaS, services, and multi-element arrangements.

${ANTI_SLOP_RULES}

## RECOGNITION RULES
1. Identify DISTINCT performance obligations (goods/services that are separately identifiable and the customer can benefit from on their own or with readily available resources).
2. Allocate transaction price PROPORTIONALLY based on relative standalone selling prices. If standalone price isn't stated or observable, flag it in cautions — never invent a number without disclosure.
3. Over-time recognition requires a clearly identifiable INPUT (e.g. cost-to-cost) or OUTPUT (e.g. milestones delivered) measure of progress. Point-in-time is the default for transferred goods.
4. Variable consideration (usage-based, bonuses, penalties) must be constrained — recognize only amounts highly likely not to reverse.
5. The schedule's total revenue MUST sum to totalContractValue. If it doesn't, flag the reconciliation gap in cautions.
6. Every caution should cite the specific contract term that triggered it.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "revenue-recognition",
  requiredFields: ["contractSummary"],
  handler: async ({ input }) => {
    const { contractSummary, accountingStandard = "ASC 606" } = input as {
      contractSummary: string;
      accountingStandard?: "ASC 606" | "IFRS 15";
    };

    const prompt = `Build a revenue-recognition schedule for this contract under ${accountingStandard}. Return ONLY valid JSON matching the schema.

CONTRACT SUMMARY:
"""
${contractSummary.slice(0, 10_000)}
"""

SCHEMA:
{
  "performanceObligations": [
    { "description": string, "standalonePrice": number, "recognitionPattern": "point-in-time" | "over-time" }
  ],
  "schedule": [
    { "period": string, "revenue": number, "rationale": string }
  ],
  "totalContractValue": number,
  "cautions": [ string ]
}`;

    const response = await ai(prompt, {
      system: REV_REC_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Revenue recognition failed: model returned non-JSON output");
    }

    return { success: true, recognition: parsed };
  },
});
