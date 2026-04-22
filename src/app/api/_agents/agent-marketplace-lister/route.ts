import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * AGENT-MARKETPLACE-LISTER — Package a user's agent for the A2E marketplace.
 *
 * Given an agent's purpose, system prompt, and a sample input, this agent
 * writes a full marketplace listing: description, short pitch, category,
 * pricing tier recommendation, tags, SEO title, and sample run cards.
 *
 * Input:
 *   {
 *     agentPurpose:  string  — Natural language description of what the agent does
 *     systemPrompt:  string  — The agent's current system prompt
 *     sampleInput:   string  — Example user input the agent accepts
 *     creatorName?:  string  — Creator's display name (optional)
 *     category?:     string  — Creator's suggested category (optional)
 *     sampleOutput?: string  — Example output (optional)
 *   }
 *
 * Output (JSON):
 *   {
 *     marketplaceDescription:    string  (100-300 words),
 *     shortDescription:          string  (1 sentence),
 *     categoryRecommendation:    string,
 *     pricingTierRecommendation: "free"|"basic"|"pro"|"enterprise",
 *     sampleRunCards: Array<{ input, expectedOutput }>,
 *     tags:                      string[],
 *     seoTitle:                  string
 *   }
 *
 * Never-fabricate: creator credentials. If creatorName is missing, the
 * listing is attributed to "Anonymous Creator".
 */

const MARKETPLACE_LISTER_SYSTEM_PROMPT = `You are a marketplace copywriter who has shipped 300+ AI agent listings on A2E. You write listings that convert browsers into subscribers because they are specific, honest, and load-bearing — not adjective-stuffed.

${ANTI_SLOP_RULES}

## LISTING RULES
1. NEVER fabricate creator credentials, benchmarks, customer logos, awards, or success stories. You only have what's in the input — everything beyond that is off-limits.
2. If creatorName is not supplied, attribute the listing to "Anonymous Creator" — do not invent a persona.
3. marketplaceDescription must be 100-300 words. Lead with the concrete outcome, then show how, then name the user. No fluffy intro paragraph.
4. shortDescription is one sentence (max 20 words), outcome-first. It should read cleanly on a card.
5. pricingTierRecommendation calibration:
   - free: read-only / low-compute / single-shot transformations
   - basic: straightforward single-agent task with modest token spend
   - pro: multi-step, high-value, expert-tier output
   - enterprise: sensitive data, compliance, or runs-at-scale workloads
6. Tags: 5-10 lowercase-kebab-case strings. Tags are user search terms, not marketing copy. No branded terms.
7. seoTitle: 40-60 characters, keyword-led, no clickbait.
8. sampleRunCards: exactly 2 entries. Use the provided sample when present; invent a plausible second variant that follows the same input schema. Expected outputs should be short and structural — not full fake results.
9. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "agent-marketplace-lister",
  requiredFields: ["agentPurpose", "systemPrompt", "sampleInput"],
  handler: async ({ input }) => {
    const {
      agentPurpose,
      systemPrompt,
      sampleInput,
      creatorName,
      category,
      sampleOutput,
    } = input as {
      agentPurpose: string;
      systemPrompt: string;
      sampleInput: string;
      creatorName?: string;
      category?: string;
      sampleOutput?: string;
    };

    const prompt = `Write a marketplace listing for this agent. Return ONLY valid JSON matching the schema.

AGENT PURPOSE:
${agentPurpose}

SYSTEM PROMPT (first 4000 chars):
"""
${String(systemPrompt).slice(0, 4000)}
"""

SAMPLE INPUT:
"""
${String(sampleInput).slice(0, 2000)}
"""

${sampleOutput ? `SAMPLE OUTPUT:\n"""\n${String(sampleOutput).slice(0, 2000)}\n"""\n` : ""}
CREATOR: ${creatorName ?? "Anonymous Creator"}
SUGGESTED CATEGORY: ${category ?? "(none — choose one)"}

SCHEMA:
{
  "marketplaceDescription": string,
  "shortDescription": string,
  "categoryRecommendation": string,
  "pricingTierRecommendation": "free" | "basic" | "pro" | "enterprise",
  "sampleRunCards": [ { "input": string, "expectedOutput": string } ],
  "tags": [ string ],
  "seoTitle": string
}`;

    const response = await ai(prompt, {
      system: MARKETPLACE_LISTER_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Marketplace listing generation failed: model returned non-JSON output");
    }

    return { success: true, listing: parsed };
  },
});
