import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

const OUTBOUND_PROMPT = `You are a B2B outbound sales specialist. You write cold outreach that gets replies.

${ANTI_SLOP_RULES}

RULES: Subject lines max 5 words. Opening references something specific. Value prop in 1 sentence. CTA is low-friction. Total email 50-80 words max.`;

export const POST = createAgentRoute({
  name: "outbound",
  schema: z.object({
    prospectName: z.string().max(200).optional(),
    prospectCompany: z.string().max(200).optional(),
    prospectIndustry: z.string().max(200).optional(),
    yourOffer: z.string().max(500).optional(),
    yourProof: z.string().max(500).optional(),
    channels: z.array(z.string()).optional().default(["email"]),
    sequenceLength: z.number().int().min(1).max(10).optional().default(5),
    prompt: z.string().optional(),
  }),
  handler: async ({ input }) => {
    const { prospectName, prospectCompany, prospectIndustry, yourOffer, yourProof, channels, sequenceLength } = input as Record<string, unknown>;

    const result = await ai(
      `Generate a ${sequenceLength || 5}-step cold outreach sequence. PROSPECT: ${prospectName || "Decision Maker"} at ${prospectCompany || "Target Company"}. INDUSTRY: ${prospectIndustry || "B2B"}. OFFER: ${yourOffer || "AI marketing automation"}. PROOF: ${yourProof || "50+ businesses, 300% more leads"}. CHANNELS: ${(channels as string[] || ["email"]).join(", ")}. Respond in JSON: {"sequence": [{"step": 1, "channel": "email", "dayNumber": 1, "subject": "...", "message": "...", "followUpTrigger": "..."}], "overallStrategy": "..."}`,
      { system: OUTBOUND_PROMPT, maxTokens: 3000 }
    );

    let parsed;
    try { parsed = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim()); }
    catch { parsed = { sequence: [], rawOutput: result }; }

    await fireUserWebhook("Outbound", "SequenceGenerated", { prospectCompany }).catch(() => {});
    return { success: true, ...parsed };
  },
});
