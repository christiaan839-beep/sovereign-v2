import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * LISTING-WRITER — Property facts → MLS, Zillow, Airbnb copy variants.
 *
 * Takes raw property facts and outputs three platform-tailored descriptions
 * plus headlines and legal disclaimers.
 *
 * Input:
 *   facts: string  (required — beds/baths/sqft/features/location)
 *   targetPlatforms?: string[]  (default ["mls", "zillow", "airbnb"])
 *   style?: "professional" | "warm" | "luxury"
 *
 * Output (JSON):
 *   {
 *     mlsDescription: string,
 *     zillowDescription: string,
 *     airbnbDescription: string,
 *     headlines: string[],
 *     disclaimers: string[]
 *   }
 *
 * Pairs with:
 *   - `tenant-screener` — downstream once applicants respond
 */

const LISTING_WRITER_SYSTEM_PROMPT = `You are a senior real estate copywriter who writes compliant, high-converting listings for MLS, Zillow, and Airbnb.

${ANTI_SLOP_RULES}

## PLATFORM-SPECIFIC RULES
1. MLS: facts-first, 200 words MAXIMUM, no superlatives ("amazing", "stunning", "best"), no fair-housing-prohibited language, no personal pronouns. Structure: headline fact → specs → features → neighborhood.
2. ZILLOW: buyer-emotional, lifestyle framing, paint the "imagine waking up here" picture but anchor every emotion in a real fact. 250-350 words.
3. AIRBNB: experience-focused, warm host voice (first person OK), highlight what guests DO (not just what exists). 200-300 words.

## HARD RULES
- NEVER use fair-housing-prohibited language: "family-friendly", "adult community", "walk to church", "great for young professionals", "single family" as a lifestyle claim, etc.
- NEVER invent facts. If a claim isn't in the input, it can't be in the copy.
- Any claim about dimensions, school districts, HOA status, or zoning MUST be listed in disclaimers[] (e.g. "Square footage approximate; buyer to verify").
- Headlines: 3-5 options, each under 80 characters, no clickbait.
- Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "listing-writer",
  requiredFields: ["facts"],
  handler: async ({ input }) => {
    const {
      facts,
      targetPlatforms = ["mls", "zillow", "airbnb"],
      style = "professional",
    } = input as {
      facts: string;
      targetPlatforms?: string[];
      style?: "professional" | "warm" | "luxury";
    };

    const prompt = `Write listing copy for this property in ${style} tone. Target platforms: ${targetPlatforms.join(", ")}. Return ONLY valid JSON matching the schema.

PROPERTY FACTS:
"""
${facts.slice(0, 8000)}
"""

SCHEMA:
{
  "mlsDescription": string,
  "zillowDescription": string,
  "airbnbDescription": string,
  "headlines": [ string ],
  "disclaimers": [ string ]
}`;

    const response = await ai(prompt, {
      system: LISTING_WRITER_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Listing writing failed: model returned non-JSON output");
    }

    return { success: true, listing: parsed };
  },
});
