import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Competitor Intel API
 * Deep competitive analysis using AI to identify weaknesses and opportunities.
 *
 * Wave-111.1 batch 6: factory memory hooks. Per-competitor analyses
 * compound — last quarter's exploitation tags, market gaps, and
 * battle-plan owners inform this quarter's plan + surface what's
 * been executed vs ignored.
 */

// Opus 4.7 prompt pattern (Wave 83): literal-execution CRISPE structure
// + XML-tagged instructions + <search_first> + step-by-step enumeration.
// Opus 4.7 stopped inferring intent; every constraint must be explicit.
const COMPETITOR_PROMPT = `<role>
You are a competitive intelligence analyst working for an operator
who needs a battle plan in the next 60 minutes. You see weaknesses
others miss; you write recommendations a CMO can hand to a team and
execute Monday morning.
</role>

<capacity>
- Apply Porter's Five Forces + Blue Ocean Strategy frameworks
- Identify direct + indirect competitor weaknesses
- Surface market gaps nobody is filling
- Quantify pricing arbitrage and messaging vulnerabilities
- Refuse to produce generic commentary, vendor flattery, or filler
</capacity>

<step_by_step>
When asked to analyse a competitor, you MUST:
  (1) Read the competitor URL + business context line-by-line.
  (2) Map the competitor's positioning to one Porter force where they
      are weakest (rivalry / new-entrant / substitute / buyer-power /
      supplier-power). This is your central insight.
  (3) Find 3 weaknesses, ranked by exploitability. Each weakness gets
      a one-sentence "how to exploit" + an urgency tag (HIGH / MEDIUM
      / LOW).
  (4) Find 3 market gaps the competitor is not filling. Each gap gets
      a one-sentence opportunity + an estimated annual value range.
  (5) Build a battle plan: immediate (this week), short-term (this
      quarter), long-term (this year). Each action must name an owner
      role (CMO / Head of Product / SDR Manager).
  (6) Return ONE JSON object — no markdown fence, no commentary
      before or after.
</step_by_step>

<output_requirements>
- The output MUST be valid JSON parseable by JSON.parse() — no
  trailing commas, no leading "Here is", no markdown fence.
- Every quoted competitor fact must come from the URL or input,
  never from training data.
- Numbers + dates + proper nouns must be VERBATIM from the input;
  do not paraphrase pricing.
- If the input is silent on a field, use the string "input does not
  specify" — do not fabricate to fill structure.
</output_requirements>

<search_first>
For any present-day claim (current pricing, current funding round,
current headcount, current customer count, current marketing spend),
you MUST tag it with the string "[VERIFY]" immediately after the
claim. You do not have live web access; pre-training-cutoff facts
about specific companies WILL be stale by the time the operator
acts on this report.
</search_first>

${ANTI_SLOP_RULES}`;

export const POST = createAgentRoute({
  name: "competitor",
  // Wave-111.1 batch 6: factory memory hooks for compound
  // competitive intelligence over time. Per-competitor analyses
  // build on prior weaknesses + executed battle plan items.
  memory: {
    search: {
      query: (input) =>
        `competitor:${input.competitorName ?? input.competitorUrl ?? ""} yours:${input.yourBusiness ?? ""}`,
      limit: 3,
    },
    store: {
      extract: (result) => {
        const r = result as {
          weaknesses?: Array<{ description?: string; urgency?: string }>;
          marketGaps?: Array<{ opportunity?: string }>;
        };
        const weaknesses = (r.weaknesses ?? [])
          .slice(0, 2)
          .map((w) => `[${w.urgency ?? "?"}] ${w.description ?? ""}`)
          .join(" | ");
        const gaps = (r.marketGaps ?? [])
          .slice(0, 2)
          .map((g) => g.opportunity ?? "")
          .filter(Boolean)
          .join("; ");
        if (!weaknesses && !gaps) return null;
        return `Weaknesses: ${weaknesses}. Gaps: ${gaps}`;
      },
      metadata: (input) => ({
        competitor: String(input.competitorName ?? input.competitorUrl ?? ""),
        yourBusiness: String(input.yourBusiness ?? ""),
        industry: String(input.industry ?? ""),
        kind: "competitor-intel",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    const { competitorUrl, competitorName, yourBusiness, industry } =
      input as Record<string, unknown>;
    const pastAnalyses = pastContextAsPrompt();

    const prompt = `Conduct a deep competitive intelligence analysis:

COMPETITOR: ${competitorName || competitorUrl || "Unknown"}
COMPETITOR URL: ${competitorUrl || "Not provided"}
YOUR BUSINESS: ${yourBusiness || "AI marketing platform"}
INDUSTRY: ${industry || "Marketing technology"}
${pastAnalyses ? `\nPRIOR ANALYSES on this competitor (historical FACTS — surface what's changed in their position vs prior cycles, do NOT restate the prior battle plan verbatim):\n${pastAnalyses}\n` : ""}
Provide a comprehensive analysis in JSON:
{
  "competitorProfile": {
    "name": "...",
    "estimatedSize": "...",
    "targetMarket": "...",
    "pricingModel": "...",
    "estimatedRevenue": "..."
  },
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": [
    { "weakness": "...", "howToExploit": "...", "urgency": "HIGH/MEDIUM/LOW" }
  ],
  "marketGaps": [
    { "gap": "...", "opportunity": "...", "estimatedValue": "..." }
  ],
  "messagingAnalysis": {
    "theirPositioning": "...",
    "vulnerabilities": ["..."],
    "superiorPositioning": "How you should position against them"
  },
  "pricingIntelligence": {
    "theirPricing": "...",
    "pricingWeakness": "...",
    "recommendedStrategy": "..."
  },
  "battlePlan": {
    "immediate": ["Action 1", "Action 2"],
    "shortTerm": ["Action 1", "Action 2"],
    "longTerm": ["Action 1", "Action 2"]
  }
}`;

    const result = await ai(prompt, {
      system: COMPETITOR_PROMPT,
      maxTokens: 3000,
    });

    let parsed;
    try {
      const cleaned = result
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { analysis: result };
    }

    await fireUserWebhook("CompetitorIntel", "Analyzed", {
      competitorName: competitorName || competitorUrl,
    });

    return { success: true, intel: parsed };
  },
});
