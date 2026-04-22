import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { withSelfHeal } from "@/lib/self-heal";
import { enrichLeads } from "@/lib/enrichment";
// ─── A2E DEMONSTRATION ──────────────────────────────────────────────────
// `spawnAgent` is the Track B primitive that lets this agent hire another
// agent as a sub-task. After we find + enrich prospects, we spawn the
// `competitor` agent to get competitive intel for the top-scoring
// prospects, bubbling the results back in the response under
// `_spawnedIntel`. The spawn helper enforces recursion depth + a per-parent
// spend cap so this loop can't accidentally drain credits.
// ────────────────────────────────────────────────────────────────────────
import { spawnAgent, SpawnError } from "@/lib/agent-spawn";
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
 * A2E: once prospects are found, spawns `competitor` for up to 5 of them
 * to attach competitive intelligence. Each spawn respects the per-parent
 * A2E spend cap — the first spawn that would exceed the cap simply fails
 * recoverably and the rest of the prospects are returned unannotated.
 *
 * Input: { niche: string, location: string, product?: string, context?: string }
 * Output: { leads: Lead[], total: number, _spawnedIntel?: IntelEntry[] }
 */

/**
 * Hard cap on the number of child spawns triggered per parent run, on
 * top of the cents-level cap enforced inside `spawnAgent`. Keeping this
 * under 6 ensures we stay within the default 150-cent per-parent budget
 * even when every prospect hits the most expensive child path.
 */
const MAX_A2E_PROSPECTS = 5;

const INPUT_SCHEMA = z.object({
  niche: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  product: z.string().max(500).optional(),
  context: z.string().max(2000).optional(),
  prompt: z.string().max(5000).optional(),
}).passthrough();

export const POST = createAgentRoute({
  name: "leads",
  requiredFields: ["niche"],
  handler: withSelfHeal(async ({ input, userId }: { input: Record<string, unknown>; userId?: string }) => {
    const niche = input.niche as string;
    const location = (input.location as string) || "worldwide";
    const product = (input.product as string) || "";
    const context = (input.context as string) || "";

    // Parent hold id + depth for A2E spawn bookkeeping. `_a2eDepth` is
    // set by the spawn helper when this agent is itself invoked as a
    // child; otherwise we're the top-level parent at depth 0.
    const parentHoldId = (input._a2eParentHoldId as string) ||
      `leads_${Date.now()}_${Math.floor(Math.random() * 1e9).toString(36)}`;
    const parentDepth = typeof input._a2eDepth === "number" ? input._a2eDepth : 0;

    // Step 1: Real web research via Tavily
    let webResearch = "";
    try {
      webResearch = await research_ai(
        `${niche} companies ${location} hiring growing 2026`,
        `Find real companies in the ${niche} industry located in ${location}. For each company found, identify: the company name, what they do, their website URL if available, and any recent news (funding, hiring, product launches). Focus on companies that would be good prospects for outreach.`
      );
    } catch {
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
        { role: "system", content: "You are a B2B sales intelligence analyst. Output ONLY valid JSON. No markdown, no explanation." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 3000, temperature: 0.4 }
    );

    let parsed;
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Trigger self-heal: the model didn't return JSON. The diagnoser
      // can look at the context (e.g. "too broad", "ambiguous location")
      // and propose a narrower input that's more JSON-friendly.
      throw new Error("Model returned non-JSON output");
    }

    const leads = parsed.leads || parsed.reports || [];
    if (leads.length === 0) {
      throw new Error("No leads generated — niche/location may be too narrow");
    }

    // Step 3: Enrichment — fires only when user has BYOK keys (Hunter, Apollo, Clearbit)
    // If no keys are configured this returns the original array with zero latency overhead.
    const userEmail = (input._userEmail as string) || "";
    const enriched = userEmail
      ? await enrichLeads(leads, userEmail).catch(() => leads)
      : leads;

    type LeadWithEnrichment = typeof leads[number] & { enrichment?: { sources: string[] } };
    const enrichmentSources = (enriched as LeadWithEnrichment[])
      .flatMap((l) => l.enrichment?.sources ?? []);
    const uniqueSources = [...new Set(enrichmentSources)];

    // ─── A2E DEMONSTRATION: spawn `competitor` per top prospect ────────
    // For the top-scoring prospects (max MAX_A2E_PROSPECTS), spawn the
    // `competitor` agent to attach light competitive-intel annotations.
    // Each spawn:
    //   - shares our `parentHoldId` so the per-parent spend cap can tally
    //     spend across prospects
    //   - passes `depth: parentDepth` so the helper bumps depth to
    //     parentDepth + 1 inside the child
    // A spawn failure is recoverable — we log it, skip that prospect, and
    // the parent run continues to completion.
    const spawnedIntel: Array<{
      company: string;
      ok: boolean;
      result?: unknown;
      reason?: string;
    }> = [];
    if (userId) {
      const rankedProspects = [...(enriched as LeadWithEnrichment[])]
        .filter((l) => l && typeof l === "object")
        .sort(
          (a, b) =>
            Number((b as { score?: number }).score ?? 0) -
            Number((a as { score?: number }).score ?? 0),
        )
        .slice(0, MAX_A2E_PROSPECTS);

      for (const prospect of rankedProspects) {
        const company =
          (prospect as { company_name?: string }).company_name ?? "unknown";
        const website = (prospect as { website?: string }).website ?? "";
        try {
          const intel = await spawnAgent({
            slug: "competitor",
            inputs: {
              competitorName: company,
              competitorUrl: website,
              yourBusiness: product || "B2B outreach",
              industry: niche,
            },
            parent: {
              userId,
              parentAgentSlug: "leads",
              parentHoldId,
              depth: parentDepth,
            },
          });
          spawnedIntel.push({ company, ok: true, result: intel });
        } catch (err) {
          const reason =
            err instanceof SpawnError ? err.code : String(err);
          spawnedIntel.push({ company, ok: false, reason });
          // Abort further spawns once we hit the A2E cap — remaining
          // prospects will have the same outcome, so we save the HTTP
          // round-trip.
          if (
            err instanceof SpawnError &&
            (err.code === "A2E_CAP_EXCEEDED" || err.code === "A2E_DEPTH_EXCEEDED")
          ) {
            break;
          }
        }
      }
    }

    return {
      success: true,
      leads: enriched,
      total: enriched.length,
      niche,
      location,
      researchGrounded: webResearch.length > 50,
      enrichmentSources: uniqueSources,    // ["hunter", "apollo"] or []
      _spawnedIntel: spawnedIntel.length > 0 ? spawnedIntel : undefined,
      _a2eParentHoldId: parentHoldId,      // exposed so tests / ops can correlate
    };
  }, { label: "leads", maxRetries: 1, inputSchema: INPUT_SCHEMA }),
});
