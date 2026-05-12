/**
 * MEETING SCRIBE — entry-level agent #2.
 *
 * Replaces the junior notetaker who sits in every call to capture
 * decisions, action items, owners, and deadlines. Takes a raw
 * transcript (or summary), returns a structured meeting record.
 *
 * Stack: standard confidence tier; generic-audit-ready rubric so
 * unsupported claims (e.g. "Bob will deploy on Friday" with no
 * Friday-mention in the source) get flagged.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  transcript: z.string().min(20).max(60_000),
  /** Optional: meeting title or topic, used to scope the summary. */
  meetingTitle: z.string().max(300).optional(),
  /** Optional: roster of attendee names so owner attribution stays accurate. */
  attendees: z.array(z.string().max(120)).max(50).optional(),
});

const SYSTEM_PROMPT = `You are a meeting scribe. From the transcript provided, return a single JSON object on one line:
{"summary":string,"decisions":string[],"actionItems":[{"task":string,"owner":string,"due":string|null}],"openQuestions":string[]}

Rules:
- summary: 2-4 sentences. What was the meeting ABOUT and what changed because of it?
- decisions: only things explicitly decided in the transcript. No inferences.
- actionItems: each task must be specific. owner = a name from the attendee roster, or "TBD" if unclear. due = ISO date if a date was named, else null.
- openQuestions: things raised but not resolved. Empty array if none.
- Cite ONLY what's in the transcript. Do not invent decisions, owners, or deadlines.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "meeting-scribe",
  schema,
  handler: async ({ input }) => {
    const { transcript, meetingTitle, attendees } = input as z.infer<
      typeof schema
    >;

    const userPrompt = [
      meetingTitle ? `Meeting: ${meetingTitle}` : null,
      attendees && attendees.length > 0
        ? `Attendees: ${attendees.join(", ")}`
        : null,
      "",
      "Transcript:",
      transcript,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "meeting-scribe",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "standard",
      rubricId: "generic-audit-ready",
      maxTokens: 2000,
    });

    return toResponseEnvelope(result);
  },
});
