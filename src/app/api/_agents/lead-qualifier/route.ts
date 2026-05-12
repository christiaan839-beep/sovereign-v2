/**
 * LEAD QUALIFIER — entry-level agent #4.
 *
 * Replaces the junior SDR who reviews inbound leads against BANT
 * (Budget / Authority / Need / Timeline) and decides who deserves
 * a human's time. Returns a structured qualification with score,
 * reasoning, and a next-action recommendation.
 *
 * Stack: standard confidence tier; generic-audit-ready rubric so
 * the agent must back every claim ("they have budget") with a
 * citable source quote from the input.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  /** What the prospect said about themselves — form fill, email, call notes. */
  prospectInfo: z.string().min(10).max(20_000),
  /** Optional: enrichment data (firmographic, technographic). */
  enrichment: z.string().max(20_000).optional(),
  /** Your ICP definition. The agent scores against this. */
  icp: z.string().max(2000),
});

const SYSTEM_PROMPT = `You are a B2B sales-development qualifier. Score the lead against the ICP using BANT (Budget, Authority, Need, Timeline) and return a single JSON object on one line.

Output schema:
{"score":<0..100>,"tier":"hot|warm|cool|unqualified","bant":{"budget":{"signal":string,"evidence":string|null},"authority":{"signal":string,"evidence":string|null},"need":{"signal":string,"evidence":string|null},"timeline":{"signal":string,"evidence":string|null}},"icpFit":{"matches":string[],"gaps":string[]},"nextAction":string,"reasoning":string}

Rules:
- score: 0-100. 80+ = hot, 60-79 = warm, 40-59 = cool, <40 = unqualified.
- evidence: short verbatim quote from prospectInfo or enrichment. null when no evidence is present (then signal = "unknown").
- nextAction: one specific next step (e.g. "Book 30-min discovery", "Send pricing one-pager", "Reject — no budget signal").
- reasoning: 1-3 sentences justifying the score. Cite which BANT dimensions drove it.
- NEVER infer a BANT signal that isn't in the inputs. "unknown" is a valid signal.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "lead-qualifier",
  schema,
  handler: async ({ input }) => {
    const { prospectInfo, enrichment, icp } = input as z.infer<typeof schema>;

    const userPrompt = [
      "ICP definition:",
      icp,
      "",
      "Prospect info:",
      prospectInfo,
      enrichment ? "\nEnrichment data:\n" + enrichment : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "lead-qualifier",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "standard",
      rubricId: "generic-audit-ready",
      maxTokens: 1500,
    });

    return toResponseEnvelope(result);
  },
});
