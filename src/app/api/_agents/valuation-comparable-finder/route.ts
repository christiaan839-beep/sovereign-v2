import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * VALUATION-COMPARABLE-FINDER — Build a comparable-sales search framework for a property.
 *
 * Given a natural-language property description, outputs a valuation range,
 * the search criteria an appraiser should use to find real comps, the
 * adjustment factors to apply to those comps, market notes, and disclaimers.
 *
 * We do NOT have MLS access — this agent builds the FRAMEWORK for finding
 * and adjusting comps, not actual comparable sales data.
 *
 * Input:
 *   {
 *     propertyDescription: string,   // beds, baths, sqft, location, condition, features
 *     targetUse?:    "sale" | "rental" | "appraisal" | "insurance",
 *     marketCondition?: "hot" | "balanced" | "cool"
 *   }
 *
 * Output (JSON):
 *   {
 *     valuationRange:     { low, midpoint, high, currency },
 *     compsCriteria:      Array<{ dimension, acceptableRange }>,
 *     adjustmentFactors:  Array<{ factor, direction, magnitude }>,
 *     marketNotes:        string[],
 *     disclaimers:        string[]
 *   }
 */

const VALUATION_COMPARABLE_FINDER_SYSTEM_PROMPT = `You are a state-certified residential real-estate appraiser who trains junior appraisers on the sales-comparison approach. You design comp-search frameworks — you never pretend to have MLS access or recent recorded sales data.

${ANTI_SLOP_RULES}

## APPRAISAL RULES
1. NEVER fabricate specific comparable sales (addresses, prices, dates, parcel numbers). You do NOT have MLS access.
2. Your job is to output the SEARCH CRITERIA an appraiser would plug into their MLS, and the ADJUSTMENT FRAMEWORK to apply once comps come back. Not the comps themselves.
3. valuationRange is a qualitative order-of-magnitude range grounded in the description alone. Use currency = "USD" unless the description clearly indicates another market (then use ISO 4217). low, midpoint, high are integer dollar amounts.
4. compsCriteria: 5-10 dimensions. Each dimension is what appraisers actually filter on (living_area_sqft, year_built, bed_count, bath_count, lot_size, distance_from_subject, sale_date, condition, style, school_district). acceptableRange is a concrete string like "±10%", "within 0.5 miles", "sold within 180 days", "±1 bed".
5. adjustmentFactors: 4-8 items. factor names a property feature (e.g. "garage", "updated_kitchen", "pool", "corner_lot"). direction is "up" or "down" (how the subject differs from a typical comp). magnitude is a qualitative band ("minor", "moderate", "major") with a brief note on typical contribution.
6. marketNotes: 2-4 bullets of honest market context implied by marketCondition and targetUse — not region-specific predictions.
7. disclaimers: ALWAYS include at least these three — "Not an MLS lookup — provides search framework only", "Not a USPAP-compliant appraisal", "Valuation range assumes arms-length transaction and stabilized market conditions". Add any other honest caveats.
8. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "valuation-comparable-finder",
  requiredFields: ["propertyDescription"],
  handler: async ({ input }) => {
    const { propertyDescription, targetUse, marketCondition } = input as {
      propertyDescription: string;
      targetUse?: "sale" | "rental" | "appraisal" | "insurance";
      marketCondition?: "hot" | "balanced" | "cool";
    };

    const prompt = `Build a comparable-sales search framework for this property. Return ONLY valid JSON matching the schema.

PROPERTY DESCRIPTION:
"""
${propertyDescription.slice(0, 6000)}
"""

TARGET USE: ${targetUse ?? "sale"}
MARKET CONDITION: ${marketCondition ?? "balanced"}

SCHEMA:
{
  "valuationRange": { "low": number, "midpoint": number, "high": number, "currency": string },
  "compsCriteria": [ { "dimension": string, "acceptableRange": string } ],
  "adjustmentFactors": [ { "factor": string, "direction": "up" | "down", "magnitude": string } ],
  "marketNotes": [ string ],
  "disclaimers": [ string ]
}`;

    const response = await ai(prompt, {
      system: VALUATION_COMPARABLE_FINDER_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Valuation comparable finder failed: model returned non-JSON output");
    }

    return { success: true, framework: parsed };
  },
});
