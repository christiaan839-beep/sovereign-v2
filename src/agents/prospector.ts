import { research_ai } from "@/lib/ai";
import { remember } from "@/lib/memory";
import type { AgentResult, Lead } from "@/types";

/**
 * Lead Prospector — finds REAL businesses using Tavily web search.
 *
 * Unlike the old version (which generated fictional leads), this uses
 * live web research to find actual companies matching the ideal client profile.
 */
export async function prospectLeads(
  industry: string,
  idealClient: string,
  location?: string,
): Promise<AgentResult & { leads: Lead[] }> {
  // 1. Search for real businesses via Tavily
  const searchQuery = `${industry} ${idealClient} businesses ${location || "South Africa"} company contact`;

  const enrichedOutput = await research_ai(
    searchQuery,
    `You are a B2B lead prospector. Using the live search results provided, identify 5 REAL businesses that match the target profile.

TARGET PROFILE:
- Industry: ${industry}
- Ideal Client: ${idealClient}
- Location: ${location || "South Africa"}

CRITICAL RULES:
- Only return companies you found in the search results — DO NOT invent or fabricate any data
- Use real company names and real website URLs from the search results
- For email, use the format info@[domain] or contact@[domain] if not found directly
- Score each lead 1-100 based on how well they match the ideal client profile
- Stage: "cold" (just found), "warm" (strong match + active online), "hot" (perfect match + clear pain point)

Return ONLY a JSON array. No explanation. Format:
[
  {
    "name": "Contact/Company Name",
    "company": "Real Company Name",
    "email": "real-email@domain.com",
    "website": "https://real-company-url.com",
    "stage": "cold"|"warm"|"hot",
    "score": 1-100,
    "reason": "Why this is a good lead"
  }
]`,
    // Wave-108.5 cost fix: Cerebras Llama-3.1-70B handles JSON-shaped
    // lead extraction at ~$0.10/M tokens vs Gemini Flash at ~$0.30/M
    // input, while remaining faithful to the "only return real
    // companies in the search results" instruction. No explicit
    // fallback here — the caller catches research_ai errors and the
    // markdown-strip + JSON.parse below tolerates the formatting
    // variance between providers.
    {
      model: "cerebras",
      system:
        "You are a B2B lead generation expert. Only return real companies found in the search results. Never fabricate data.",
      maxTokens: 2000,
    },
  );

  let leads: Lead[] = [];
  try {
    const match = enrichedOutput.match(/\[[\s\S]*\]/);
    leads = JSON.parse(match ? match[0] : enrichedOutput);
  } catch {
    leads = [];
  }

  // Store hot leads in memory for other agents
  for (const lead of leads) {
    if (lead.stage === "hot") {
      await remember(
        `Hot lead found: ${lead.name} at ${lead.company} — ${(lead as Lead & { reason?: string }).reason || industry}`,
        JSON.stringify({ type: "lead", stage: "hot", industry }),
      );
    }
  }

  return {
    success: true,
    agent: "prospector",
    output: enrichedOutput,
    leads,
    timestamp: new Date().toISOString(),
  };
}
