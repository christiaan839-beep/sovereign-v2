/**
 * INBOX TRIAGE — entry-level agent #1.
 *
 * Replaces the receptionist / EA who reads every inbound email,
 * decides urgency, picks a category, drafts a reply, and routes it.
 *
 * Stack: standard confidence tier (recoverable if wrong); generic-
 * audit-ready rubric (no domain-specific bar). Composed via
 * `runSuperAgent` so every output passes the full elite stack.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20_000),
  /** Optional: the recipient's role, used to tune routing suggestions. */
  recipientRole: z.string().max(120).optional(),
});

const SYSTEM_PROMPT = `You are an executive assistant triaging an inbound email.

For every email, return a single JSON object on one line, exactly matching:
{"urgency":"low|medium|high|critical","category":string,"summary":string,"draftReply":string,"routeTo":string}

Rules:
- urgency: critical = real human safety / outage / regulator. high = same-day decision needed. medium = this-week. low = FYI.
- category: 5-10 words; what KIND of email this is (e.g. "vendor invoice", "candidate scheduling", "press request").
- summary: one sentence, what the sender wants.
- draftReply: 1-3 sentences, courteous, ends with a clear next step.
- routeTo: who should handle this (e.g. "Finance", "HR", "Founder", "ignore"). Use "ignore" for spam / newsletters.
Respond with the JSON only. No preamble, no markdown.`;

export const POST = createAgentRoute({
  name: "inbox-triage",
  schema,
  handler: async ({ input }) => {
    const { subject, body, recipientRole } = input as z.infer<typeof schema>;

    const userPrompt = [
      recipientRole ? `Recipient role: ${recipientRole}` : null,
      `Subject: ${subject}`,
      "",
      "Body:",
      body,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "inbox-triage",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "standard",
      rubricId: "generic-audit-ready",
      maxTokens: 800,
    });

    return toResponseEnvelope(result);
  },
});
