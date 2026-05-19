import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { withSelfHeal } from "@/lib/self-heal";
import { enrichLeads } from "@/lib/enrichment";
import { z } from "zod";

/**
 * LEADS AGENT — Find real prospects using live web research.
 *
 * Uses Tavily to search for real companies, then NVIDIA Nemotron Ultra
 * to analyze, qualify, and draft personalized outreach.
 *
 * Self-heal: if the upstream model returns non-JSON or 0 leads, the
 * diagnoser (Nemotron Ultra) proposes a broader/narrower niche or a
 * clearer location filter, and we retry once before surfacing the
 * failure. Security failures never heal — they throw straight through.
 *
 * Input: { niche: string, location: string, product?: string, context?: string }
 * Output: { leads: Lead[], total: number, _healAttempts?: HealAttempt[] }
 */

const INPUT_SCHEMA = z
  .object({
    niche: z.string().min(1).max(200),
    location: z.string().max(200).optional(),
    product: z.string().max(500).optional(),
    context: z.string().max(2000).optional(),
    prompt: z.string().max(5000).optional(),
  })
  .passthrough();

export const POST = createAgentRoute({
  name: "leads",
  requiredFields: ["niche"],
  handler: withSelfHeal(
    async ({ input }) => {
      const niche = input.niche as string;
      const location = (input.location as string) || "worldwide";
      const product = (input.product as string) || "";
      const context = (input.context as string) || "";

      // Step 1: Real web research via Tavily
      let webResearch = "";
      try {
        webResearch = await research_ai(
          `${niche} companies ${location} hiring growing 2026`,
          `Find real companies in the ${niche} industry located in ${location}. For each company found, identify: the company name, what they do, their website URL if available, and any recent news (funding, hiring, product launches). Focus on companies that would be good prospects for outreach.`,
        );
      } catch (_err) {
        // Don't hallucinate fake leads — flag that research was unavailable
        webResearch = "";
      }

      // Step 2: AI analysis + lead generation
      const prompt = `You are a B2B sales intelligence analyst. Based on the real web research below, generate a list of qualified prospects.

${webResearch ? `RESEARCH DATA:\n${webResearch}` : "NOTE: Web research was unavailable. Generate prospects based on your training knowledge but clearly mark all leads as UNVERIFIED. Do NOT fabricate specific website URLs — use 'unknown' instead."}

TARGET NICHE: ${niche}
LOCATION: ${location}
${product ? `PRODUCT/SERVICE BEING SOLD: ${product}` : ""}
${context ? `ADDITIONAL CONTEXT: ${context}` : ""}

${ANTI_SLOP_RULES}

Generate 5-10 qualified prospects. For each, provide:
- company_name: The real company name (from research if possible)
- industry: Their specific sub-industry
- location: City/region
- website: Their website URL (use real URLs from research, or best guess based on company name)
- signal: Why they're a good prospect right now (recent funding, hiring, expansion, etc.)
- contact_angle: A specific personalized outreach angle based on their situation
- score: 1-10 qualification score

Return ONLY valid JSON:
{
  "leads": [
    {
      "company_name": "...",
      "industry": "...",
      "location": "...",
      "website": "...",
      "signal": "...",
      "contact_angle": "...",
      "score": 8
    }
  ]
}`;

      const result = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        [
          {
            role: "system",
            // Opus 4.7 prompt pattern (Wave 89): literal execution.
            // Used to be a single line; the model would sometimes emit
            // markdown fences, hedged commentary, or empty arrays when
            // the input was thin. Explicit constraints + step_by_step +
            // search_first fixed all three failure modes in production.
            content: `<role>
You are a B2B sales intelligence analyst building a qualified-leads
JSON the operator will hand to their SDR team within 24 hours.
</role>

<capacity>
- Identify the ~10 highest-fit accounts matching the operator's ICP
- Score each lead 1-10 on fit × buying-signal
- Produce ONE JSON object — no markdown fence, no preamble, no
  "Here are the leads" prefix
- Refuse to invent companies, contact angles, or signals that are
  not grounded in the input
</capacity>

<step_by_step>
(1) Read the ICP description line-by-line.
(2) For each candidate, score (fit × signal): companies with strong
    intent signals (recent funding / hiring / product launch / leadership
    change) outrank companies with weak signals even if fit is identical.
(3) Drop anything below score 7 — quality over quantity.
(4) For each kept lead, write one contact_angle sentence that names
    a SPECIFIC observable about that company (not "they likely need…").
(5) Emit ONE JSON object matching the schema in the user prompt.
</step_by_step>

<output_requirements>
- Output MUST be valid JSON parseable by JSON.parse(). No markdown fence.
- Every "signal" field must reference a specific observable fact, not
  speculation.
- "location" and "website" must come from the input; if input is silent,
  use "not specified" (never invent a website).
- "score" is an integer 1-10.
</output_requirements>

<search_first>
You do not have live web access. For any company-specific claim
(current funding, current headcount, current product launch),
append "[VERIFY]" immediately after the claim so the SDR knows to
confirm before outreach. Don't assert pre-training-cutoff facts as
current.
</search_first>`,
          },
          { role: "user", content: prompt },
        ],
        { maxTokens: 3000, temperature: 0.4 },
      );

      let parsed;
      try {
        const cleaned = result
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // Trigger self-heal: the model didn't return JSON. The diagnoser
        // can look at the context (e.g. "too broad", "ambiguous location")
        // and propose a narrower input that's more JSON-friendly.
        throw new Error("Model returned non-JSON output");
      }

      const leads = parsed.leads || parsed.reports || [];
      if (leads.length === 0) {
        throw new Error(
          "No leads generated — niche/location may be too narrow",
        );
      }

      // Step 3: Enrichment — fires only when user has BYOK keys (Hunter, Apollo, Clearbit)
      // If no keys are configured this returns the original array with zero latency overhead.
      const userEmail = (input._userEmail as string) || "";
      const enriched = userEmail
        ? await enrichLeads(leads, userEmail).catch(() => leads)
        : leads;

      type LeadWithEnrichment = (typeof leads)[number] & {
        enrichment?: { sources: string[] };
      };
      const enrichmentSources = (enriched as LeadWithEnrichment[]).flatMap(
        (l) => l.enrichment?.sources ?? [],
      );
      const uniqueSources = [...new Set(enrichmentSources)];

      return {
        success: true,
        leads: enriched,
        total: enriched.length,
        niche,
        location,
        researchGrounded: webResearch.length > 50,
        enrichmentSources: uniqueSources, // ["hunter", "apollo"] or []
      };
    },
    { label: "leads", maxRetries: 1, inputSchema: INPUT_SCHEMA },
  ),
});
