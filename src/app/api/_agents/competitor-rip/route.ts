import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai } from "@/lib/ai";
import { isAdmin } from "@/lib/admin-auth";

/**
 * COMPETITOR-RIP — drafts a /vs/<slug> registry entry for a new competitor.
 *
 * Takes a competitor name + URL and returns a structured draft that
 * the operator can paste into src/lib/competitor-registry.ts. The
 * output matches the Competitor interface exactly so it's a copy-paste
 * shipment, not a 30-minute hand-edit.
 *
 * Why an agent and not just a config form? Two reasons:
 *   1. Researching a new competitor's pricing + positioning is the slow
 *      part. The model can do that in 30 seconds.
 *   2. Maintaining an honest tone (the registry's distinctive voice) is
 *      easier with a strong system prompt than with manual writing.
 *
 * Admin-only: even though the output is just JSON, the agent itself
 * costs money to run and is purely an operator tool.
 */

const schema = z.object({
  name: z.string().min(2).max(80),
  url: z.string().url().optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/u, "slug must be lowercase kebab-case")
    .optional(),
  /** Their public pricing as a string (eg "$49–$149/seat/mo"). Saves the
   *  agent a research step and improves accuracy. */
  theirPricing: z.string().max(120).optional(),
  /** Audience the comparison should target. Defaults to "AI buyers". */
  audience: z.string().max(160).optional(),
  /** Optional context: what the operator already knows about them. */
  context: z.string().max(4000).optional(),
});

const SYSTEM_PROMPT = `You are an honest, sharp competitive analyst writing JSON for an internal registry.

You produce comparisons of a competitor against "Sovereign Matrix" — a multi-tenant AI agent platform with 140 pre-built agents, multi-provider cost-routing (Ollama → Cerebras → NIM → Claude), 5-layer safety pipeline (jailbreak / PII / content / quality / critic), whitelabel for agencies, and South African / global payment rails.

Sovereign pricing: $19–$199/mo flat, no per-seat. Free tier 50 runs/mo.

VOICE RULES:
- Be honest about what the competitor does WELL. List things they win on. Credibility loop.
- Be specific. "$50K/yr enterprise contract" beats "expensive."
- No marketing slop. No "revolutionize," "in today's fast-paced world," "unlock value."
- Lead with customer pain, not tech features.
- 2–3 paragraphs in "positioning" — punchy, never preachy.
- "When to pick which" is the energy. Not "we're better."

OUTPUT FORMAT — strictly valid JSON matching this TypeScript interface:

interface Competitor {
  slug: string;
  name: string;
  theirTagline: string;        // Their tagline, paraphrased — under 90 chars
  honestSummary: string;       // 2 sentences. Who they serve well + who they don't. Under 280 chars.
  theirPricing: string;        // Public pricing, exact strings
  ourPricing: string;          // Sovereign's matching tier — typically "$19–$199/mo flat"
  comparison: Array<{          // 8–12 rows
    feature: string;
    sovereign: boolean | "partial";
    competitor: boolean | "partial";
    note?: string;             // 1 sentence max, only when needed
  }>;
  positioning: string[];       // 2–3 paragraphs, each 60–160 words
  audience: string;            // Who this comparison is FOR
  url?: string;
}

Return ONLY the JSON object. No prose before or after, no code fence.`;

export const POST = createAgentRoute({
  name: "competitor-rip",
  schema,
  // Disable critic — output is JSON, the critic would mangle it.
  useCritic: false,
  // Skip jailbreak/safety on input (admin-only operator tool with structured input).
  skipJailbreakCheck: true,
  skipSafetyCheck: true,
  skipQualityCheck: true,
  // Wave-111.1 batch 3: memory hooks. Operator regenerates competitor
  // registry entries as competitors update pricing / positioning;
  // prior drafts compound — the model sees what we already published
  // and produces a delta-aware update rather than starting fresh.
  // Note: this agent is admin-only; the userId="anon" skip in the
  // factory ensures non-admin invocations never write memory anyway.
  memory: {
    search: {
      query: (input) =>
        `competitor-rip name:${input.name ?? ""} slug:${input.slug ?? ""}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          draft?: {
            name?: string;
            theirTagline?: string;
            theirPricing?: string;
            honestSummary?: string;
          };
        };
        const d = r.draft;
        if (!d?.name) return null;
        return `${d.name} (${d.theirPricing ?? "?"}): ${d.theirTagline ?? ""} — ${(d.honestSummary ?? "").slice(0, 200)}`;
      },
      metadata: (input) => ({
        name: String(input.name ?? ""),
        slug: String(input.slug ?? ""),
        kind: "competitor-registry-draft",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    // Admin gate. The agent itself costs money to run; non-admin
    // shouldn't be able to invoke it as a free competitive-research tool.
    const callerUserId = (input as { userId?: string }).userId;
    if (!callerUserId || !isAdmin(callerUserId)) {
      return {
        success: false,
        error:
          "Admin-only. Add your Clerk user ID to ADMIN_USER_IDS to use competitor-rip.",
      };
    }

    const name = String(input.name);
    const url = input.url ? String(input.url) : "";
    const slug =
      (input.slug as string | undefined) ??
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const audience =
      (input.audience as string | undefined) ??
      `Buyers comparing AI tools to ${name}.`;
    const theirPricing =
      (input.theirPricing as string | undefined) ?? "Unknown";
    const context = (input.context as string | undefined) ?? "";

    const userPrompt = `Generate the registry entry for "${name}".

Slug: ${slug}
Their URL: ${url || "not provided"}
Their pricing (operator-supplied): ${theirPricing}
Target audience: ${audience}

${context ? `Additional context the operator has gathered:\n${context}\n` : ""}
${pastContextAsPrompt() ? `\nPRIOR REGISTRY DRAFTS for this competitor (historical FACTS — surface what's changed in their positioning/pricing, do NOT restate the prior draft verbatim):\n${pastContextAsPrompt()}\n` : ""}

Produce the full Competitor JSON. The "ourPricing" field should be "$19–$199 / month flat — agents included" unless context suggests a more specific match. Pick 8–12 honest comparison rows that meaningfully differentiate. Aim for at least 3 rows where the competitor wins.`;

    const raw = await ai(userPrompt, {
      system: SYSTEM_PROMPT,
      maxTokens: 3000,
      // DeepSeek tends to follow JSON schemas well and is on the free tier.
      model: "nim",
    });

    // Strip any accidental code fences just in case.
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/u, "")
      .replace(/\s*```\s*$/u, "")
      .trim();

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fall through — return raw so the operator can hand-fix.
    }

    return {
      success: true,
      slug,
      draft: parsed,
      raw: parsed ? undefined : cleaned,
      operatorNote: parsed
        ? `Paste the draft into src/lib/competitor-registry.ts and the page renders at /vs/${slug}.`
        : "Model returned non-JSON. Paste the raw output into a JSON formatter, fix structure, then add to the registry.",
    };
  },
});
