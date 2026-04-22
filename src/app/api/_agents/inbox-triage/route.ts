import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * INBOX-TRIAGE — Classify an email into an action bucket with priority.
 *
 * Takes an email object (from, subject, body) plus optional user context,
 * and routes it to one of 6 action buckets with a 1-5 priority, optional
 * draft reply, rationale, and estimated time cost.
 *
 * Input:
 *   {
 *     email:        { from: string, subject: string, body: string },
 *     userContext?: string  // NL — their role/current projects
 *   }
 *
 * Output (JSON):
 *   {
 *     bucket:                "reply-now" | "reply-later" | "delegate"
 *                            | "read-later" | "archive" | "spam",
 *     priority:              1-5,
 *     draftReply:            string | null,
 *     rationale:             string,
 *     estimatedTimeMinutes:  number | null
 *   }
 *
 * Pairs with:
 *   - `email-builder` — downstream reply composition
 *   - `task-prioritizer` — queue reply-later items
 */

const INBOX_TRIAGE_SYSTEM_PROMPT = `You are an executive assistant trained to triage email with calibrated judgment and ruthless efficiency.

${ANTI_SLOP_RULES}

## TRIAGE RULES
1. NEVER fabricate urgency. Read the tone and explicit content of the email — don't invent deadlines, amounts, or stakes that aren't there. If the sender says "no rush," honor it.
2. Use the bucket system strictly:
   - "reply-now": requires human response within 1 hour (explicit urgency, named deadline, escalation)
   - "reply-later": legitimate but non-urgent; can wait <48h
   - "delegate": action belongs to another function (ops, legal, support)
   - "read-later": informational, worth skimming, no response expected
   - "archive": handled/resolved/FYI with no follow-up
   - "spam": solicitations, mass outreach with no relationship, phishing indicators
3. Priority 1 = drop everything, 5 = nice to see. Only assign priority 1 to explicit emergencies (prod down, legal threat, named VIP).
4. Provide a draftReply ONLY for "reply-now" and "reply-later". For other buckets return null. Keep drafts under 80 words, plain English, no corporate mush.
5. estimatedTimeMinutes is total human effort (read + reply + any tab-switching). Return null for archive/spam.
6. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "inbox-triage",
  requiredFields: ["email"],
  handler: async ({ input }) => {
    const { email, userContext } = input as {
      email: { from: string; subject: string; body: string };
      userContext?: string;
    };

    const prompt = `Triage this email. Return ONLY valid JSON matching the schema.

EMAIL:
From: ${email.from}
Subject: ${email.subject}
Body:
"""
${String(email.body).slice(0, 10_000)}
"""

${userContext ? `USER CONTEXT: ${userContext}` : ""}

SCHEMA:
{
  "bucket": "reply-now" | "reply-later" | "delegate" | "read-later" | "archive" | "spam",
  "priority": number (1-5),
  "draftReply": string | null,
  "rationale": string,
  "estimatedTimeMinutes": number | null
}`;

    const response = await ai(prompt, {
      system: INBOX_TRIAGE_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Inbox triage failed: model returned non-JSON output");
    }

    return { success: true, triage: parsed };
  },
});
