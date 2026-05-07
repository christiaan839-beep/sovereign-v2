import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { db } from "@/db";
import { emailSequences, sequenceSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";
import { fireUserWebhook } from "@/lib/webhooks";
import { createLogger } from "@/lib/logger";
const log = createLogger("email-sequence");

const SEQUENCE_PROMPT = `You build automated email drip sequences.

## EMAIL RULES
- Subject lines: 6-10 words, curiosity-driven, NO spam trigger words
- Opening line must be personal and hook them immediately
- Each email should deliver standalone value, not just "tease" the next
- CTA per email: exactly ONE, clear, action-oriented
- Tone: professional but warm, like a trusted advisor
- Length: 150-250 words per email (short, scannable)
- NO generic phrases like "I hope this email finds you well"
- Sound like a real person, not a template

Respond in this exact JSON format:
{
  "sequenceName": "Name of the sequence",
  "steps": [
    { "stepNumber": 1, "subject": "Email subject line", "body": "Full email body in plain text", "delayDays": 0 }
  ]
}`;

// GET: List all sequences for the user (kept as raw handler — read-only, no safety pipeline needed)
export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sequences = await db.query.emailSequences.findMany({
      where: eq(
        emailSequences.userEmail,
        user.primaryEmailAddress.emailAddress,
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    return NextResponse.json({ sequences });
  } catch (err) {
    log.error(
      "GET /api/agents/email-sequence error",
      err as Record<string, unknown>,
    );
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

// POST: Generate or query sequences — wrapped in factory for full safety pipeline
const schema = z.object({
  action: z.enum(["generate", "getSteps"]).optional().default("generate"),
  product: z.string().max(2000).optional(),
  businessDescription: z.string().max(2000).optional(),
  audience: z.string().max(500).optional(),
  targetAudience: z.string().max(500).optional(),
  tone: z.string().max(100).optional(),
  context: z.string().max(5000).optional(),
  sequenceType: z.string().max(100).optional(),
  numberOfEmails: z.number().int().min(1).max(10).optional(),
  sequenceId: z.string().uuid().optional(),
  prompt: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "email-sequence",
  schema,
  handler: async ({ input, email }) => {
    const action = (input.action as string) || "generate";

    if (action === "generate") {
      const product = (input.product ||
        input.businessDescription ||
        "Business") as string;
      const audience = (input.audience ||
        input.targetAudience ||
        "Decision-makers") as string;
      const tone = (input.tone || "Professional") as string;
      const context = (input.context || "") as string;
      const sequenceType = (input.sequenceType || "Lead Nurture") as string;
      const numberOfEmails = (input.numberOfEmails as number) || 5;

      const prompt = `Generate a ${numberOfEmails}-email ${sequenceType} sequence.

PRODUCT/SERVICE: ${product}
TARGET AUDIENCE: ${audience}
TONE: ${tone}
NUMBER OF EMAILS: ${numberOfEmails}
${context ? `\nADDITIONAL CONTEXT:\n${context.slice(0, 2000)}` : ""}

Make each email specific to the product and audience. Reference real pain points.`;

      const result = await ai(prompt, {
        system: SEQUENCE_PROMPT,
        maxTokens: 4000,
      });

      let parsed;
      try {
        parsed = JSON.parse(
          result
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim(),
        );
      } catch {
        parsed = {
          sequenceName: "Generated Sequence",
          steps: [],
          raw: result.slice(0, 500),
        };
      }

      // Save sequence to DB
      if (parsed.steps?.length > 0 && email) {
        try {
          const [newSequence] = await db
            .insert(emailSequences)
            .values({
              userEmail: email,
              name: parsed.sequenceName,
              trigger: "manual",
              status: "draft",
              totalSteps: String(parsed.steps.length),
            })
            .returning();

          for (const step of parsed.steps) {
            await db.insert(sequenceSteps).values({
              sequenceId: newSequence.id,
              stepNumber: String(step.stepNumber),
              subject: step.subject,
              body: step.body,
              delayDays: String(step.delayDays || 0),
            });
          }

          await fireUserWebhook("EmailSequences", "SequenceCreated", {
            name: parsed.sequenceName,
            steps: parsed.steps.length,
          }).catch(() => {});

          return { success: true, sequence: newSequence, ...parsed };
        } catch (dbErr) {
          log.warn("DB save failed, returning generated sequence", {
            error: String(dbErr),
          });
          return { success: true, ...parsed };
        }
      }

      return { success: true, ...parsed };
    }

    // Get steps for a specific sequence
    if (action === "getSteps") {
      const sequenceId = input.sequenceId as string;
      if (!sequenceId)
        throw new Error("sequenceId required for getSteps action");

      const steps = await db.query.sequenceSteps.findMany({
        where: eq(sequenceSteps.sequenceId, sequenceId),
      });
      return { steps };
    }

    throw new Error("Invalid action. Use 'generate' or 'getSteps'.");
  },
});
