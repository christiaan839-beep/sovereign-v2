/**
 * TIER-1 SUPPORT — entry-level agent #5.
 *
 * Replaces the helpdesk Lvl-1 agent: reads the customer ticket,
 * checks the supplied knowledge-base context, drafts a reply,
 * and tags the ticket. Critically, it ESCALATES rather than
 * fabricates when the KB doesn't contain the answer — that's
 * what the abstain-on-low-confidence contract is for.
 *
 * Stack: STRICT confidence tier — wrong support replies erode
 * customer trust and create downstream support load. Generic-
 * audit-ready rubric (caller can override per-product if needed).
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  /** The customer's message (subject + body concatenated is fine). */
  ticket: z.string().min(1).max(20_000),
  /**
   * Knowledge base context. Caller is responsible for retrieval —
   * this agent does NOT search; it answers from the supplied
   * context. Pre-narrowed RAG passages typically.
   */
  knowledgeBase: z.string().max(40_000),
  /** Optional: customer's plan / tier so the reply can be scoped. */
  customerTier: z.string().max(60).optional(),
  /** Optional: brand voice guidelines. */
  brandVoice: z.string().max(2000).optional(),
});

const SYSTEM_PROMPT = `You are a Tier-1 customer support agent. Answer ONLY from the supplied knowledge base. If the KB doesn't contain the answer, say so plainly — do NOT improvise.

Return a single JSON object on one line:
{"reply":string,"answeredFromKb":boolean,"sourceQuotes":string[],"tags":string[],"escalate":{"required":boolean,"reason":string|null,"toTeam":string|null}}

Rules:
- reply: 1-4 sentences. Friendly, brand-aligned, ends with a clear next step.
- answeredFromKb: true ONLY if every claim in your reply traces to a sourceQuote. Otherwise false.
- sourceQuotes: 5-25 word verbatim excerpts from the knowledge base that justify the reply. Empty when answeredFromKb is false.
- tags: 1-5 short labels for the ticket (e.g. "billing", "refund-request", "feature-request").
- escalate.required: true when the KB doesn't answer the question OR the request needs human judgement (refunds over policy, account access, complaints). When true, populate reason + toTeam (e.g. "Billing", "Engineering", "Trust & Safety").
- NEVER invent product behaviour, pricing, or policy not in the KB.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "tier1-support",
  schema,
  handler: async ({ input }) => {
    const { ticket, knowledgeBase, customerTier, brandVoice } = input as z.infer<
      typeof schema
    >;

    const userPrompt = [
      customerTier ? `Customer tier: ${customerTier}` : null,
      brandVoice ? `Brand voice: ${brandVoice}` : null,
      "",
      "Customer ticket:",
      ticket,
      "",
      "Knowledge base context:",
      knowledgeBase,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "tier1-support",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "strict",
      rubricId: "generic-audit-ready",
      maxTokens: 1500,
    });

    return toResponseEnvelope(result);
  },
});
